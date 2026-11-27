const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vpsBridge', {
  // Telemetry & config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (patch) => ipcRenderer.invoke('config:save', patch),
  testPanelConnection: (panelPatch) => ipcRenderer.invoke('panel:test', panelPatch),
  detectLocalGeo: () => ipcRenderer.invoke('geo:detect-local'),
  getWorldGeoJson: () => ipcRenderer.invoke('map:get-world-geojson'),
  getDisplays: () => ipcRenderer.invoke('displays:list'),
  getAppState: () => ipcRenderer.invoke('app:state'),

  // Screensaver lifecycle controls
  startScreensaver: () => ipcRenderer.invoke('screensaver:start'),
  stopScreensaver: () => ipcRenderer.invoke('screensaver:stop'),
  togglePause: () => ipcRenderer.invoke('screensaver:toggle-pause'),
  openSettings: () => ipcRenderer.invoke('settings:open'),

  // On-demand speed test (triggered from LAX node card)
  runSpeedTest: () => ipcRenderer.invoke('network:speedtest'),

  // Push listeners from main process
  onTelemetry: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('telemetry:update', handler);
    return () => ipcRenderer.removeListener('telemetry:update', handler);
  },
  onConfigUpdated: (cb) => {
    const handler = (_e, cfg) => cb(cfg);
    ipcRenderer.on('config:updated', handler);
    return () => ipcRenderer.removeListener('config:updated', handler);
  },
  onSpeedTestProgress: (cb) => {
    const handler = (_e, prog) => cb(prog);
    ipcRenderer.on('network:speedtest-progress', handler);
    return () => ipcRenderer.removeListener('network:speedtest-progress', handler);
  },
  onScreensaverState: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on('screensaver:state', handler);
    return () => ipcRenderer.removeListener('screensaver:state', handler);
  }
});
