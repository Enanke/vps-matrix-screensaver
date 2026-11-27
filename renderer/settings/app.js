(function () {
  const { formatSpeed } = window.Formatters;
  const $ = (id) => document.getElementById(id);

  let currentConfig = null;
  let currentState = null;

  // Tab switching
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  function populateForm(cfg) {
    currentConfig = cfg;

    // 3x-ui Panel
    $('panelEnabled').checked = Boolean(cfg.panel.enabled);
    $('panelUrl').value = cfg.panel.url || '';
    $('panelUsername').value = cfg.panel.username || '';
    $('panelPassword').value = cfg.panel.password || '';
    $('panelApiToken').value = cfg.panel.apiToken || '';
    $('panelTwoFactor').value = cfg.panel.twoFactorCode || '';
    $('pollIntervalSec').value = Math.round((cfg.panel.pollIntervalMs || 3000) / 1000);
    $('probePort').value = cfg.panel.probePort || 0;
    $('ignoreTlsErrors').checked = cfg.panel.ignoreTlsErrors !== false;

    // Node & Local
    $('nodeName').value = cfg.node.name || 'LAX-EDGE-01';
    $('nodeLocation').value = cfg.node.locationLabel || 'Los Angeles, CA · US';
    $('nodeProvider').value = cfg.node.provider || 'Los Angeles VPS';
    $('nodeHostOverride').value = cfg.node.hostOverride || '';
    $('nodeLat').value = cfg.node.lat ?? 34.0522;
    $('nodeLon').value = cfg.node.lon ?? -118.2437;
    $('speedTestUrl').value = cfg.node.speedTestUrl || '';
    $('maskIp').checked = Boolean(cfg.node.maskIp);

    $('localLabel').value = cfg.local.label || '我的电脑';
    $('localCity').value = cfg.local.city || 'Hohhot, CN';
    $('localLat').value = cfg.local.lat ?? 40.8426;
    $('localLon').value = cfg.local.lon ?? 111.7492;

    // Screensaver
    const sec = Number(cfg.screensaver.idleSeconds) || 300;
    if (sec >= 60 && sec % 60 === 0) {
      $('idleUnit').value = '60';
      $('idleValue').value = sec / 60;
    } else {
      $('idleUnit').value = '1';
      $('idleValue').value = sec;
    }
    $('exitMode').value = cfg.screensaver.exitMode || 'interactive';
    $('hotkey').value = cfg.screensaver.hotkey || 'CommandOrControl+Alt+S';
    $('screensaverEnabled').checked = cfg.screensaver.enabled !== false;
    $('pauseOnFullscreen').checked = cfg.screensaver.pauseOnFullscreen !== false;
    $('launchAtStartup').checked = Boolean(cfg.screensaver.launchAtStartup);
    $('minimizeToTray').checked = cfg.screensaver.minimizeToTray !== false;

    // Anti-retention (HVA)
    $('antiBurnInEnabled').checked = cfg.antiBurnIn.enabled !== false;
    $('pixelShiftPx').value = cfg.antiBurnIn.pixelShiftPx ?? 12;
    $('pixelShiftIntervalSec').value = cfg.antiBurnIn.pixelShiftIntervalSec ?? 45;
    $('sweepIntervalMin').value = cfg.antiBurnIn.sweepIntervalMin ?? 8;
    $('deepDimAfterMin').value = cfg.antiBurnIn.deepDimAfterMin ?? 30;
    $('crtScanlines').checked = cfg.antiBurnIn.crtScanlines !== false;

    // Displays
    $('swapScreens').checked = Boolean(cfg.displays.swapScreens);

    updateSummaryStrip();
  }

  function collectPatch() {
    const unit = Number($('idleUnit').value) || 60;
    const rawIdle = Math.max(1, Number($('idleValue').value) || 5);
    const idleSeconds = Math.max(10, rawIdle * unit);

    return {
      panel: {
        enabled: $('panelEnabled').checked,
        url: $('panelUrl').value.trim(),
        username: $('panelUsername').value.trim(),
        password: $('panelPassword').value,
        apiToken: $('panelApiToken').value.trim(),
        twoFactorCode: $('panelTwoFactor').value.trim(),
        pollIntervalMs: Math.max(2, Number($('pollIntervalSec').value) || 3) * 1000,
        probePort: Math.max(0, Number($('probePort').value) || 0),
        ignoreTlsErrors: $('ignoreTlsErrors').checked
      },
      node: {
        name: $('nodeName').value.trim() || 'LAX-EDGE-01',
        locationLabel: $('nodeLocation').value.trim() || 'Los Angeles, CA · US',
        provider: $('nodeProvider').value.trim() || 'Los Angeles VPS',
        hostOverride: $('nodeHostOverride').value.trim(),
        lat: Number($('nodeLat').value),
        lon: Number($('nodeLon').value),
        speedTestUrl: $('speedTestUrl').value.trim(),
        maskIp: $('maskIp').checked
      },
      local: {
        label: $('localLabel').value.trim() || '我的电脑',
        city: $('localCity').value.trim() || 'Hohhot, CN',
        lat: Number($('localLat').value),
        lon: Number($('localLon').value)
      },
      screensaver: {
        enabled: $('screensaverEnabled').checked,
        idleSeconds,
        exitMode: $('exitMode').value,
        pauseOnFullscreen: $('pauseOnFullscreen').checked,
        launchAtStartup: $('launchAtStartup').checked,
        minimizeToTray: $('minimizeToTray').checked,
        hotkey: $('hotkey').value.trim() || 'CommandOrControl+Alt+S'
      },
      antiBurnIn: {
        enabled: $('antiBurnInEnabled').checked,
        pixelShiftPx: Math.max(0, Number($('pixelShiftPx').value) || 12),
        pixelShiftIntervalSec: Math.max(10, Number($('pixelShiftIntervalSec').value) || 45),
        sweepIntervalMin: Math.max(0, Number($('sweepIntervalMin').value) || 0),
        deepDimAfterMin: Math.max(0, Number($('deepDimAfterMin').value) || 0),
        crtScanlines: $('crtScanlines').checked
      },
      displays: {
        swapScreens: $('swapScreens').checked
      }
    };
  }

  function updateSummaryStrip() {
    if (!currentConfig) return;
    const isLive = Boolean(currentConfig.panel.enabled && currentConfig.panel.url);
    $('liveModeText').textContent = isLive ? '3X-UI 真实数据' : 'DEMO 演示模式';
    $('liveModeText').className = `stat-val ${isLive ? 'ok' : 'warn'}`;

    const sec = currentConfig.screensaver.idleSeconds;
    const paused = currentState && currentState.isPaused;
    if (!currentConfig.screensaver.enabled || paused) {
      $('triggerSummary').textContent = paused ? '已临时暂停' : '自动触发已关闭';
      $('triggerSummary').className = 'stat-val warn';
    } else {
      const label = sec >= 60 && sec % 60 === 0 ? `${sec / 60} 分钟` : `${sec} 秒`;
      $('triggerSummary').textContent = `闲置 ${label} 自动弹出`;
      $('triggerSummary').className = 'stat-val ok';
    }

    $('hotkeySummary').textContent = (currentConfig.screensaver.hotkey || 'Ctrl+Alt+S').replace(
      'CommandOrControl',
      'Ctrl'
    );

    if (currentState) {
      $('togglePauseBtn').textContent = currentState.isPaused ? '▶ 恢复自动触发' : '⏸ 暂停自动触发';
    }
  }

  async function renderDisplays() {
    const { displays, assignments } = await window.vpsBridge.getDisplays();
    const roleMap = new Map(assignments.map((a) => [a.display.id, a.role]));
    $('displaysGrid').innerHTML = displays
      .map((d, idx) => {
        const role = roleMap.get(d.id) || 'console';
        const roleLabel = role === 'map' ? '世界地图 + 跨洋光桥' : '复古黑绿控制台';
        return `
          <div class="display-card">
            <div class="display-top">
              <strong>显示器 #${idx + 1} ${d.primary ? '(主屏)' : '(副屏)'}</strong>
              <span class="display-role ${role}">${roleLabel}</span>
            </div>
            <div class="display-specs">
              <span>物理分辨率：<strong>${d.physWidth} × ${d.physHeight}</strong> (${d.orientation === 'portrait' ? '竖屏' : '横屏'})</span>
              <span>逻辑尺寸：<strong>${d.bounds.width} × ${d.bounds.height}</strong> · 缩放 ${Math.round(d.scaleFactor * 100)}%</span>
              <span>虚拟位置：<strong>(${d.bounds.x}, ${d.bounds.y})</strong> · 旋转 ${d.rotation}°</span>
            </div>
          </div>`;
      })
      .join('');
  }

  function showToast(msg) {
    $('saveToast').textContent = msg;
    setTimeout(() => {
      if ($('saveToast').textContent === msg) $('saveToast').textContent = '';
    }, 3200);
  }

  // Event bindings
  $('saveBtn').addEventListener('click', async () => {
    const patch = collectPatch();
    const updated = await window.vpsBridge.saveConfig(patch);
    populateForm(updated);
    await renderDisplays();
    showToast('✔ 配置已保存并实时生效');
  });

  $('previewBtn').addEventListener('click', async () => {
    // Save current edits first so preview reflects latest settings
    const patch = collectPatch();
    await window.vpsBridge.saveConfig(patch);
    await window.vpsBridge.startScreensaver();
  });

  $('togglePauseBtn').addEventListener('click', async () => {
    const res = await window.vpsBridge.togglePause();
    currentState = { ...(currentState || {}), isPaused: res.isPaused };
    updateSummaryStrip();
  });

  $('testPanelBtn').addEventListener('click', async () => {
    const box = $('testResultBox');
    box.className = 'test-result';
    box.textContent = '⏳ 正在登录 3x-ui 并读取实时遥测...';

    const patch = collectPatch();
    const res = await window.vpsBridge.testPanelConnection(patch.panel);
    if (res && res.ok) {
      box.className = 'test-result ok';
      box.textContent = `✔ 连接成功！IP ${res.ipv4} · RTT ${res.latencyMs ?? '--'}ms · 在线 ${res.onlineUsers ?? "--"} 人 · CPU ${res.cpu}% · Xray ${res.xrayState} (${res.xrayVersion})`;
      if (res.warnings?.length) box.textContent += ` · 部分数据不可用（${res.warnings.join('；')}）`;
      $('panelEnabled').checked = true;
    } else {
      box.className = 'test-result err';
      box.textContent = `✘ ${(res && res.error) || '连接失败'}`;
    }
  });

  $('detectGeoBtn').addEventListener('click', async () => {
    const msg = $('geoDetectMsg');
    msg.textContent = '⏳ 正在检测本机公网城市坐标...';
    const res = await window.vpsBridge.detectLocalGeo();
    if (res && res.ok) {
      $('localCity').value = res.city;
      $('localLat').value = res.lat;
      $('localLon').value = res.lon;
      msg.textContent = `✔ 已自动填充：${res.city} (${res.lat}, ${res.lon})，别忘了点击右下角「保存配置」`;
    } else {
      msg.textContent = `✘ ${(res && res.error) || '自动定位失败，请手动输入'}`;
    }
  });

  $('refreshDisplaysBtn').addEventListener('click', renderDisplays);
  $('swapScreens').addEventListener('change', async () => {
    await window.vpsBridge.saveConfig({ displays: { swapScreens: $('swapScreens').checked } });
    await renderDisplays();
  });

  window.vpsBridge.onTelemetry((data) => {
    if (!data) return;
    const rtt = data.network.latencyMs !== null ? `${data.network.latencyMs} ms` : 'ERR';
    const speed = formatSpeed(data.system.netIO.down);
    $('liveTelemetrySummary').textContent = `${rtt} · 在线 ${data.proxy.onlineUsersCount ?? "--"} 人 · ↓${speed}`;
  });

  window.vpsBridge.onScreensaverState((st) => {
    currentState = st;
    updateSummaryStrip();
  });

  async function init() {
    const [cfg, st] = await Promise.all([
      window.vpsBridge.getConfig(),
      window.vpsBridge.getAppState()
    ]);
    currentState = st;
    populateForm(cfg);
    await renderDisplays();
  }

  init();
})();
