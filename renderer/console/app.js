(function () {
  const { formatBytes, formatSpeed, formatUptime, formatClock, makeAsciiBar } = window.Formatters;

  const els = {
    stage: document.getElementById('stage'),
    sweep: document.getElementById('phosphorSweep'),
    matrixBg: document.getElementById('matrixBg'),
    nodeTitle: document.getElementById('nodeTitle'),
    modeBadge: document.getElementById('modeBadge'),
    clockTime: document.getElementById('clockTime'),
    clockDate: document.getElementById('clockDate'),
    nodeLocation: document.getElementById('nodeLocation'),
    nodeUptime: document.getElementById('nodeUptime'),
    pvaStatus: document.getElementById('pvaStatus'),
    errorBanner: document.getElementById('errorBanner'),
    onlineUsersCount: document.getElementById('onlineUsersCount'),
    tcpCount: document.getElementById('tcpCount'),
    udpCount: document.getElementById('udpCount'),
    totalClients: document.getElementById('totalClients'),
    onlineUsersChips: document.getElementById('onlineUsersChips'),
    latencyValue: document.getElementById('latencyValue'),
    jitterValue: document.getElementById('jitterValue'),
    lossValue: document.getElementById('lossValue'),
    xrayState: document.getElementById('xrayState'),
    xrayVersion: document.getElementById('xrayVersion'),
    loadAvgText: document.getElementById('loadAvgText'),
    cpuBar: document.getElementById('cpuBar'),
    cpuPct: document.getElementById('cpuPct'),
    memBar: document.getElementById('memBar'),
    memVal: document.getElementById('memVal'),
    diskBar: document.getElementById('diskBar'),
    diskVal: document.getElementById('diskVal'),
    swapBar: document.getElementById('swapBar'),
    swapVal: document.getElementById('swapVal'),
    rxSpeed: document.getElementById('rxSpeed'),
    txSpeed: document.getElementById('txSpeed'),
    netScopeCanvas: document.getElementById('netScopeCanvas'),
    totalRx: document.getElementById('totalRx'),
    totalTx: document.getElementById('totalTx'),
    totalAll: document.getElementById('totalAll'),
    inboundsCount: document.getElementById('inboundsCount'),
    inboundsList: document.getElementById('inboundsList'),
    logStream: document.getElementById('logStream')
  };

  let currentConfig = null;
  let lastOnlineCount = null;
  let lastLatency = null;
  let lastThroughputHistory = [];
  const logBuffer = [];
  const MAX_LOGS = 22;

  function appendLog(tag, message, level = 'info') {
    const now = formatClock(new Date()).time;
    logBuffer.push({ now, tag, message, level });
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();
    els.logStream.innerHTML = logBuffer
      .map(
        (entry) =>
          `<div class="log-line ${entry.level}"><span class="ts">[${entry.now}]</span><span class="tag">[${entry.tag}]</span>${escapeHtml(entry.message)}</div>`
      )
      .join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Subtle slow matrix rain background to prevent PVA static pixel retention
  function initMatrixBackground() {
    const canvas = els.matrixBg;
    const ctx = canvas.getContext('2d');
    const chars = '01ABCDEF$#+-:';
    const fontSize = 15;
    let cols = 0;
    let drops = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.max(1, Math.floor(canvas.width / fontSize));
      drops = Array.from({ length: cols }, () => Math.random() * -60);
    }

    resize();
    window.addEventListener('resize', resize);

    let lastFrame = 0;
    function tick(ts) {
      requestAnimationFrame(tick);
      if (ts - lastFrame < 85) return; // gentle ~12fps rain, ultra low CPU
      lastFrame = ts;

      ctx.fillStyle = 'rgba(2, 5, 3, 0.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ff66';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        if (Math.random() > 0.45) {
          const ch = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        }
        drops[i] += 0.65;
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = Math.random() * -18;
        }
      }
    }
    requestAnimationFrame(tick);
  }

  // Dual-channel CRT network oscilloscope
  function renderNetScope(history) {
    const canvas = els.netScopeCanvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(100, Math.floor(rect.width * dpr));
    const h = Math.max(60, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    // Subtle oscilloscope grid
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.1)';
    ctx.lineWidth = 1;
    const rows = 4;
    for (let r = 1; r < rows; r++) {
      const y = Math.round((h / rows) * r) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    const cols = 10;
    for (let c = 1; c < cols; c++) {
      const x = Math.round((w / cols) * c) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    if (!history || history.length < 2) return;

    let maxVal = 256 * 1024; // minimum 256 KB/s ceiling so low traffic doesn't jitter wildly
    for (const pt of history) {
      if (pt.down > maxVal) maxVal = pt.down;
      if (pt.up > maxVal) maxVal = pt.up;
    }
    maxVal *= 1.15;

    const padTop = 14 * dpr;
    const padBottom = 10 * dpr;
    const plotH = h - padTop - padBottom;
    const stepX = w / (history.length - 1);

    // RX (Download) filled glowing waveform
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = idx * stepX;
      const y = h - padBottom - (pt.down / maxVal) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2 * dpr;
    ctx.shadowColor = 'rgba(0, 255, 102, 0.7)';
    ctx.shadowBlur = 8 * dpr;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineTo(w, h - padBottom);
    ctx.lineTo(0, h - padBottom);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
    grad.addColorStop(0, 'rgba(0, 255, 102, 0.28)');
    grad.addColorStop(1, 'rgba(0, 255, 102, 0.01)');
    ctx.fillStyle = grad;
    ctx.fill();

    // TX (Upload) dashed cyan-green trace
    ctx.save();
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = idx * stepX;
      const y = h - padBottom - (pt.up / maxVal) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#38f2b4';
    ctx.lineWidth = 1.6 * dpr;
    ctx.stroke();
    ctx.restore();

    // Peak scale label
    ctx.fillStyle = 'rgba(102, 255, 163, 0.65)';
    ctx.font = `${10 * dpr}px monospace`;
    ctx.fillText(`PEAK ${formatSpeed(maxVal)}`, 8 * dpr, 13 * dpr);
  }

  function updateTelemetry(data) {
    if (!data) return;

    els.nodeTitle.textContent = data.node.name || 'LAX-EDGE-01';
    els.nodeLocation.textContent = data.node.locationLabel || 'Los Angeles, CA';
    els.nodeUptime.textContent = formatUptime(data.system.uptime);

    // Status badge
    if (data.mode === 'live' && data.connected) {
      els.modeBadge.textContent = '3X-UI LIVE';
      els.modeBadge.className = 'badge badge-live';
      els.errorBanner.classList.add('hidden');
    } else if (data.mode === 'demo') {
      els.modeBadge.textContent = 'DEMO MODE';
      els.modeBadge.className = 'badge badge-demo';
      els.errorBanner.classList.add('hidden');
    } else {
      els.modeBadge.textContent = 'RECONNECTING';
      els.modeBadge.className = 'badge badge-error';
      els.errorBanner.textContent = `⚠ 3x-ui 通信异常: ${data.error || '连接超时'}`;
      els.errorBanner.classList.remove('hidden');
    }

    // Online users
    const count = data.proxy.onlineUsersCount ?? "--";
    els.onlineUsersCount.textContent = String(count);
    els.tcpCount.textContent = String(data.system.tcpCount || 0);
    els.udpCount.textContent = String(data.system.udpCount || 0);
    els.totalClients.textContent = String(data.proxy.totalClients ?? "--");

    if (data.proxy.onlineUsers && data.proxy.onlineUsers.length > 0) {
      els.onlineUsersChips.innerHTML = data.proxy.onlineUsers
        .slice(0, 12)
        .map((u) => `<span class="chip">● ${escapeHtml(u)}</span>`)
        .join('');
    } else {
      els.onlineUsersChips.innerHTML = data.proxy.onlineUsersCount === null
        ? '<span class="chip muted">ONLINE DATA UNAVAILABLE</span>'
        : '<span class="chip muted">NO ACTIVE SESSIONS</span>';
    }

    // Latency & Xray
    const rtt = data.network.latencyMs;
    els.latencyValue.textContent = rtt !== null && rtt !== undefined ? String(rtt) : 'ERR';
    els.latencyValue.className = 'hero-number';
    if (rtt === null || rtt === undefined) els.latencyValue.classList.add('danger');
    else if (rtt > 240) els.latencyValue.classList.add('warn');

    els.jitterValue.textContent = `${data.network.jitterMs ?? 0} ms`;
    els.lossValue.textContent = `${data.network.packetLossPct ?? 0}%`;

    const xrayRunning = String(data.system.xray.state || '').toLowerCase() === 'running';
    els.xrayState.textContent = (data.system.xray.state || 'UNKNOWN').toUpperCase();
    els.xrayState.className = `xray-state ${xrayRunning ? '' : 'stopped'}`;
    els.xrayVersion.textContent = data.system.xray.version ? `v${data.system.xray.version}` : 'v--';

    // Resource ASCII gauges
    const barWidth = Math.max(14, Math.min(28, Math.floor((window.innerWidth - 260) / 14)));
    const cpuPct = data.system.cpu || 0;
    els.cpuBar.textContent = makeAsciiBar(cpuPct, barWidth);
    els.cpuPct.textContent = `${cpuPct.toFixed(1)}% (${data.system.cpuCores || 1}C)`;
    els.loadAvgText.textContent = `LOAD: ${(data.system.loads || [0, 0, 0]).join(' / ')}`;

    const memPct = data.system.mem.total > 0 ? (data.system.mem.current / data.system.mem.total) * 100 : 0;
    els.memBar.textContent = makeAsciiBar(memPct, barWidth);
    els.memVal.textContent = `${formatBytes(data.system.mem.current, 1)} / ${formatBytes(data.system.mem.total, 1)}`;

    const diskPct = data.system.disk.total > 0 ? (data.system.disk.current / data.system.disk.total) * 100 : 0;
    els.diskBar.textContent = makeAsciiBar(diskPct, barWidth);
    els.diskVal.textContent = `${formatBytes(data.system.disk.current, 1)} / ${formatBytes(data.system.disk.total, 0)}`;

    const swapPct = data.system.swap.total > 0 ? (data.system.swap.current / data.system.swap.total) * 100 : 0;
    els.swapBar.textContent = makeAsciiBar(swapPct, barWidth);
    els.swapVal.textContent = data.system.swap.total > 0
      ? `${formatBytes(data.system.swap.current, 1)} / ${formatBytes(data.system.swap.total, 1)}`
      : 'DISABLED';

    // Network I/O + Traffic totals
    els.rxSpeed.textContent = formatSpeed(data.system.netIO.down);
    els.txSpeed.textContent = formatSpeed(data.system.netIO.up);
    els.totalRx.textContent = formatBytes(data.system.netTraffic.recv);
    els.totalTx.textContent = formatBytes(data.system.netTraffic.sent);
    els.totalAll.textContent = formatBytes(
      (data.system.netTraffic.recv || 0) + (data.system.netTraffic.sent || 0)
    );

    lastThroughputHistory = data.network.throughputHistory || [];
    renderNetScope(lastThroughputHistory);

    // Inbounds
    const inbounds = data.proxy.inbounds || [];
    els.inboundsCount.textContent = `${inbounds.filter((i) => i.enable).length} / ${inbounds.length} ACTIVE`;
    if (data.proxy.inboundsAvailable === false) {
      els.inboundsCount.textContent = '--';
      els.inboundsList.innerHTML = '<div class="empty-row">INBOUND DATA UNAVAILABLE</div>';
    } else if (inbounds.length === 0) {
      els.inboundsList.innerHTML = '<div class="empty-row">NO INBOUNDS REPORTED BY 3X-UI</div>';
    } else {
      els.inboundsList.innerHTML = inbounds
        .slice(0, 6)
        .map(
          (ib) => `
          <div class="inbound-row">
            <span class="inbound-name">${escapeHtml(ib.remark)}</span>
            <span class="inbound-proto">${escapeHtml(ib.protocol)}</span>
            <span class="inbound-port">:${ib.port}</span>
            <span class="inbound-traffic">↓${formatBytes(ib.down, 1)} ↑${formatBytes(ib.up, 1)}</span>
          </div>`
        )
        .join('');
    }

    // Meaningful terminal log events
    if (data.error) {
      appendLog('ERR', data.error, 'err');
    } else {
      if (lastOnlineCount !== null && lastOnlineCount !== count) {
        appendLog(
          'USERS',
          `Active proxy sessions changed: ${lastOnlineCount} -> ${count} (${(data.proxy.onlineUsers || []).join(', ') || 'none'})`,
          'info'
        );
      } else if (lastLatency !== null && rtt !== null && Math.abs(rtt - lastLatency) >= 20) {
        appendLog('LINK', `RTT shift detected: ${lastLatency}ms -> ${rtt}ms (jitter ${data.network.jitterMs}ms)`, 'warn');
      } else {
        appendLog(
          'SYNC',
          `RX ${formatSpeed(data.system.netIO.down)} | TX ${formatSpeed(data.system.netIO.up)} | RTT ${rtt ?? '--'}ms | CPU ${cpuPct}%`,
          'info'
        );
      }
    }
    lastOnlineCount = count;
    lastLatency = rtt;
  }

  // Clock ticker
  function startClock() {
    const update = () => {
      const c = formatClock(new Date());
      els.clockTime.textContent = c.time;
      els.clockDate.textContent = `${c.date} ${c.weekday}`;
    };
    update();
    setInterval(update, 1000);
  }

  // Exit behavior (Interactive mode: ESC or double-click)
  function bindExitHandlers() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.vpsBridge.stopScreensaver();
      } else if (currentConfig && currentConfig.screensaver.exitMode === 'classic') {
        window.vpsBridge.stopScreensaver();
      }
    });

    document.addEventListener('dblclick', () => {
      window.vpsBridge.stopScreensaver();
    });
  }

  async function init() {
    initMatrixBackground();
    startClock();
    bindExitHandlers();

    appendLog('BOOT', 'LAX-NODE Telemetry Console initialized (Portrait 10:16 CRT profile)', 'info');
    appendLog('HVA-GUARD', 'Gentle pixel shift & periodic dark-sweep protection armed', 'info');

    const pva = new window.PVAAntiBurnInEngine({
      stageElement: els.stage,
      sweepElement: els.sweep,
      onShiftUpdate: (dx, dy) => {
        els.pvaStatus.textContent = `SHIFT ${dx >= 0 ? '+' : ''}${dx},${dy >= 0 ? '+' : ''}${dy}`;
      },
      onDimChange: (dimmed) => {
        if (dimmed) appendLog('HVA-GUARD', 'Deep dim engaged to protect HVA display', 'info');
      }
    });

    currentConfig = await window.vpsBridge.getConfig();
    pva.applyConfig(currentConfig.antiBurnIn);

    window.vpsBridge.onConfigUpdated((cfg) => {
      currentConfig = cfg;
      pva.applyConfig(cfg.antiBurnIn);
    });

    window.vpsBridge.onTelemetry((data) => updateTelemetry(data));

    window.addEventListener('resize', () => renderNetScope(lastThroughputHistory));
  }

  init();
})();
