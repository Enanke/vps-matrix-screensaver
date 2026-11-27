# 双屏极客 VPS 雷达地图 & 3x-ui 实时监控互动屏保

> **VPS Matrix Screensaver** — 专为双屏（横屏主屏 + 竖屏副屏）打造的复古黑绿 CRT 控制台 + 全球雷达地图互动屏保，原生接入 **3x-ui** 面板实时遥测，内置温和防残影守护。

*Dual-screen retro CRT console & global radar map interactive screensaver with native 3x-ui telemetry, alternating trans-Pacific airway animations, retro Windows XP / skeuomorphic icons, and gentle anti-retention protection.*

---

## 核心特性 / Features

- **双屏独立画面与混合 DPI 适配**
  - **主屏（横屏，如 2560×1440 @ 100%）**：以太平洋为中心的暗黑雷达世界地图（内置离线 Natural Earth 177 国矢量边界），以复古暗夜配色 **Windows XP「我的电脑」**与**远程服务器**图标作为双端点，搭配舒缓交替的 `>>>>>>>` / `<<<<<<<` 跨洋航线箭头动画；以服务器为圆心的超大范围雷达持续扫描北美、日本与欧洲，掠过 Google、YouTube、ChatGPT、Antigravity、X、LINE、Facebook、Instagram、Telegram 等早期复古拟物图标时触发渐入渐出与快速双向数据握手动画。
  - **点击交互**：可自由移动鼠标点击服务器图标展开详情卡（地理位置、IP 一键打码切换、实时延迟/抖动、3x-ui 在线人数、累计流量与**按需下载测速**，平时不消耗 VPS 流量）；按 `ESC` 键或双击空白处退出双屏屏保。
  - **副屏（竖屏，如 1600×2560 @ 150%）**：复古黑绿 CRT 极客控制台，实时展示 3x-ui 在线代理用户数与活跃会话、TCP/UDP 连接数、链路 RTT 延迟与 Xray 内核状态、CPU/内存/磁盘/Swap ASCII 进度条、双通道实时上下行示波器、整机累计流量、入站节点列表与实时滚动终端日志流。
- **原生 3x-ui 面板对接 + 开箱 Demo 模式**
  - 原生对接 `3x-ui` 的 `/login`、`/panel/api/server/status`、`/panel/api/inbounds/onlines`、`/panel/api/inbounds/list`，支持自定义 `WebBasePath`、Bearer Token、可选忽略自签名 TLS 与自动会话续期。
  - 未配置前内置 **Demo 演示模式**，安装后即可直接预览完整双屏效果。
- **独立系统托盘常驻 & 防残影守护**
  - 不依赖 Windows 原生 `.scr` 屏保服务；支持全局闲置检测、全屏视频/游戏自动防打扰、托盘快捷开关、开机自启动与全局快捷键 `Ctrl+Alt+S`。
  - 内置针对 HVA/PVA/OLED 面板的温和防残影守护（像素微移、周期性暗场扫频与长闲置轻度降暗，均可在设置中自定义）。

---

## 快速开始 / Quick Start

### 环境要求
- Windows 10 / 11 (x64)
- Node.js 18+

### 本地开发运行

```bash
git clone https://github.com/Enanke/vps-matrix-screensaver.git
cd vps-matrix-screensaver
npm install
npm start
```

### 打包为 Windows 安装包 (NSIS `.exe`)

```bash
npm run dist:win
```

安装包输出至 `dist/` 目录，支持自定义安装路径、桌面与开始菜单快捷方式以及标准卸载。

---

## 隐私与安全说明

- 所有 3x-ui 面板地址、账号密码、Token 及自定义坐标仅保存在本机用户目录 `%APPDATA%\vps-matrix-screensaver\config.json` 中，**不会**写入项目源码或被打包进安装包。

## 开源协议 / License

本项目基于 [MIT License](./LICENSE) 开源。
