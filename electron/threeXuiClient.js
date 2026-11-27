const http = require('http');
const https = require('https');
const net = require('net');
const { URL } = require('url');

/**
 * 3x-ui Control Panel API Client + Local TCP Latency Probe + On-Demand Speedtest
 * Supports standard MHSanaei/3x-ui endpoints with graceful route fallbacks and self-signed TLS.
 */
class ThreeXuiClient {
  constructor() {
    this.cookieJar = new Map();
    this.csrfToken = '';
    this.loggedInUrl = '';
    this.latencyHistory = [];
    this.throughputHistory = [];
    this.probeSamples = []; // track last 20 probe results for packet loss %
    this.lastStatusRoute = null;
    this.lastInboundsRoute = null;
    this.lastOnlinesRoute = null;
  }

  resetSession() {
    this.cookieJar = new Map();
    this.csrfToken = '';
    this.loggedInUrl = '';
    this.lastStatusRoute = null;
    this.lastInboundsRoute = null;
    this.lastOnlinesRoute = null;
  }

  normalizeBaseUrl(rawUrl) {
    if (!rawUrl || !rawUrl.trim()) {
      throw new Error('未填写 3x-ui 面板地址');
    }
    let trimmed = rawUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'http://' + trimmed;
    }
    const parsed = new URL(trimmed);
    // Strip trailing /panel or /login if user pasted full login URL
    let basePath = parsed.pathname.replace(/\/+$/, '');
    basePath = basePath.replace(/\/(panel|login)$/i, '');
    return {
      origin: parsed.origin,
      basePath,
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
      protocol: parsed.protocol
    };
  }

  request(fullUrl, { method = 'GET', headers = {}, body = null, ignoreTlsErrors = false, timeoutMs = 8000 } = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(fullUrl);
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const reqHeaders = {
        'User-Agent': 'VPS-Matrix-Screensaver/1.0',
        Accept: 'application/json, text/plain, */*',
        ...headers
      };
      if (this.cookieJar.size && !reqHeaders.Cookie) {
        reqHeaders.Cookie = [...this.cookieJar.values()].join('; ');
      }

      let payload = body;
      if (body && typeof body === 'object' && !(body instanceof Buffer)) {
        if (reqHeaders['Content-Type'] && reqHeaders['Content-Type'].includes('application/x-www-form-urlencoded')) {
          payload = new URLSearchParams(body).toString();
        } else {
          payload = JSON.stringify(body);
          reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
        }
      }
      if (payload) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const options = {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: reqHeaders,
        timeout: timeoutMs
      };
      if (isHttps) {
        options.rejectUnauthorized = !ignoreTlsErrors;
      }

      const req = transport.request(options, (res) => {
        const chunks = [];
        res.on('error', reject);
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          const setCookies = res.headers['set-cookie'];
          if (setCookies && Array.isArray(setCookies) && setCookies.length > 0) {
            for (const cookie of setCookies) {
              const pair = cookie.split(';', 1)[0];
              const separator = pair.indexOf('=');
              if (separator < 1) continue;
              const name = pair.slice(0, separator);
              if (!pair.slice(separator + 1) || /;\s*Max-Age=0(?:;|$)/i.test(cookie)) {
                this.cookieJar.delete(name);
              } else {
                this.cookieJar.set(name, pair);
              }
            }
          }
          let json = null;
          try {
            json = JSON.parse(rawBody);
          } catch (_) {
            json = null;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            rawBody,
            json
          });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`请求超时 (${timeoutMs}ms)`));
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  buildHeaders(panelConfig) {
    const headers = { 'X-Requested-With': 'XMLHttpRequest' };
    if (panelConfig.apiToken && panelConfig.apiToken.trim()) {
      headers.Authorization = `Bearer ${panelConfig.apiToken.trim()}`;
    }
    return headers;
  }

  async loadCsrf(pageUrl, ignoreTlsErrors) {
    const page = await this.request(pageUrl, { ignoreTlsErrors });
    const token = page.rawBody.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)?.[1];
    if (token) this.csrfToken = token;
    return page;
  }

  async login(panelConfig) {
    const info = this.normalizeBaseUrl(panelConfig.url);
    // If Bearer token is configured, skip cookie login
    if (panelConfig.apiToken && panelConfig.apiToken.trim()) {
      this.loggedInUrl = `${info.origin}${info.basePath}`;
      return true;
    }

    if (!panelConfig.username || !panelConfig.password) {
      throw new Error('请填写 3x-ui 用户名和密码（或 API Token）');
    }

    const pageUrl = `${info.origin}${info.basePath}/`;
    const ignoreTlsErrors = panelConfig.ignoreTlsErrors === true;
    const page = await this.loadCsrf(pageUrl, ignoreTlsErrors);
    if (page.statusCode >= 400 && page.statusCode !== 404) {
      throw new Error(`无法打开 3x-ui 登录页：HTTP ${page.statusCode}，请检查面板路径及大小写`);
    }
    const loginUrl = `${pageUrl}login`;
    const body = {
      username: panelConfig.username,
      password: panelConfig.password
    };
    if (panelConfig.twoFactorCode && panelConfig.twoFactorCode.trim()) {
      body.twoFactorCode = panelConfig.twoFactorCode.trim();
    }

    const res = await this.request(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        ...(this.csrfToken ? { 'X-CSRF-Token': this.csrfToken, Origin: info.origin, Referer: pageUrl } : {})
      },
      body,
      ignoreTlsErrors: panelConfig.ignoreTlsErrors === true,
      timeoutMs: 9000
    });

    if (res.statusCode === 200 && res.json && res.json.success) {
      this.loggedInUrl = `${info.origin}${info.basePath}`;
      return true;
    }
    const msg = (res.json && res.json.msg) || `HTTP ${res.statusCode}`;
    throw new Error(`3x-ui 登录失败: ${msg}`);
  }

  async tryRoutes(panelConfig, candidates, cachedRouteKey) {
    const info = this.normalizeBaseUrl(panelConfig.url);
    const ordered = this[cachedRouteKey]
      ? [this[cachedRouteKey], ...candidates.filter((c) => c.path !== this[cachedRouteKey].path || c.method !== this[cachedRouteKey].method)]
      : candidates;

    let lastErr = null;
    let unauthorized = false;
    for (const candidate of ordered) {
      const fullUrl = `${info.origin}${info.basePath}${candidate.path}`;
      const send = () => {
        const headers = this.buildHeaders(panelConfig);
        if (!headers.Authorization && this.csrfToken && candidate.method === 'POST') {
          Object.assign(headers, {
            'X-CSRF-Token': this.csrfToken,
            Origin: info.origin,
            Referer: `${info.origin}${info.basePath}/panel/`
          });
        }
        return this.request(fullUrl, {
          method: candidate.method,
          headers,
          ignoreTlsErrors: panelConfig.ignoreTlsErrors === true
        });
      };
      let res = await send();
      if (res.statusCode === 403 && !panelConfig.apiToken?.trim() && this.csrfToken && candidate.method === 'POST') {
        await this.loadCsrf(`${info.origin}${info.basePath}/panel/`, panelConfig.ignoreTlsErrors === true);
        res = await send();
      }

      // Auth expired -> signal caller to re-login
      if (res.statusCode === 401 || (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)) {
        unauthorized = true;
      }

      if (res.statusCode === 200 && res.json && res.json.success === true && Object.hasOwn(res.json, 'obj')) {
        this[cachedRouteKey] = candidate;
        return res.json;
      }
      lastErr = new Error(`${candidate.method} ${candidate.path} -> HTTP ${res.statusCode}`);
    }
    if (unauthorized) {
      const err = new Error('3x-ui 会话已过期或 API Token 无效');
      err.code = 'AUTH_EXPIRED';
      throw err;
    }
    throw lastErr || new Error('无法匹配 3x-ui API 路径');
  }

  async ensureLoggedIn(panelConfig) {
    const info = this.normalizeBaseUrl(panelConfig.url);
    const key = `${info.origin}${info.basePath}`;
    if (this.loggedInUrl !== key || (!this.cookieJar.size && !(panelConfig.apiToken && panelConfig.apiToken.trim()))) {
      this.resetSession();
      await this.login(panelConfig);
    }
  }

  async probeTcpLatency(host, port, timeoutMs = 3500) {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      let settled = false;
      const socket = net.createConnection({ host, port });
      socket.setTimeout(timeoutMs);

      const done = (reachable, latencyMs) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ reachable, latencyMs });
      };

      socket.on('connect', () => {
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
        done(true, Math.max(1, Math.round(elapsedMs)));
      });
      socket.on('timeout', () => done(false, null));
      socket.on('error', () => done(false, null));
    });
  }

  recordLatency(probe) {
    this.probeSamples.push(probe.reachable ? 1 : 0);
    if (this.probeSamples.length > 20) this.probeSamples.shift();

    if (probe.reachable && probe.latencyMs !== null) {
      this.latencyHistory.push(probe.latencyMs);
      if (this.latencyHistory.length > 60) this.latencyHistory.shift();
    }

    const lost = this.probeSamples.filter((v) => v === 0).length;
    const packetLossPct = this.probeSamples.length > 0
      ? Number(((lost / this.probeSamples.length) * 100).toFixed(1))
      : 0;

    const recent = this.latencyHistory.slice(-10);
    let jitterMs = 0;
    if (recent.length > 1) {
      let sumDiff = 0;
      for (let i = 1; i < recent.length; i++) {
        sumDiff += Math.abs(recent[i] - recent[i - 1]);
      }
      jitterMs = Math.round(sumDiff / (recent.length - 1));
    }

    return {
      latencyMs: probe.latencyMs,
      jitterMs,
      packetLossPct,
      reachable: probe.reachable,
      latencyHistory: [...this.latencyHistory]
    };
  }

  async fetchSnapshot(config) {
    const panelConfig = config.panel;
    const info = this.normalizeBaseUrl(panelConfig.url);
    const probePort = Number(panelConfig.probePort) > 0 ? Number(panelConfig.probePort) : info.port;

    const fetchApi = async () => {
      await this.ensureLoggedIn(panelConfig);
      const statusRes = await this.tryRoutes(
        panelConfig,
        [
          { method: 'GET', path: '/panel/api/server/status' },
          { method: 'POST', path: '/server/status' },
          { method: 'GET', path: '/server/status' }
        ],
        'lastStatusRoute'
      );

      let onlinesRes = null;
      try {
        onlinesRes = await this.tryRoutes(
          panelConfig,
          [
            { method: 'POST', path: '/panel/api/inbounds/onlines' },
            { method: 'POST', path: '/panel/api/clients/onlines' },
            { method: 'GET', path: '/panel/api/inbounds/onlines' },
            { method: 'POST', path: '/panel/inbound/onlines' }
          ],
          'lastOnlinesRoute'
        );
      } catch (err) {
        if (err.code === 'AUTH_EXPIRED') throw err;
        onlinesRes = { error: err.message };
      }

      let inboundsRes = null;
      try {
        inboundsRes = await this.tryRoutes(
          panelConfig,
          [
            { method: 'GET', path: '/panel/api/inbounds/list' },
            { method: 'POST', path: '/panel/inbound/list' }
          ],
          'lastInboundsRoute'
        );
      } catch (err) {
        if (err.code === 'AUTH_EXPIRED') throw err;
        inboundsRes = { error: err.message };
      }

      return { statusRes, onlinesRes, inboundsRes };
    };

    const [probeResult, apiResult] = await Promise.all([
      this.probeTcpLatency(info.host, probePort),
      fetchApi().catch(async (err) => {
        if (err && err.code === 'AUTH_EXPIRED') {
          this.resetSession();
          return fetchApi();
        }
        throw err;
      })
    ]);

    const netStats = this.recordLatency(probeResult);
    const s = (apiResult.statusRes && apiResult.statusRes.obj) || {};
    const rawOnlines = (apiResult.onlinesRes && apiResult.onlinesRes.obj) || [];
    const onlineUsers = Array.isArray(rawOnlines) ? rawOnlines.map(String) : [];

    const rawInbounds = (apiResult.inboundsRes && apiResult.inboundsRes.obj) || [];
    const inbounds = Array.isArray(rawInbounds)
      ? rawInbounds.map((ib) => ({
          id: ib.id,
          remark: ib.remark || `INBOUND-${ib.port}`,
          protocol: ib.protocol || 'unknown',
          port: ib.port || 0,
          enable: ib.enable !== false,
          up: Number(ib.up) || 0,
          down: Number(ib.down) || 0,
          total: Number(ib.total) || 0
        }))
      : [];

    let totalClients = 0;
    if (Array.isArray(rawInbounds)) {
      for (const ib of rawInbounds) {
        if (Array.isArray(ib.clientStats)) {
          totalClients += ib.clientStats.length;
        }
      }
    }

    const upSpeed = Number(s.netIO && s.netIO.up) || 0;
    const downSpeed = Number(s.netIO && s.netIO.down) || 0;
    this.throughputHistory.push({ up: upSpeed, down: downSpeed });
    if (this.throughputHistory.length > 60) this.throughputHistory.shift();

    const publicIpv4 =
      config.node.hostOverride ||
      (s.publicIP && s.publicIP.ipv4 && s.publicIP.ipv4 !== 'N/A' ? s.publicIP.ipv4 : info.host);
    const publicIpv6 = s.publicIP && s.publicIP.ipv6 && s.publicIP.ipv6 !== 'N/A' ? s.publicIP.ipv6 : '';

    return {
      mode: 'live',
      connected: true,
      error: null,
      timestamp: Date.now(),
      node: {
        name: config.node.name || 'LAX-EDGE-01',
        locationLabel: config.node.locationLabel || 'Los Angeles, CA · US',
        provider: config.node.provider || 'Los Angeles VPS (3x-ui)',
        ipv4: publicIpv4,
        ipv6: publicIpv6,
        lat: config.node.lat ?? 34.0522,
        lon: config.node.lon ?? -118.2437
      },
      local: {
        label: config.local.label || '我的电脑',
        city: config.local.city || 'Hohhot, CN',
        lat: config.local.lat ?? 40.8426,
        lon: config.local.lon ?? 111.7492
      },
      network: {
        ...netStats,
        throughputHistory: [...this.throughputHistory]
      },
      system: {
        cpu: Number((Number(s.cpu) || 0).toFixed(1)),
        cpuCores: Number(s.logicalPro || s.cpuCores || 1),
        loads: Array.isArray(s.loads) ? s.loads.map((v) => Number((Number(v) || 0).toFixed(2))) : [0, 0, 0],
        mem: {
          current: Number(s.mem && s.mem.current) || 0,
          total: Number(s.mem && s.mem.total) || 1
        },
        swap: {
          current: Number(s.swap && s.swap.current) || 0,
          total: Number(s.swap && s.swap.total) || 0
        },
        disk: {
          current: Number(s.disk && s.disk.current) || 0,
          total: Number(s.disk && s.disk.total) || 1
        },
        uptime: Number(s.uptime) || 0,
        tcpCount: Number(s.tcpCount) || 0,
        udpCount: Number(s.udpCount) || 0,
        netIO: { up: upSpeed, down: downSpeed },
        netTraffic: {
          sent: Number(s.netTraffic && s.netTraffic.sent) || 0,
          recv: Number(s.netTraffic && s.netTraffic.recv) || 0
        },
        xray: {
          state: (s.xray && s.xray.state) || 'unknown',
          version: (s.xray && s.xray.version) || '-',
          errorMsg: (s.xray && s.xray.errorMsg) || ''
        }
      },
      proxy: {
        onlineUsersCount: apiResult.onlinesRes.error ? null : onlineUsers.length,
        warnings: [apiResult.onlinesRes.error, apiResult.inboundsRes.error].filter(Boolean),
        inboundsAvailable: !apiResult.inboundsRes.error,
        onlineUsers,
        totalClients: apiResult.inboundsRes.error ? null : totalClients,
        inbounds
      }
    };
  }

  /**
   * On-demand download speed test (triggered ONLY by user click to save VPS quota).
   */
  runSpeedTest(targetUrl, onProgress, ignoreTlsErrors = true) {
    return new Promise((resolve, reject) => {
      const urlToTest = (targetUrl && targetUrl.trim()) || 'https://speed.cloudflare.com/__down?bytes=15000000';
      let parsed;
      try {
        parsed = new URL(urlToTest);
      } catch (err) {
        return reject(new Error('测速地址格式无效'));
      }
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;
      const startNs = process.hrtime.bigint();
      let receivedBytes = 0;
      let totalBytes = 0;
      let lastReport = 0;

      const req = transport.request(
        {
          method: 'GET',
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          headers: { 'User-Agent': 'VPS-Matrix-Screensaver/1.0' },
          timeout: 18000,
          ...(isHttps ? { rejectUnauthorized: !ignoreTlsErrors } : {})
        },
        (res) => {
          if (res.statusCode >= 400) {
            return reject(new Error(`测速端点返回 HTTP ${res.statusCode}`));
          }
          totalBytes = Number(res.headers['content-length']) || 15000000;
          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            const now = Date.now();
            if (now - lastReport > 140) {
              lastReport = now;
              const elapsedSec = Math.max(0.05, Number(process.hrtime.bigint() - startNs) / 1e9);
              const mbps = Number(((receivedBytes * 8) / elapsedSec / 1e6).toFixed(1));
              const progress = Math.min(0.99, receivedBytes / totalBytes);
              if (onProgress) onProgress({ mbps, receivedBytes, progress, done: false });
            }
          });
          res.on('end', () => {
            const elapsedSec = Math.max(0.05, Number(process.hrtime.bigint() - startNs) / 1e9);
            const mbps = Number(((receivedBytes * 8) / elapsedSec / 1e6).toFixed(1));
            const result = {
              mbps,
              receivedBytes,
              elapsedSec: Number(elapsedSec.toFixed(2)),
              progress: 1,
              done: true
            };
            if (onProgress) onProgress(result);
            resolve(result);
          });
        }
      );

      req.on('timeout', () => req.destroy(new Error('测速超时')));
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Optional one-shot GeoIP lookup for auto-filling local city coordinates in Settings.
   */
  async detectLocalGeo() {
    const res = await this.request('http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,query', {
      method: 'GET',
      timeoutMs: 6000
    });
    if (res.statusCode === 200 && res.json && res.json.status === 'success') {
      return {
        city: [res.json.city, res.json.country].filter(Boolean).join(', '),
        lat: Number(res.json.lat),
        lon: Number(res.json.lon),
        ip: res.json.query
      };
    }
    throw new Error('自动定位失败，请手动输入本机城市与经纬度');
  }
}

module.exports = { ThreeXuiClient };
