/**
 * Realistic telemetry simulator used in DEMO MODE (when 3x-ui isn't configured yet)
 * so the user can experience both screens immediately.
 */
class MockTelemetryGenerator {
  constructor() {
    this.startTime = Date.now();
    this.uptimeSec = 14 * 86400 + 7 * 3600 + 42 * 60 + 18;
    this.netSent = 418 * 1024 ** 3;  // ~418 GB
    this.netRecv = 1.24 * 1024 ** 4; // ~1.24 TB
    this.latencyHistory = [];
    this.throughputHistory = [];
    this.phase = 0;
    this.baseUsers = ['alice@lax', 'studio-mbp', 'iphone-16pro', 'home-router', 'ipad-air'];

    // Seed initial history so graphs look rich on frame 1
    for (let i = 0; i < 40; i++) {
      const rtt = Math.round(138 + Math.sin(i * 0.3) * 8 + (Math.random() - 0.5) * 6);
      this.latencyHistory.push(rtt);
      this.throughputHistory.push({
        up: Math.round((1.2 + Math.random() * 2.8) * 1024 * 1024),
        down: Math.round((4.5 + Math.random() * 14.0) * 1024 * 1024)
      });
    }
  }

  next(config) {
    this.phase += 0.28;
    const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);

    // Smooth wave + occasional burst
    const burst = Math.random() < 0.14 ? 1.8 + Math.random() * 1.4 : 1.0;
    const downBps = Math.round((5.8 + Math.sin(this.phase) * 3.2 + Math.random() * 4.5) * 1024 * 1024 * burst);
    const upBps = Math.round((1.6 + Math.cos(this.phase * 0.8) * 0.9 + Math.random() * 1.6) * 1024 * 1024 * (burst * 0.8));

    this.netRecv += downBps * 3;
    this.netSent += upBps * 3;

    const rtt = Math.max(118, Math.round(142 + Math.sin(this.phase * 0.6) * 9 + (Math.random() - 0.5) * 10));
    this.latencyHistory.push(rtt);
    if (this.latencyHistory.length > 60) this.latencyHistory.shift();

    this.throughputHistory.push({ up: upBps, down: downBps });
    if (this.throughputHistory.length > 60) this.throughputHistory.shift();

    const jitter = Math.round(
      this.latencyHistory.slice(-10).reduce((acc, v, idx, arr) => {
        if (idx === 0) return 0;
        return acc + Math.abs(v - arr[idx - 1]);
      }, 0) / Math.max(1, Math.min(9, this.latencyHistory.length - 1))
    );

    const activeCount = 3 + Math.round((Math.sin(this.phase * 0.2) + 1) * 1.3);
    const onlineUsers = this.baseUsers.slice(0, Math.min(this.baseUsers.length, activeCount));

    const cpu = Number((12.4 + Math.sin(this.phase * 0.7) * 5.2 + Math.random() * 4.8).toFixed(1));
    const memTotal = 4 * 1024 ** 3;
    const memCurrent = Math.round(memTotal * (0.34 + Math.sin(this.phase * 0.15) * 0.03));
    const diskTotal = 80 * 1024 ** 3;
    const diskCurrent = Math.round(diskTotal * 0.29);
    const swapTotal = 2 * 1024 ** 3;
    const swapCurrent = Math.round(swapTotal * 0.08);

    return {
      mode: 'demo',
      connected: true,
      error: null,
      timestamp: Date.now(),
      node: {
        name: config.node.name || 'LAX-EDGE-01',
        locationLabel: config.node.locationLabel || 'Los Angeles, CA · US',
        provider: config.node.provider || 'Los Angeles VPS (Demo)',
        ipv4: config.node.hostOverride || '45.134.212.88',
        ipv6: '2605:6400:20::a4c1',
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
        latencyMs: rtt,
        jitterMs: jitter,
        packetLossPct: 0,
        reachable: true,
        latencyHistory: [...this.latencyHistory],
        throughputHistory: [...this.throughputHistory]
      },
      system: {
        cpu,
        cpuCores: 2,
        loads: [
          Number((0.24 + Math.abs(Math.sin(this.phase * 0.4)) * 0.25).toFixed(2)),
          Number((0.31 + Math.abs(Math.cos(this.phase * 0.2)) * 0.14).toFixed(2)),
          0.28
        ],
        mem: { current: memCurrent, total: memTotal },
        swap: { current: swapCurrent, total: swapTotal },
        disk: { current: diskCurrent, total: diskTotal },
        uptime: this.uptimeSec + elapsedSec,
        tcpCount: 42 + activeCount * 9 + Math.floor(Math.random() * 8),
        udpCount: 16 + activeCount * 3 + Math.floor(Math.random() * 5),
        netIO: { up: upBps, down: downBps },
        netTraffic: { sent: this.netSent, recv: this.netRecv },
        xray: { state: 'running', version: '25.3.6', errorMsg: '' }
      },
      proxy: {
        onlineUsersCount: onlineUsers.length,
        onlineUsers,
        totalClients: 8,
        inbounds: [
          {
            id: 1,
            remark: 'LAX-VLESS-REALITY',
            protocol: 'vless',
            port: 443,
            enable: true,
            up: Math.round(182 * 1024 ** 3),
            down: Math.round(742 * 1024 ** 3),
            total: 2 * 1024 ** 4
          },
          {
            id: 2,
            remark: 'LAX-VMESS-WS',
            protocol: 'vmess',
            port: 8443,
            enable: true,
            up: Math.round(94 * 1024 ** 3),
            down: Math.round(318 * 1024 ** 3),
            total: 1 * 1024 ** 4
          },
          {
            id: 3,
            remark: 'LAX-TROJAN-GRPC',
            protocol: 'trojan',
            port: 2053,
            enable: true,
            up: Math.round(41 * 1024 ** 3),
            down: Math.round(126 * 1024 ** 3),
            total: 0
          }
        ]
      }
    };
  }
}

module.exports = { MockTelemetryGenerator };
