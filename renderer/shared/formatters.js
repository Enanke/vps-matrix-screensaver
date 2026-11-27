(function (global) {
  function formatBytes(bytes, decimals = 2) {
    const val = Number(bytes) || 0;
    if (val <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(val) / Math.log(1024)));
    const num = val / Math.pow(1024, i);
    return `${num.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
  }

  function formatSpeed(bytesPerSec) {
    const val = Number(bytesPerSec) || 0;
    if (val < 1024) return `${Math.round(val)} B/s`;
    if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} KB/s`;
    if (val < 1024 * 1024 * 1024) return `${(val / (1024 * 1024)).toFixed(2)} MB/s`;
    return `${(val / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
  }

  function formatMbps(bytesPerSec) {
    const val = (Number(bytesPerSec) || 0) * 8 / 1e6;
    return `${val.toFixed(1)} Mbps`;
  }

  function formatUptime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function formatClock(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return {
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      weekday: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]
    };
  }

  function maskIpAddress(ip, shouldMask) {
    if (!ip) return '--.--.--.--';
    if (!shouldMask) return ip;
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
    }
    if (ip.includes(':')) {
      return ip.slice(0, 10) + '::****';
    }
    return ip;
  }

  function makeAsciiBar(pct, width = 20) {
    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    const filled = Math.round((clamped / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
  }

  global.Formatters = {
    formatBytes,
    formatSpeed,
    formatMbps,
    formatUptime,
    formatClock,
    maskIpAddress,
    makeAsciiBar
  };
})(window);
