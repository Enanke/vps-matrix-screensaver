const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFile } = require('child_process');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  screen,
  powerMonitor,
  globalShortcut,
  nativeImage
} = require('electron');

const { ConfigStore } = require('./configStore');
const { ThreeXuiClient } = require('./threeXuiClient');
const { MockTelemetryGenerator } = require('./mockTelemetry');

let configStore = null;
let xuiClient = null;
let mockGenerator = null;

let tray = null;
let settingsWindow = null;
let screensaverWindows = [];
let isScreensaverActive = false;
let isPaused = false;
let isQuitting = false;
let isSpeedTesting = false;
let lastTelemetry = null;
let pollTimer = null;
let activePollClient = null;
let idleTimer = null;
let worldGeoJsonCache = null;
let lastScreensaverStopAt = 0;

// Keep Windows releases on the original profile regardless of productName.
if (process.platform === 'win32') {
  const userDataDir = path.join(app.getPath('appData'), 'vps-matrix-screensaver');
  fs.mkdirSync(userDataDir, { recursive: true });
  app.setPath('userData', userDataDir);
  if (app.isPackaged) app.setAppUserModelId('com.vpsmatrix.screensaver');
}

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

/**
 * Create a crisp 32x32 green phosphor radar tray icon programmatically (valid PNG)
 * so there is zero external binary asset dependency.
 */
function createTrayIcon(paused = false) {
  const size = 32;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // PNG filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      if (dist <= 15) {
        // Dark circular background
        r = 3;
        g = 16;
        b = 9;
        a = 245;

        const accentR = paused ? 245 : 0;
        const accentG = paused ? 185 : 255;
        const accentB = paused ? 66 : 110;

        // Outer ring
        if (dist >= 12.8 && dist <= 14.8) {
          r = accentR;
          g = accentG;
          b = accentB;
          a = 255;
        } else if (Math.abs(dist - 7.5) < 0.9) {
          // Inner radar ring
          r = Math.round(accentR * 0.65);
          g = Math.round(accentG * 0.65);
          b = Math.round(accentB * 0.65);
          a = 220;
        } else if (Math.abs(dx) < 0.7 || Math.abs(dy) < 0.7) {
          // Crosshair
          r = Math.round(accentR * 0.45);
          g = Math.round(accentG * 0.45);
          b = Math.round(accentB * 0.45);
          a = 170;
        }
        // Center dot + sweep beam
        if (dist <= 2.6 || (dx > 0 && dy < 0 && Math.abs(dx + dy) < 1.3)) {
          r = accentR;
          g = accentG;
          b = accentB;
          a = 255;
        }
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);

  return nativeImage.createFromBuffer(png);
}

/**
 * Windows fullscreen / presentation / D3D game check via SHQueryUserNotificationState
 * Only called right when idle threshold is reached so normal overhead is zero.
 */
function isWindowsFullscreenBusy() {
  if (process.platform !== 'win32') return Promise.resolve(false);
  return new Promise((resolve) => {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class UserNotif {
  [DllImport("shell32.dll")]
  public static extern int SHQueryUserNotificationState(out int pquns);
}
"@
$state = 0
[UserNotif]::SHQueryUserNotificationState([ref]$state) | Out-Null
Write-Output $state
`;
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 3000, windowsHide: true },
      (err, stdout) => {
        if (err) return resolve(false);
        const state = Number(String(stdout || '').trim());
        // 2 = QUNS_BUSY (fullscreen app), 3 = QUNS_RUNNING_D3D_FULL_SCREEN, 4 = QUNS_PRESENTATION_MODE
        resolve(state === 2 || state === 3 || state === 4);
      }
    );
  });
}

/**
 * Load Natural Earth 110m countries GeoJSON once from bundled world-atlas package (100% offline).
 */
function loadWorldGeoJson() {
  if (worldGeoJsonCache) return worldGeoJsonCache;
  try {
    const topojson = require('topojson-client');
    const countriesAtlas = require('world-atlas/countries-110m.json');
    worldGeoJsonCache = topojson.feature(countriesAtlas, countriesAtlas.objects.countries);
    return worldGeoJsonCache;
  } catch (err) {
    console.error('[Map] Failed to load world-atlas:', err.message);
    return { type: 'FeatureCollection', features: [] };
  }
}

/**
 * Determine which monitor gets the World Map (landscape primary) and which gets the Console (portrait secondary).
 */
function resolveDisplayAssignments() {
  const config = configStore.get();
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  const annotated = displays.map((d) => {
    const physWidth = Math.round(d.bounds.width * d.scaleFactor);
    const physHeight = Math.round(d.bounds.height * d.scaleFactor);
    const isPortrait = d.bounds.height > d.bounds.width;
    return {
      id: d.id,
      label: d.label || (d.id === primary.id ? '主显示器' : '副显示器'),
      primary: d.id === primary.id,
      bounds: d.bounds,
      scaleFactor: d.scaleFactor,
      rotation: d.rotation,
      physWidth,
      physHeight,
      orientation: isPortrait ? 'portrait' : 'landscape'
    };
  });

  if (annotated.length === 1) {
    return {
      displays: annotated,
      assignments: [{ display: annotated[0], role: config.displays.swapScreens ? 'console' : 'map' }]
    };
  }

  // Prefer portrait secondary for console, landscape primary for map
  let mapDisplay = annotated.find((d) => d.id === config.displays.mapDisplayId)
    || annotated.find((d) => d.primary && d.orientation === 'landscape')
    || annotated.find((d) => d.orientation === 'landscape')
    || annotated[0];

  let consoleDisplay = annotated.find((d) => d.id === config.displays.consoleDisplayId && d.id !== mapDisplay.id)
    || annotated.find((d) => d.id !== mapDisplay.id && d.orientation === 'portrait')
    || annotated.find((d) => d.id !== mapDisplay.id);

  if (config.displays.swapScreens && consoleDisplay) {
    const tmp = mapDisplay;
    mapDisplay = consoleDisplay;
    consoleDisplay = tmp;
  }

  const assignments = [];
  if (mapDisplay) assignments.push({ display: mapDisplay, role: 'map' });
  if (consoleDisplay) assignments.push({ display: consoleDisplay, role: 'console' });

  // If user has 3+ monitors, assign any extra monitors to console view so all screens get burn-in protection
  for (const d of annotated) {
    if (d.id !== (mapDisplay && mapDisplay.id) && d.id !== (consoleDisplay && consoleDisplay.id)) {
      assignments.push({ display: d, role: 'console' });
    }
  }

  return { displays: annotated, assignments };
}

function broadcast(channel, payload) {
  for (const win of screensaverWindows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(channel, payload);
  }
}

function createScreensaverWindow(display, role) {
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#020503',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    focusable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  // Explicitly assert bounds for Windows mixed-DPI multi-monitor accuracy
  win.setBounds(display.bounds);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const htmlFile = role === 'map'
    ? path.join(__dirname, '..', 'renderer', 'map', 'index.html')
    : path.join(__dirname, '..', 'renderer', 'console', 'index.html');

  win.loadFile(htmlFile);

  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    // Re-apply bounds before and right after show() to neutralize Windows DPI jump
    win.setBounds(display.bounds);
    win.show();
    win.setAlwaysOnTop(true, 'screen-saver');
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setBounds(display.bounds);
      }
    }, 80);

    if (lastTelemetry) {
      win.webContents.send('telemetry:update', lastTelemetry);
    }
  });

  win.on('closed', () => {
    screensaverWindows = screensaverWindows.filter((w) => w !== win);
    if (screensaverWindows.length === 0 && isScreensaverActive) {
      cleanupScreensaverState();
    }
  });

  return win;
}

function startScreensaver() {
  if (isScreensaverActive) return;
  isScreensaverActive = true;

  const { assignments } = resolveDisplayAssignments();
  screensaverWindows = assignments.map(({ display, role }) => createScreensaverWindow(display, role));

  // Focus the map window so keyboard events / clicks feel immediate
  const mapIdx = assignments.findIndex((a) => a.role === 'map');
  if (mapIdx >= 0 && screensaverWindows[mapIdx]) {
    screensaverWindows[mapIdx].once('show', () => {
      if (screensaverWindows[mapIdx] && !screensaverWindows[mapIdx].isDestroyed()) {
        screensaverWindows[mapIdx].focus();
      }
    });
  }

  // Register global ESC shortcut while active so ESC reliably closes BOTH monitors
  try {
    globalShortcut.register('Escape', () => {
      if (isScreensaverActive) stopScreensaver();
    });
  } catch (err) {
    console.warn('[Shortcut] Unable to register Escape:', err.message);
  }

  // Trigger an immediate fresh telemetry poll
  pollTelemetryOnce();
  updateTrayMenu();
  broadcast('screensaver:state', getAppState());
}

function cleanupScreensaverState() {
  isScreensaverActive = false;
  lastScreensaverStopAt = Date.now();
  try {
    globalShortcut.unregister('Escape');
  } catch (_) {}
  updateTrayMenu();
  broadcast('screensaver:state', getAppState());
}

function stopScreensaver() {
  if (!isScreensaverActive && screensaverWindows.length === 0) return;
  const toClose = [...screensaverWindows];
  screensaverWindows = [];
  for (const win of toClose) {
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  }
  cleanupScreensaverState();
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 1020,
    height: 760,
    minWidth: 880,
    minHeight: 640,
    title: 'VPS Matrix Screensaver · 控制中心',
    backgroundColor: '#050a07',
    autoHideMenuBar: true,
    icon: createTrayIcon(false),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));

  settingsWindow.on('close', (e) => {
    const cfg = configStore.get();
    if (!isQuitting && cfg.screensaver.minimizeToTray) {
      e.preventDefault();
      settingsWindow.hide();
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

function getAppState() {
  const cfg = configStore.get();
  return {
    isScreensaverActive,
    isPaused,
    idleSeconds: powerMonitor.getSystemIdleTime(),
    triggerSeconds: cfg.screensaver.idleSeconds,
    mode: cfg.panel.enabled && cfg.panel.url ? 'live' : 'demo',
    isSpeedTesting
  };
}

function updateTrayMenu() {
  if (!tray) return;
  const cfg = configStore.get();
  tray.setImage(createTrayIcon(isPaused));
  tray.setToolTip(
    `VPS Matrix Screensaver (${isPaused ? '已暂停' : `闲置 ${cfg.screensaver.idleSeconds}s 自动启动`})`
  );

  const menu = Menu.buildFromTemplate([
    {
      label: isScreensaverActive ? '退出双屏屏保 (ESC)' : '立即启动双屏屏保',
      click: () => (isScreensaverActive ? stopScreensaver() : startScreensaver())
    },
    {
      label: isPaused ? '恢复自动触发' : '暂停自动触发',
      click: () => {
        isPaused = !isPaused;
        updateTrayMenu();
        broadcast('screensaver:state', getAppState());
      }
    },
    { type: 'separator' },
    {
      label: '打开设置与控制中心',
      click: () => createSettingsWindow()
    },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: Boolean(cfg.screensaver.launchAtStartup),
      click: (item) => {
        configStore.update({ screensaver: { launchAtStartup: item.checked } });
        applyStartupSetting(item.checked);
        broadcast('config:updated', configStore.get());
      }
    },
    { type: 'separator' },
    {
      label: '退出程序',
      click: () => {
        isQuitting = true;
        stopScreensaver();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
}

function applyStartupSetting(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      args: ['--background'],
      // Electron 35 writes the path and arguments directly to the Windows Run value.
      ...(process.platform === 'win32' && app.isPackaged ? { path: `"${process.execPath}"` } : {})
    });
  } catch (err) {
    console.warn('[Startup] Failed to update login item settings:', err.message);
  }
}

function registerTriggerHotkey() {
  try {
    globalShortcut.unregisterAll();
  } catch (_) {}

  const cfg = configStore.get();
  const hotkey = cfg.screensaver.hotkey || 'CommandOrControl+Alt+S';
  try {
    globalShortcut.register(hotkey, () => {
      if (isScreensaverActive) {
        stopScreensaver();
      } else {
        startScreensaver();
      }
    });
  } catch (err) {
    console.warn('[Shortcut] Unable to register trigger hotkey:', err.message);
  }
  if (isScreensaverActive) {
    try {
      globalShortcut.register('Escape', () => {
        if (isScreensaverActive) stopScreensaver();
      });
    } catch (_) {}
  }
}

async function pollTelemetryOnce() {
  const cfg = configStore.get();
  const shouldUseLive = Boolean(cfg.panel.enabled && cfg.panel.url && cfg.panel.url.trim());

  if (!shouldUseLive) {
    lastTelemetry = mockGenerator.next(cfg);
    broadcast('telemetry:update', lastTelemetry);
    return;
  }

  const client = xuiClient;
  if (activePollClient === client) return;
  activePollClient = client;
  try {
    const snapshot = await client.fetchSnapshot(cfg);
    if (client !== xuiClient) return;
    lastTelemetry = snapshot;
    broadcast('telemetry:update', snapshot);
  } catch (err) {
    if (client !== xuiClient) return;
    // Keep last known metrics while clearly surfacing the live error
    const fallback = lastTelemetry && lastTelemetry.mode === 'live'
      ? {
          ...lastTelemetry,
          connected: false,
          error: err.message || '连接 3x-ui 面板失败',
          timestamp: Date.now()
        }
      : {
          ...mockGenerator.next(cfg),
          mode: 'live-error',
          connected: false,
          error: err.message || '连接 3x-ui 面板失败',
          timestamp: Date.now()
        };
    lastTelemetry = fallback;
    broadcast('telemetry:update', fallback);
  } finally {
    if (activePollClient === client) activePollClient = null;
  }
}

function restartTelemetryLoop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  const cfg = configStore.get();
  const intervalMs = Math.max(1500, Math.min(30000, Number(cfg.panel.pollIntervalMs) || 3000));

  pollTelemetryOnce();
  pollTimer = setInterval(() => {
    // Poll actively when screensaver OR settings window is visible; save resources when fully hidden in tray
    const settingsVisible = Boolean(settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible());
    if (isScreensaverActive || settingsVisible) {
      pollTelemetryOnce();
    }
  }, intervalMs);
}

function startIdleMonitor() {
  if (idleTimer) clearInterval(idleTimer);
  let checkingFullscreen = false;

  idleTimer = setInterval(async () => {
    const cfg = configStore.get();
    if (!cfg.screensaver.enabled || isPaused || isScreensaverActive || checkingFullscreen) {
      return;
    }

    // Small 5-second grace period after manually exiting screensaver
    if (Date.now() - lastScreensaverStopAt < 5000) {
      return;
    }

    const idleSec = powerMonitor.getSystemIdleTime();
    const thresholdSec = Math.max(10, Number(cfg.screensaver.idleSeconds) || 300);

    if (idleSec >= thresholdSec) {
      if (cfg.screensaver.pauseOnFullscreen) {
        checkingFullscreen = true;
        const busy = await isWindowsFullscreenBusy();
        checkingFullscreen = false;
        if (busy) return;
      }
      // Re-verify user didn't move mouse during async check
      if (powerMonitor.getSystemIdleTime() >= thresholdSec && !isScreensaverActive && !isPaused) {
        startScreensaver();
      }
    }
  }, 1000);
}

function setupIpcHandlers() {
  ipcMain.handle('config:get', () => configStore.get());

  ipcMain.handle('config:save', (_e, patch) => {
    const prev = configStore.get();
    const updated = configStore.update(patch);

    if (updated.panel !== prev.panel) {
      xuiClient = new ThreeXuiClient();
      lastTelemetry = null;
    }
    if (patch.screensaver && patch.screensaver.launchAtStartup !== undefined) {
      applyStartupSetting(updated.screensaver.launchAtStartup);
    }
    registerTriggerHotkey();
    restartTelemetryLoop();
    updateTrayMenu();
    broadcast('config:updated', updated);
    broadcast('screensaver:state', getAppState());
    return updated;
  });

  ipcMain.handle('panel:test', async (_e, panelPatch) => {
    const cfg = configStore.get();
    const mergedCfg = {
      ...cfg,
      panel: { ...cfg.panel, ...(panelPatch || {}), enabled: true }
    };
    const tester = new ThreeXuiClient();
    try {
      const snap = await tester.fetchSnapshot(mergedCfg);
      return {
        ok: true,
        latencyMs: snap.network.latencyMs,
        onlineUsers: snap.proxy.onlineUsersCount,
        warnings: snap.proxy.warnings,
        inboundsCount: snap.proxy.inbounds.length,
        cpu: snap.system.cpu,
        xrayState: snap.system.xray.state,
        xrayVersion: snap.system.xray.version,
        ipv4: snap.node.ipv4
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || '连接失败'
      };
    }
  });

  ipcMain.handle('geo:detect-local', async () => {
    try {
      const geo = await xuiClient.detectLocalGeo();
      return { ok: true, ...geo };
    } catch (err) {
      return { ok: false, error: err.message || '定位失败' };
    }
  });

  ipcMain.handle('map:get-world-geojson', () => loadWorldGeoJson());

  ipcMain.handle('displays:list', () => resolveDisplayAssignments());

  ipcMain.handle('app:state', () => getAppState());

  ipcMain.handle('screensaver:start', () => {
    startScreensaver();
    return { ok: true };
  });

  ipcMain.handle('screensaver:stop', () => {
    stopScreensaver();
    return { ok: true };
  });

  ipcMain.handle('screensaver:toggle-pause', () => {
    isPaused = !isPaused;
    updateTrayMenu();
    broadcast('screensaver:state', getAppState());
    return { isPaused };
  });

  ipcMain.handle('settings:open', () => {
    stopScreensaver();
    createSettingsWindow();
    return { ok: true };
  });

  ipcMain.handle('network:speedtest', async () => {
    if (isSpeedTesting) return { ok: false, error: '测速正在进行中' };
    isSpeedTesting = true;
    broadcast('screensaver:state', getAppState());
    const cfg = configStore.get();
    try {
      const result = await xuiClient.runSpeedTest(
        cfg.node.speedTestUrl,
        (prog) => broadcast('network:speedtest-progress', prog),
        cfg.panel.ignoreTlsErrors !== false
      );
      return { ok: true, ...result };
    } catch (err) {
      broadcast('network:speedtest-progress', { error: err.message || '测速失败', done: true });
      return { ok: false, error: err.message || '测速失败' };
    } finally {
      isSpeedTesting = false;
      broadcast('screensaver:state', getAppState());
    }
  });
}

app.on('second-instance', () => {
  createSettingsWindow();
});

app.whenReady().then(() => {
  configStore = new ConfigStore(app.getPath('userData'));
  if (process.platform === 'win32' && app.isPackaged && configStore.get().screensaver.launchAtStartup &&
      !app.getLoginItemSettings({ path: `"${process.execPath}"`, args: ['--background'] }).openAtLogin) {
    applyStartupSetting(true);
  }
  xuiClient = new ThreeXuiClient();
  mockGenerator = new MockTelemetryGenerator();

  setupIpcHandlers();
  registerTriggerHotkey();
  restartTelemetryLoop();
  startIdleMonitor();

  tray = new Tray(createTrayIcon(false));
  tray.on('double-click', () => createSettingsWindow());
  updateTrayMenu();

  // Re-evaluate displays if user plugs/unplugs a monitor
  screen.on('display-added', () => broadcast('displays:changed', resolveDisplayAssignments()));
  screen.on('display-removed', () => broadcast('displays:changed', resolveDisplayAssignments()));
  screen.on('display-metrics-changed', () => broadcast('displays:changed', resolveDisplayAssignments()));

  const isBackgroundLaunch = process.argv.includes('--background');
  const isPreviewLaunch = process.argv.includes('--preview');

  if (isPreviewLaunch) {
    startScreensaver();
  } else if (!isBackgroundLaunch) {
    createSettingsWindow();
  }
});

app.on('window-all-closed', (e) => {
  // Keep alive in system tray
  if (!isQuitting) {
    e.preventDefault();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (pollTimer) clearInterval(pollTimer);
  if (idleTimer) clearInterval(idleTimer);
});
