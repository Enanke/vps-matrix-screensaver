const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  // 3x-ui connection settings
  panel: {
    enabled: false,
    url: '',               // e.g. https://la.example.com:2053/secretpath
    username: '',
    password: '',
    twoFactorCode: '',
    apiToken: '',          // optional Bearer token if panel uses API token
    ignoreTlsErrors: false, // opt in only for a self-signed panel
    pollIntervalMs: 3000,
    probePort: 0           // 0 = use panel URL port for TCP latency probe
  },
  // Display metadata for Los Angeles VPS & local machine
  node: {
    name: 'LAX-EDGE-01',
    locationLabel: 'Los Angeles, CA · US',
    provider: 'Los Angeles VPS',
    hostOverride: '',      // optional display IP override
    maskIp: false,
    lat: 34.0522,
    lon: -118.2437,
    speedTestUrl: 'https://speed.cloudflare.com/__down?bytes=15000000',
    speedTestLabel: '15 MB 轻测'
  },
  local: {
    label: '我的电脑',
    city: 'Hohhot, CN',
    lat: 40.8426,
    lon: 111.7492
  },
  // Screensaver trigger & behavior
  screensaver: {
    enabled: true,
    idleSeconds: 300,           // default 5 minutes
    exitMode: 'interactive',    // 'interactive' (ESC / double-click empty) | 'hybrid' | 'classic'
    pauseOnFullscreen: true,    // don't trigger during fullscreen video / gaming
    launchAtStartup: false,
    minimizeToTray: true,
    hotkey: 'CommandOrControl+Alt+S'
  },
  // HVA Anti-Retention protection settings (gentle defaults since HVA rarely retains)
  antiBurnIn: {
    enabled: true,
    pixelShiftPx: 12,           // subtle drift amplitude in CSS px
    pixelShiftIntervalSec: 45,  // smooth drift step interval
    sweepIntervalMin: 8,        // phosphor dark-sweep refresh interval
    deepDimAfterMin: 30,        // dim screen after prolonged inactivity (0 = disabled)
    deepDimOpacity: 0.68,       // target brightness factor during deep dim
    crtScanlines: true
  },
  // Screen role mapping (auto-assigned by orientation unless overridden)
  displays: {
    swapScreens: false,
    mapDisplayId: null,         // null = auto (primary landscape)
    consoleDisplayId: null      // null = auto (secondary portrait)
  }
};

function deepMerge(target, source) {
  const result = { ...target };
  if (!source || typeof source !== 'object') return result;
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && target[key] && typeof target[key] === 'object') {
      result[key] = deepMerge(target[key], val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

class ConfigStore {
  constructor(userDataDir) {
    this.filePath = path.join(userDataDir, 'config.json');
    this.config = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return deepMerge(DEFAULT_CONFIG, parsed);
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to load config:', err.message);
    }
    return deepMerge(DEFAULT_CONFIG, {});
  }

  get() {
    return this.config;
  }

  update(patch) {
    this.config = deepMerge(this.config, patch);
    this.save();
    return this.config;
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ConfigStore] Failed to save config:', err.message);
    }
  }
}

module.exports = { ConfigStore, DEFAULT_CONFIG };
