(function () {
  const { formatBytes, formatSpeed, formatUptime, formatClock, maskIpAddress } = window.Formatters;
  const xpIcons = window.XPIcons || {};
  const serviceNodes = window.ServiceRadarNodes || [];

  const canvas = document.getElementById('worldCanvas');
  const ctx = canvas.getContext('2d');
  const sparkCanvas = document.getElementById('latencySpark');
  const sparkCtx = sparkCanvas.getContext('2d');

  const els = {
    stage: document.getElementById('stage'),
    sweep: document.getElementById('phosphorSweep'),
    localCityTag: document.getElementById('localCityTag'),
    routeArrow: document.getElementById('routeArrow'),
    nodeNameTag: document.getElementById('nodeNameTag'),
    statusPill: document.getElementById('statusPill'),
    hudLatency: document.getElementById('hudLatency'),
    hudDown: document.getElementById('hudDown'),
    hudUp: document.getElementById('hudUp'),
    hudUsers: document.getElementById('hudUsers'),
    clockTime: document.getElementById('clockTime'),
    clockDate: document.getElementById('clockDate'),
    idleCounter: document.getElementById('idleCounter'),
    pvaGuardTag: document.getElementById('pvaGuardTag'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    exitBtn: document.getElementById('exitBtn'),
    nodeCard: document.getElementById('nodeCard'),
    closeCardBtn: document.getElementById('closeCardBtn'),
    cardNodeName: document.getElementById('cardNodeName'),
    cardLinkDot: document.getElementById('cardLinkDot'),
    cardLinkState: document.getElementById('cardLinkState'),
    cardXrayBadge: document.getElementById('cardXrayBadge'),
    cardLocation: document.getElementById('cardLocation'),
    cardCoords: document.getElementById('cardCoords'),
    cardIpv4: document.getElementById('cardIpv4'),
    cardIpv6: document.getElementById('cardIpv6'),
    ipv6Row: document.getElementById('ipv6Row'),
    toggleMaskBtn: document.getElementById('toggleMaskBtn'),
    cardProvider: document.getElementById('cardProvider'),
    cardUptime: document.getElementById('cardUptime'),
    cardLatency: document.getElementById('cardLatency'),
    cardUsers: document.getElementById('cardUsers'),
    cardTraffic: document.getElementById('cardTraffic'),
    cardSys: document.getElementById('cardSys'),
    speedResultText: document.getElementById('speedResultText'),
    speedProgressFill: document.getElementById('speedProgressFill'),
    speedTestBtn: document.getElementById('speedTestBtn')
  };

  // Pacific-centered map projection so Hohhot (left) <-> Pacific (center) <-> Los Angeles (right) forms a clean airway chart
  const CENTER_LON = 165;
  let worldGeoJson = null;
  let mapCacheCanvas = null;
  let cachedW = 0;
  let cachedH = 0;

  let currentConfig = null;
  let telemetry = null;
  let maskIpState = false;
  let isCardOpen = false;
  let isHoveringLax = false;
  let isHoveringLocal = false;
  let laxScreenPos = { x: 0, y: 0 };
  let localScreenPos = { x: 0, y: 0 };
  const activeStartMs = Date.now();

  // Calm, deliberate alternating airway animation (3.5x slower: 22 seconds per direction, NEVER simultaneous!)
  // Leg 0: Hohhot -> Los Angeles (>>>>>>>), Leg 1: Los Angeles -> Hohhot (<<<<<<<)
  const LEG_DURATION_MS = 22000;
  let lastLegIdx = -1;

  // Extended LAX radar sweep state (1 full 360° scan every 24 seconds for calm persistence)
  const RADAR_ROTATION_SPEED = (Math.PI * 2) / 24.0; // rad/sec
  const SERVICE_PERSIST_SEC = 10.8; // radar pop-in -> ~4.2s outbound + ~5.1s inbound -> gentle fade-out
  const serviceBlipState = new Map(); // id -> { triggeredAtSec }
  let prevRadarAngle = null;

  function wrapLon(lon) {
    return ((lon - CENTER_LON + 540) % 360) - 180;
  }

  function project(lon, lat, w, h) {
    const padX = w * 0.04;
    const padY = h * 0.09;
    const usableW = w - padX * 2;
    const usableH = h - padY * 2;

    const relLon = wrapLon(lon);
    const x = padX + ((relLon + 180) / 360) * usableW;

    const maxLat = 80;
    const minLat = -58;
    const clampedLat = Math.max(minLat, Math.min(maxLat, lat));
    const y = padY + ((maxLat - clampedLat) / (maxLat - minLat)) * usableH;
    return { x, y, relLon };
  }

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  /**
   * Build sleek, low-curvature aviation chart route points.
   * Outbound (Hohhot -> LAX) arcs gently north; Inbound (LAX -> Hohhot) arcs gently south.
   */
  function buildFlightRoute(pStart, pEnd, curveSign, w, h, steps = 120) {
    const mx = (pStart.x + pEnd.x) * 0.5;
    const my = (pStart.y + pEnd.y) * 0.5;
    const dist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    const offset = Math.min(h * 0.095, dist * 0.095) * curveSign;
    const cx = mx;
    const cy = my + offset;

    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * pStart.x + 2 * mt * t * cx + t * t * pEnd.x;
      const y = mt * mt * pStart.y + 2 * mt * t * cy + t * t * pEnd.y;
      const dx = 2 * mt * (cx - pStart.x) + 2 * t * (pEnd.x - cx);
      const dy = 2 * mt * (cy - pStart.y) + 2 * t * (pEnd.y - cy);
      const angle = Math.atan2(dy, dx);
      pts.push({ x, y, angle, t });
    }
    return pts;
  }

  function sampleRoute(pts, u) {
    const clamped = Math.max(0, Math.min(1, u));
    const f = clamped * (pts.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(pts.length - 1, i0 + 1);
    const frac = f - i0;
    const a = pts[i0];
    const b = pts[i1];
    return {
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
      angle: a.angle + Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle)) * frac
    };
  }

  function buildStaticMapCache(w, h) {
    cachedW = w;
    cachedH = h;
    mapCacheCanvas = document.createElement('canvas');
    mapCacheCanvas.width = w;
    mapCacheCanvas.height = h;
    const mctx = mapCacheCanvas.getContext('2d');

    // Deep radar sea background
    const bgGrad = mctx.createRadialGradient(w * 0.52, h * 0.45, w * 0.08, w * 0.5, h * 0.5, w * 0.72);
    bgGrad.addColorStop(0, '#04120c');
    bgGrad.addColorStop(1, '#020504');
    mctx.fillStyle = bgGrad;
    mctx.fillRect(0, 0, w, h);

    // Subtle tactical lat/lon graticule
    mctx.strokeStyle = 'rgba(0, 255, 118, 0.05)';
    mctx.lineWidth = 1;
    for (let lat = -45; lat <= 75; lat += 15) {
      const pStart = project(CENTER_LON - 179.9, lat, w, h);
      const pEnd = project(CENTER_LON + 179.9, lat, w, h);
      mctx.beginPath();
      mctx.moveTo(pStart.x, pStart.y);
      mctx.lineTo(pEnd.x, pEnd.y);
      mctx.stroke();
    }
    for (let offset = -180; offset <= 180; offset += 20) {
      const lon = CENTER_LON + offset;
      const pTop = project(lon, 80, w, h);
      const pBot = project(lon, -58, w, h);
      mctx.beginPath();
      mctx.moveTo(pTop.x, pTop.y);
      mctx.lineTo(pBot.x, pBot.y);
      mctx.stroke();
    }

    // Equator subtle dash
    const eqL = project(CENTER_LON - 179.9, 0, w, h);
    const eqR = project(CENTER_LON + 179.9, 0, w, h);
    mctx.save();
    mctx.setLineDash([4, 6]);
    mctx.strokeStyle = 'rgba(56, 242, 209, 0.1)';
    mctx.beginPath();
    mctx.moveTo(eqL.x, eqL.y);
    mctx.lineTo(eqR.x, eqR.y);
    mctx.stroke();
    mctx.restore();

    // Natural Earth countries
    if (worldGeoJson && Array.isArray(worldGeoJson.features)) {
      const drawRing = (ring, doFill) => {
        if (!ring || ring.length < 2) return;
        let subPath = [];
        const subPaths = [];
        for (let i = 0; i < ring.length; i++) {
          const [lon, lat] = ring[i];
          const pt = project(lon, lat, w, h);
          if (subPath.length > 0 && Math.abs(pt.relLon - subPath[subPath.length - 1].relLon) > 180) {
            subPaths.push(subPath);
            subPath = [pt];
          } else {
            subPath.push(pt);
          }
        }
        if (subPath.length > 1) subPaths.push(subPath);

        for (const sp of subPaths) {
          mctx.beginPath();
          mctx.moveTo(sp[0].x, sp[0].y);
          for (let i = 1; i < sp.length; i++) {
            mctx.lineTo(sp[i].x, sp[i].y);
          }
          if (doFill && subPaths.length === 1) {
            mctx.closePath();
            mctx.fill();
          }
          mctx.stroke();
        }
      };

      mctx.fillStyle = 'rgba(8, 36, 21, 0.72)';
      mctx.strokeStyle = 'rgba(0, 255, 118, 0.30)';
      mctx.lineWidth = 1.1;

      for (const feature of worldGeoJson.features) {
        const geom = feature.geometry;
        if (!geom) continue;
        if (geom.type === 'Polygon') {
          geom.coordinates.forEach((ring, idx) => drawRing(ring, idx === 0));
        } else if (geom.type === 'MultiPolygon') {
          geom.coordinates.forEach((poly) => {
            poly.forEach((ring, idx) => drawRing(ring, idx === 0));
          });
        }
      }
    }

    // Subtle ocean label
    mctx.fillStyle = 'rgba(0, 255, 118, 0.065)';
    mctx.font = `700 ${Math.round(w * 0.01)}px monospace`;
    mctx.textAlign = 'center';
    const pac = project(178, 8, w, h);
    mctx.fillText('P A C I F I C   A I R W A Y   //   T R A N S - P A C I F I C   R O U T E', pac.x, pac.y);
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      buildStaticMapCache(w, h);
    }
  }

  function isLinkHealthy() {
    if (!telemetry) return true;
    return Boolean(telemetry.connected && telemetry.network.reachable);
  }

  /**
   * Draw a crisp, understated aviation-chart chevron (`>` or `<` rotated along the curve tangent)
   */
  function drawAirwayChevron(x, y, angle, size, lineWidth, color, alpha, dpr) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Very restrained glow so it looks crisp like a vector airway chart, never a flashy beam
    ctx.shadowColor = color;
    ctx.shadowBlur = 3 * dpr;
    ctx.beginPath();
    ctx.moveTo(-size * 0.58, -size * 0.56);
    ctx.lineTo(size * 0.42, 0);
    ctx.lineTo(-size * 0.58, size * 0.56);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Clean, unhurried alternating airway chevron stream:
   * - Leg A (22s): Hohhot ➔ Los Angeles (`> > > > > > > > >`) gliding steadily along the northern airway
   * - Leg B (22s): Los Angeles ➔ Hohhot (`< < < < < < < < <`) gliding steadily along the southern airway
   * Strictly one direction at a time, minimal restrained glow, no water-stream/spark noise.
   */
  function drawAlternatingAirway(pLocal, pLax, nowMs, w, h, dpr) {
    const legIdx = Math.floor(nowMs / LEG_DURATION_MS);
    const legPhase = (nowMs % LEG_DURATION_MS) / LEG_DURATION_MS; // 0..1 over 22 seconds
    const isOutbound = legIdx % 2 === 0;

    if (legIdx !== lastLegIdx) {
      lastLegIdx = legIdx;
      if (els.routeArrow) {
        els.routeArrow.textContent = isOutbound ? '>>>' : '<<<';
      }
    }

    // Calm 1.3-second gap between legs so the two directions never overlap
    if (legPhase >= 0.94) {
      return { isOutbound, active: false };
    }

    const healthy = isLinkHealthy();
    const chevronColor = !healthy
      ? '#e05868'
      : isOutbound
        ? '#39d8c8'   // Restrained tactical cyan-teal for Hohhot -> Los Angeles
        : '#22e07a';  // Restrained phosphor emerald for Los Angeles -> Hohhot
    const highlightColor = !healthy
      ? '#ff9aa6'
      : isOutbound
        ? '#9cf7ee'
        : '#8effbf';

    const pStart = isOutbound ? pLocal : pLax;
    const pEnd = isOutbound ? pLax : pLocal;
    const routePts = buildFlightRoute(pStart, pEnd, isOutbound ? -1 : 1, w, h, 120);

    // Trim slightly from icon centers so chevrons start & end cleanly right outside the XP icons
    const START_U = 0.045;
    const END_U = 0.955;

    // Deliberate, slow 4-stage choreography across 22s:
    // 0.00 -> 0.42 (~9.2s): Airway chevron chain slowly extends from origin to destination
    // 0.42 -> 0.78 (~7.9s): Full chain glides steadily in direction of travel with soft brightness wave
    // 0.78 -> 0.94 (~3.5s): Chain gently retracts from origin toward destination and fades cleanly
    let headU = END_U;
    let tailU = START_U;
    let globalAlpha = 1;

    if (legPhase < 0.42) {
      const p = easeInOutSine(legPhase / 0.42);
      headU = START_U + p * (END_U - START_U);
      tailU = START_U;
      globalAlpha = Math.min(1, legPhase / 0.06);
    } else if (legPhase < 0.78) {
      headU = END_U;
      tailU = START_U;
      globalAlpha = 1;
    } else {
      const p = easeInOutSine((legPhase - 0.78) / 0.16);
      headU = END_U;
      tailU = START_U + p * (END_U - START_U);
      globalAlpha = 1 - p * 0.85;
    }

    // 1. Hairline airway guide rail (very subtle dashed flight-chart line)
    ctx.save();
    ctx.globalAlpha = globalAlpha * 0.22;
    ctx.strokeStyle = chevronColor;
    ctx.lineWidth = 1.0 * dpr;
    ctx.setLineDash([4 * dpr, 8 * dpr]);
    ctx.beginPath();
    for (let i = 0; i < routePts.length; i++) {
      const u = routePts[i].t;
      if (u < tailU || u > headU) continue;
      if (i === 0 || routePts[i - 1].t < tailU) ctx.moveTo(routePts[i].x, routePts[i].y);
      else ctx.lineTo(routePts[i].x, routePts[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // 2. Continuous gliding chain of crisp directional chevrons (`> > > > > > >` or `< < < < < < <`)
    const chevronCount = 26;
    const step = (END_U - START_U) / chevronCount;
    // Slow, calm forward march (~1 chevron step per 0.65s -> feels unhurried & radar-authentic)
    const marchOffset = ((nowMs * 0.000055) % step);
    // Gentle slow luminance wave gliding along the chain
    const wavePos = (nowMs * 0.00018) % 1.4 - 0.2;

    for (let k = -1; k <= chevronCount; k++) {
      const u = START_U + k * step + marchOffset;
      if (u < tailU || u > headU) continue;

      const pt = sampleRoute(routePts, u);

      // Soft taper at entry/exit ends of the visible segment
      const distFromTail = Math.min(1, (u - tailU) / (step * 2.5));
      const distFromHead = Math.min(1, (headU - u) / (step * 1.4));
      const edgeFade = Math.max(0, Math.min(distFromTail, distFromHead));

      // Gentle traveling highlight wave along the chevron chain
      const waveDist = Math.abs(u - wavePos);
      const waveBoost = Math.max(0, 1 - waveDist / 0.16);

      // Slightly stronger lead chevron while extending
      const isLead = legPhase < 0.42 && (headU - u) < step * 1.3;
      const alpha = globalAlpha * edgeFade * (isLead ? 0.92 : (0.36 + waveBoost * 0.50));
      const size = (isLead ? 7.6 : (6.0 + waveBoost * 1.1)) * dpr;
      const strokeW = isLead ? 2.1 : (1.55 + waveBoost * 0.35);
      const col = (isLead || waveBoost > 0.55) ? highlightColor : chevronColor;

      drawAirwayChevron(pt.x, pt.y, pt.angle, size, strokeW, col, alpha, dpr);
    }

    // 3. Restrained minimal airway direction label beside the arc midpoint
    const midPt = sampleRoute(routePts, 0.5);
    const rttText = telemetry && telemetry.network.latencyMs !== null ? `${telemetry.network.latencyMs}ms` : '--';
    const rateText = telemetry
      ? (isOutbound ? formatSpeed(telemetry.system.netIO.up) : formatSpeed(telemetry.system.netIO.down))
      : '';
    const tagText = isOutbound
      ? `Hohhot  >>>  Los Angeles  ·  ${rttText}${rateText ? ' · ↑' + rateText : ''}`
      : `Hohhot  <<<  Los Angeles  ·  ${rttText}${rateText ? ' · ↓' + rateText : ''}`;

    ctx.save();
    ctx.globalAlpha = globalAlpha * 0.78;
    ctx.font = `600 ${11 * dpr}px "Cascadia Mono", Consolas, monospace`;
    const tagW = ctx.measureText(tagText).width + 20 * dpr;
    const tagH = 22 * dpr;
    const tagX = midPt.x - tagW / 2;
    const tagY = midPt.y + (isOutbound ? -28 * dpr : 12 * dpr);

    ctx.fillStyle = 'rgba(2, 10, 7, 0.74)';
    ctx.strokeStyle = chevronColor;
    ctx.lineWidth = 0.9 * dpr;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 3 * dpr);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = highlightColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, midPt.x, tagY + tagH / 2);
    ctx.restore();

    return { isOutbound, active: true };
  }

  /**
   * Draw dark-themed Windows XP Computer / Server endpoint icon integrated naturally into the map
   */
  function drawXpComputerNode(x, y, {
    dpr,
    tSec,
    iconImg,
    accentColor,
    label,
    hoverHint,
    interactive,
    hovered
  }) {
    const baseSize = (interactive ? 58 : 54) * dpr;
    const scale = hovered ? 1.08 : 1.0;
    const drawSize = baseSize * scale;

    // Subtle dark-green selection outline only on hover / open
    if (hovered) {
      const pad = 8 * dpr;
      const boxW = drawSize + pad * 2;
      const boxH = drawSize + pad * 1.6;
      ctx.save();
      ctx.fillStyle = 'rgba(24, 92, 68, 0.24)';
      ctx.strokeStyle = 'rgba(84, 232, 168, 0.72)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.setLineDash([4 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.roundRect(x - boxW / 2, y - boxH / 2 - 1 * dpr, boxW, boxH, 5 * dpr);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Crisp color-graded Windows XP icon (low-key shadow so it sits naturally on the map)
    if (iconImg && iconImg.complete && iconImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = hovered ? 1.0 : 0.92;
      ctx.shadowColor = hovered ? accentColor : 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = (hovered ? 10 : 6) * dpr;
      ctx.drawImage(iconImg, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      ctx.restore();
    }

    // Gentle blinking power/activity LED on chassis
    const blinkOn = Math.sin(tSec * 3.2) > 0;
    if (blinkOn) {
      ctx.save();
      const ledX = x + (interactive ? -13.5 : 13.5) * dpr * scale;
      const ledY = y + (interactive ? 0 : 11) * dpr * scale;
      ctx.beginPath();
      ctx.arc(ledX, ledY, 1.8 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 5 * dpr;
      ctx.fill();
      ctx.restore();
    }

    // Clean, minimal label underneath (just "Hohhot" on local side, concise on LAX side)
    const labelY = y + drawSize * 0.5 + 14 * dpr;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${13 * dpr}px "Cascadia Mono", Consolas, monospace`;
    ctx.fillStyle = hovered ? '#d6ffea' : 'rgba(136, 235, 184, 0.86)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4 * dpr;
    ctx.fillText(label, x, labelY);

    if (hovered && hoverHint) {
      ctx.font = `500 ${10.5 * dpr}px "Cascadia Mono", Consolas, monospace`;
      ctx.fillStyle = accentColor;
      ctx.fillText(hoverHint, x, labelY + 15 * dpr);
    }
    ctx.restore();
  }

  /**
   * Draw clear, medium-brisk alternating chevron data exchange between Los Angeles VPS and a radar-detected service.
   * Deliberately stays secondary to the primary Hohhot <-> LAX airway while lasting long enough to read clearly:
   * - Leg 1 (0.15s -> 4.35s, 4.2s): Los Angeles -> Service (outbound request)
   * - Leg 2 (4.55s -> 9.65s, 5.1s): Service -> Los Angeles (inbound response)
   * Fades out cleanly alongside the service icon after the radar beam moves well past.
   */
  function drawServiceDataExchange(pLax, pSvc, ageSec, iconAlpha, nowMs, w, h, dpr) {
    const OUT_START = 0.15;
    const OUT_DUR = 4.2;
    const OUT_END = OUT_START + OUT_DUR;      // 4.35s
    const IN_START = OUT_END + 0.20;          // 4.55s
    const IN_DUR = 5.1;                       // >= 5 seconds live duration for return stream
    const IN_END = IN_START + IN_DUR;         // 9.65s

    let isOutbound = true;
    let legPhase = 0;

    if (ageSec >= OUT_START && ageSec <= OUT_END) {
      isOutbound = true;
      legPhase = (ageSec - OUT_START) / OUT_DUR;
    } else if (ageSec >= IN_START && ageSec <= IN_END) {
      isOutbound = false;
      legPhase = (ageSec - IN_START) / IN_DUR;
    } else {
      return;
    }

    const dist = Math.hypot(pSvc.x - pLax.x, pSvc.y - pLax.y);
    if (dist < 40 * dpr) return;

    const pStart = isOutbound ? pLax : pSvc;
    const pEnd = isOutbound ? pSvc : pLax;

    // Gentle subtle arc perpendicular to the LAX-Service chord (slightly offset between out & in)
    const mx = (pStart.x + pEnd.x) * 0.5;
    const my = (pStart.y + pEnd.y) * 0.5;
    const nx = -(pEnd.y - pStart.y) / dist;
    const ny = (pEnd.x - pStart.x) / dist;
    const bendMag = Math.min(h * 0.068, dist * 0.115);
    const cx = mx + nx * bendMag;
    const cy = my + ny * bendMag;

    const steps = Math.max(36, Math.min(96, Math.round(dist / (14 * dpr))));
    const routePts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * pStart.x + 2 * mt * t * cx + t * t * pEnd.x;
      const y = mt * mt * pStart.y + 2 * mt * t * cy + t * t * pEnd.y;
      const dx = 2 * mt * (cx - pStart.x) + 2 * t * (pEnd.x - cx);
      const dy = 2 * mt * (cy - pStart.y) + 2 * t * (pEnd.y - cy);
      routePts.push({ x, y, angle: Math.atan2(dy, dx), t });
    }

    // Trim endpoints neatly around the XP server icon & service icon regardless of link length
    const padStartPx = (isOutbound ? 38 : 24) * dpr;
    const padEndPx = (isOutbound ? 24 : 38) * dpr;
    const startU = Math.min(0.28, padStartPx / dist);
    const endU = Math.max(startU + 0.18, 1 - padEndPx / dist);

    // Smooth 3-stage burst: extend (0..0.34) -> steady visible glide (0.34..0.78) -> retract & fade (0.78..1.0)
    let headU = endU;
    let tailU = startU;
    let burstAlpha = 1;

    if (legPhase < 0.34) {
      const p = easeInOutSine(legPhase / 0.34);
      headU = startU + p * (endU - startU);
      tailU = startU;
      burstAlpha = Math.min(1, legPhase / 0.08);
    } else if (legPhase < 0.78) {
      headU = endU;
      tailU = startU;
      burstAlpha = 1;
    } else {
      const p = easeInOutSine((legPhase - 0.78) / 0.22);
      headU = endU;
      tailU = startU + p * (endU - startU);
      burstAlpha = 1 - p;
    }

    // Clearly visible yet noticeably lighter & more delicate than the primary Hohhot <-> LAX airway
    const baseColor = isOutbound ? '#6cf0e2' : '#60ed9e';
    const brightColor = isOutbound ? '#ccfff9' : '#caffdf';
    const finalAlpha = burstAlpha * Math.min(1, iconAlpha * 1.15) * 0.74;
    if (finalAlpha <= 0.02) return;

    // 1. Subtle soft track + dashed airway guide
    ctx.save();
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < routePts.length; i++) {
      const u = routePts[i].t;
      if (u < tailU || u > headU) continue;
      if (!started) {
        ctx.moveTo(routePts[i].x, routePts[i].y);
        started = true;
      } else {
        ctx.lineTo(routePts[i].x, routePts[i].y);
      }
    }
    ctx.globalAlpha = finalAlpha * 0.16;
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 3.2 * dpr;
    ctx.stroke();

    ctx.globalAlpha = finalAlpha * 0.44;
    ctx.lineWidth = 1.0 * dpr;
    ctx.setLineDash([4 * dpr, 7 * dpr]);
    ctx.stroke();
    ctx.restore();

    // 2. Crisp gliding chevron chain (~2.6x faster than primary airway — lively yet unhurried)
    const usableSpan = endU - startU;
    const chevronCount = Math.max(4, Math.min(24, Math.round((dist * usableSpan) / (44 * dpr))));
    const step = usableSpan / chevronCount;
    const marchOffset = ((nowMs * 0.000145) % step);
    const wavePos = (nowMs * 0.00046) % 1.4 - 0.2;

    for (let k = -1; k <= chevronCount; k++) {
      const u = startU + k * step + marchOffset;
      if (u < tailU || u > headU) continue;

      const pt = sampleRoute(routePts, u);
      const fadeTail = Math.min(1, (u - tailU) / Math.max(0.01, step * 1.6));
      const fadeHead = Math.min(1, (headU - u) / Math.max(0.01, step * 1.1));
      const edgeFade = Math.max(0, Math.min(fadeTail, fadeHead));

      const waveDist = Math.abs(u - wavePos);
      const waveBoost = Math.max(0, 1 - waveDist / 0.22);
      const isLead = legPhase < 0.34 && (headU - u) < step * 1.3;

      const chevAlpha = finalAlpha * edgeFade * (isLead ? 1.1 : (0.58 + waveBoost * 0.42));
      const chevSize = (isLead ? 5.8 : (4.9 + waveBoost * 0.8)) * dpr;
      const chevW = isLead ? 1.65 : (1.3 + waveBoost * 0.25);
      const col = (isLead || waveBoost > 0.48) ? brightColor : baseColor;

      drawAirwayChevron(pt.x, pt.y, pt.angle, chevSize, chevW, col, Math.min(0.86, chevAlpha), dpr);
    }
  }

  /**
   * Draw proportionally scaled Los Angeles Radar Sweep that covers all of North America,
   * stretches cleanly across the Pacific to Japan, and reaches all Europe service nodes.
   * As the radar sweep arm passes over each service location, its retro skeuomorphic icon
   * smoothly pops in, exchanges fast lightweight bidirectional data bursts with LAX,
   * and fades out gently once the radar moves past.
   */
  function drawExtendedRadarAndServices(pLax, tSec, nowMs, w, h, dpr) {
    // Project every service node & compute minimum radius required to cover ALL of them proportionally
    const projectedNodes = [];
    let maxNodeDist = Math.min(w, h) * 0.36; // at least covers all of North America cleanly

    for (const node of serviceNodes) {
      const pos = project(node.lon, node.lat, w, h);
      const dx = pos.x - pLax.x;
      const dy = pos.y - pLax.y;
      const dist = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      if (dist > maxNodeDist) maxNodeDist = dist;
      projectedNodes.push({ node, pos, dist, angle });
    }

    // Proportional true circle centered on Los Angeles, extended just past the farthest service node
    const radarR = maxNodeDist + 76 * dpr;
    const sweepAngle = (tSec * RADAR_ROTATION_SPEED) % (Math.PI * 2);

    // Detect when the radar arm crosses each node's bearing angle
    if (prevRadarAngle !== null) {
      for (const item of projectedNodes) {
        const a = item.angle;
        const crossed = prevRadarAngle <= sweepAngle
          ? (a >= prevRadarAngle && a <= sweepAngle)
          : (a >= prevRadarAngle || a <= sweepAngle);
        if (crossed) {
          serviceBlipState.set(item.node.id, { triggeredAtSec: tSec });
        }
      }
    } else {
      // Seed recently-swept nodes right behind initial beam so screen feels alive immediately
      for (const item of projectedNodes) {
        const lag = (sweepAngle - item.angle + Math.PI * 2) % (Math.PI * 2);
        const lagSec = lag / RADAR_ROTATION_SPEED;
        if (lagSec < SERVICE_PERSIST_SEC * 0.7) {
          serviceBlipState.set(item.node.id, { triggeredAtSec: tSec - lagSec });
        }
      }
    }
    prevRadarAngle = sweepAngle;

    // 1. Subtle proportional concentric range rings around Los Angeles
    ctx.save();
    const ringFractions = [0.22, 0.44, 0.68, 0.94];
    for (let i = 0; i < ringFractions.length; i++) {
      const r = radarR * ringFractions[i];
      ctx.beginPath();
      ctx.arc(pLax.x, pLax.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 255, 118, 0.065)';
      ctx.lineWidth = (i === 0 ? 1.1 : 0.9) * dpr;
      if (i % 2 === 1) ctx.setLineDash([5 * dpr, 9 * dpr]);
      else ctx.setLineDash([]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 2. Smooth translucent trailing radar wedge (layered slices for silky conical fade)
    const wedgeSpan = 0.58; // ~33 degrees clean tactical wedge
    const slices = 14;
    for (let s = 0; s < slices; s++) {
      const f0 = s / slices;
      const f1 = (s + 1) / slices;
      const a0 = sweepAngle - wedgeSpan * (1 - f0);
      const a1 = sweepAngle - wedgeSpan * (1 - f1);
      const sliceAlpha = Math.pow(f1, 2.2) * 0.085;

      const grad = ctx.createRadialGradient(pLax.x, pLax.y, 12 * dpr, pLax.x, pLax.y, radarR);
      grad.addColorStop(0, `rgba(0, 255, 120, ${sliceAlpha * 1.45})`);
      grad.addColorStop(0.45, `rgba(0, 255, 120, ${sliceAlpha * 0.9})`);
      grad.addColorStop(1, 'rgba(0, 255, 120, 0)');

      ctx.beginPath();
      ctx.moveTo(pLax.x, pLax.y);
      ctx.arc(pLax.x, pLax.y, radarR, a0, a1);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 3. Crisp thin leading radar sweep line
    const armGrad = ctx.createLinearGradient(
      pLax.x,
      pLax.y,
      pLax.x + Math.cos(sweepAngle) * radarR,
      pLax.y + Math.sin(sweepAngle) * radarR
    );
    armGrad.addColorStop(0, 'rgba(130, 255, 190, 0.65)');
    armGrad.addColorStop(0.55, 'rgba(0, 255, 118, 0.28)');
    armGrad.addColorStop(1, 'rgba(0, 255, 118, 0)');
    ctx.beginPath();
    ctx.moveTo(pLax.x, pLax.y);
    ctx.lineTo(pLax.x + Math.cos(sweepAngle) * radarR, pLax.y + Math.sin(sweepAngle) * radarR);
    ctx.strokeStyle = armGrad;
    ctx.lineWidth = 1.4 * dpr;
    ctx.stroke();
    ctx.restore();

    // 4. Render each radar-triggered retro skeuomorphic service icon + fast LAX <-> Service data bursts
    for (const item of projectedNodes) {
      const state = serviceBlipState.get(item.node.id);
      if (!state) continue;
      const age = tSec - state.triggeredAtSec;
      if (age < 0 || age > SERVICE_PERSIST_SEC) continue;

      // Smooth fade-in (0..0.5s), prolonged active exchange window (0.5..9.2s), gentle fade-out (9.2..10.8s)
      let alpha = 1;
      let scale = 1;
      if (age < 0.5) {
        const k = easeInOutSine(age / 0.5);
        alpha = k;
        scale = 0.72 + k * 0.30;
      } else if (age < 0.8) {
        const k = (age - 0.5) / 0.3;
        alpha = 1;
        scale = 1.02 - k * 0.02;
      } else if (age > 9.2) {
        const k = easeInOutSine((age - 9.2) / (SERVICE_PERSIST_SEC - 9.2));
        alpha = 1 - k;
        scale = 1 - k * 0.12;
      }

      if (alpha <= 0.01) continue;

      // Fast, light-colored bidirectional data transfer animation between LAX & this service while active
      drawServiceDataExchange(pLax, item.pos, age, alpha, nowMs, w, h, dpr);

      const x = item.pos.x;
      const y = item.pos.y;

      // Initial radar detection ping ring right as the beam hits the node
      if (age < 1.1) {
        const rp = age / 1.1;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, (14 + rp * 26) * dpr, 0, Math.PI * 2);
        ctx.strokeStyle = '#4fffa0';
        ctx.globalAlpha = (1 - rp) * 0.55;
        ctx.lineWidth = 1.2 * dpr;
        ctx.stroke();
        ctx.restore();
      }

      // Subtle anchor crosshair dot beneath icon
      const iconSize = 36 * dpr * scale;
      ctx.save();
      ctx.globalAlpha = alpha * 0.92;
      if (item.node.icon && item.node.icon.complete && item.node.icon.naturalWidth > 0) {
        ctx.shadowColor = 'rgba(0, 255, 118, 0.25)';
        ctx.shadowBlur = 7 * dpr;
        ctx.drawImage(item.node.icon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
      }

      // Clean compact service name beneath the skeuomorphic icon
      ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
      ctx.shadowBlur = 4 * dpr;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `600 ${10.5 * dpr}px "Cascadia Mono", Consolas, monospace`;
      ctx.fillStyle = 'rgba(176, 245, 208, 0.92)';
      ctx.fillText(item.node.name, x, y + iconSize / 2 + 4 * dpr);
      ctx.restore();
    }
  }

  function drawScene(nowMs) {
    requestAnimationFrame(drawScene);

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;

    if (!mapCacheCanvas || cachedW !== w || cachedH !== h) {
      buildStaticMapCache(w, h);
    }

    ctx.drawImage(mapCacheCanvas, 0, 0);

    const localLat = (telemetry && telemetry.local.lat) ?? (currentConfig && currentConfig.local.lat) ?? 40.8426;
    const localLon = (telemetry && telemetry.local.lon) ?? (currentConfig && currentConfig.local.lon) ?? 111.7492;
    const nodeLat = (telemetry && telemetry.node.lat) ?? (currentConfig && currentConfig.node.lat) ?? 34.0522;
    const nodeLon = (telemetry && telemetry.node.lon) ?? (currentConfig && currentConfig.node.lon) ?? -118.2437;

    const pLocal = project(localLon, localLat, w, h);
    const pLax = project(nodeLon, nodeLat, w, h);
    localScreenPos = { x: pLocal.x / dpr, y: pLocal.y / dpr };
    laxScreenPos = { x: pLax.x / dpr, y: pLax.y / dpr };

    const tSec = nowMs * 0.001;

    // 1. Extended proportional radar sweep from Los Angeles + popping retro service icons + fast data exchanges
    drawExtendedRadarAndServices(pLax, tSec, nowMs, w, h, dpr);

    // 2. Slow, clean alternating airway chevron stream (Hohhot ⇄ Los Angeles)
    drawAlternatingAirway(pLocal, pLax, nowMs, w, h, dpr);

    // 3. Hohhot Local Endpoint: Dark-blended Windows XP "My Computer" icon + clean "Hohhot" label
    drawXpComputerNode(pLocal.x, pLocal.y, {
      dpr,
      tSec,
      iconImg: xpIcons.myComputer,
      accentColor: '#39d8c8',
      label: 'Hohhot',
      hoverHint: '',
      interactive: false,
      hovered: isHoveringLocal
    });

    // 4. Los Angeles VPS Endpoint: Dark-blended Windows XP Server icon (clickable!)
    drawXpComputerNode(pLax.x, pLax.y, {
      dpr,
      tSec,
      iconImg: xpIcons.xpServer,
      accentColor: isLinkHealthy() ? '#22e07a' : '#e05868',
      label: 'Los Angeles',
      hoverHint: 'CLICK TO INSPECT',
      interactive: true,
      hovered: isHoveringLax || isCardOpen
    });
  }

  function renderLatencySparkline(history) {
    const w = sparkCanvas.width;
    const h = sparkCanvas.height;
    sparkCtx.clearRect(0, 0, w, h);

    if (!history || history.length === 0) return;
    const slice = history.slice(-40);
    const maxRtt = Math.max(180, ...slice) * 1.1;
    const barGap = 2;
    const barW = Math.max(3, (w - barGap * (slice.length - 1)) / slice.length);

    slice.forEach((rtt, idx) => {
      const barH = Math.max(4, (rtt / maxRtt) * (h - 14));
      const x = idx * (barW + barGap);
      const y = h - barH;
      sparkCtx.fillStyle = rtt > 250 ? '#f5b942' : '#00ff76';
      sparkCtx.globalAlpha = 0.35 + (idx / slice.length) * 0.65;
      sparkCtx.fillRect(x, y, barW, barH);
    });
    sparkCtx.globalAlpha = 1;
  }

  function positionNodeCard() {
    const cardW = 390;
    const cardH = els.nodeCard.offsetHeight || 440;
    const margin = 24;
    let left = laxScreenPos.x - cardW - 50;
    if (left < margin) left = laxScreenPos.x + 50;
    if (left + cardW > window.innerWidth - margin) {
      left = window.innerWidth - cardW - margin;
    }
    let top = laxScreenPos.y - cardH * 0.45;
    top = Math.max(margin + 90, Math.min(window.innerHeight - cardH - margin - 60, top));

    els.nodeCard.style.left = `${Math.round(left)}px`;
    els.nodeCard.style.top = `${Math.round(top)}px`;
  }

  function openNodeCard() {
    isCardOpen = true;
    els.nodeCard.classList.remove('hidden');
    syncCardContent();
    requestAnimationFrame(positionNodeCard);
  }

  function closeNodeCard() {
    isCardOpen = false;
    els.nodeCard.classList.add('hidden');
  }

  function syncCardContent() {
    if (!telemetry) return;
    els.cardNodeName.textContent = telemetry.node.name || 'LAX-EDGE-01';
    els.cardLocation.textContent = telemetry.node.locationLabel || 'Los Angeles, CA · US';
    const latStr = `${Math.abs(telemetry.node.lat).toFixed(2)}°${telemetry.node.lat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(telemetry.node.lon).toFixed(2)}°${telemetry.node.lon >= 0 ? 'E' : 'W'}`;
    els.cardCoords.textContent = `${latStr}, ${lonStr}`;

    els.cardIpv4.textContent = maskIpAddress(telemetry.node.ipv4, maskIpState);
    if (telemetry.node.ipv6) {
      els.ipv6Row.classList.remove('hidden');
      els.cardIpv6.textContent = maskIpAddress(telemetry.node.ipv6, maskIpState);
    } else {
      els.ipv6Row.classList.add('hidden');
    }

    els.cardProvider.textContent = telemetry.node.provider || 'Los Angeles VPS';
    els.cardUptime.textContent = formatUptime(telemetry.system.uptime);

    const rtt = telemetry.network.latencyMs !== null ? `${telemetry.network.latencyMs} ms` : 'ERR';
    els.cardLatency.textContent = `${rtt} / ±${telemetry.network.jitterMs ?? 0} ms`;
    els.cardUsers.textContent = `${telemetry.proxy.onlineUsersCount ?? '--'} 人 (TCP ${telemetry.system.tcpCount || 0})`;
    els.cardTraffic.textContent = `↓${formatBytes(telemetry.system.netTraffic.recv, 1)} / ↑${formatBytes(telemetry.system.netTraffic.sent, 1)}`;

    const memPct = telemetry.system.mem.total > 0
      ? Math.round((telemetry.system.mem.current / telemetry.system.mem.total) * 100)
      : 0;
    els.cardSys.textContent = `${telemetry.system.cpu}% / ${memPct}%`;

    const online = telemetry.connected && telemetry.network.reachable;
    els.cardLinkDot.className = `status-dot ${online ? '' : 'offline'}`;
    els.cardLinkState.textContent = online
      ? (telemetry.mode === 'demo' ? 'DEMO ROUTE ACTIVE' : 'ROUTE ESTABLISHED')
      : 'LINK INTERRUPTED';
    els.cardXrayBadge.textContent = `XRAY ${(telemetry.system.xray.state || 'UNKNOWN').toUpperCase()}`;
  }

  function updateHud(data) {
    telemetry = data;
    if (!data) return;

    els.localCityTag.textContent = 'HOHHOT';
    els.nodeNameTag.textContent = (data.node.name || 'LAX-VPS').toUpperCase();

    if (data.mode === 'live' && data.connected) {
      els.statusPill.textContent = '3X-UI LIVE';
      els.statusPill.className = 'pill pill-live';
    } else if (data.mode === 'demo') {
      els.statusPill.textContent = 'DEMO';
      els.statusPill.className = 'pill pill-demo';
    } else {
      els.statusPill.textContent = 'OFFLINE';
      els.statusPill.className = 'pill pill-error';
    }

    els.hudLatency.textContent = data.network.latencyMs !== null ? `${data.network.latencyMs} ms` : 'ERR';
    els.hudDown.textContent = formatSpeed(data.system.netIO.down);
    els.hudUp.textContent = formatSpeed(data.system.netIO.up);
    els.hudUsers.textContent = `${data.proxy.onlineUsersCount ?? '--'} 人`;

    renderLatencySparkline(data.network.latencyHistory);
    if (isCardOpen) syncCardContent();
  }

  function hitTestLax(clientX, clientY) {
    const dx = clientX - laxScreenPos.x;
    const dy = clientY - laxScreenPos.y;
    return Math.abs(dx) <= 46 && Math.abs(dy) <= 50;
  }

  function hitTestLocal(clientX, clientY) {
    const dx = clientX - localScreenPos.x;
    const dy = clientY - localScreenPos.y;
    return Math.abs(dx) <= 42 && Math.abs(dy) <= 48;
  }

  function bindInteractions() {
    canvas.addEventListener('mousemove', (e) => {
      isHoveringLax = hitTestLax(e.clientX, e.clientY);
      isHoveringLocal = hitTestLocal(e.clientX, e.clientY);
      canvas.style.cursor = isHoveringLax ? 'pointer' : 'default';
    });

    canvas.addEventListener('click', (e) => {
      if (hitTestLax(e.clientX, e.clientY)) {
        if (isCardOpen) closeNodeCard();
        else openNodeCard();
      } else if (isCardOpen) {
        closeNodeCard();
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      if (!hitTestLax(e.clientX, e.clientY)) {
        window.vpsBridge.stopScreensaver();
      }
    });

    els.closeCardBtn.addEventListener('click', closeNodeCard);
    els.exitBtn.addEventListener('click', () => window.vpsBridge.stopScreensaver());
    els.openSettingsBtn.addEventListener('click', () => window.vpsBridge.openSettings());

    els.toggleMaskBtn.addEventListener('click', () => {
      maskIpState = !maskIpState;
      syncCardContent();
    });

    els.speedTestBtn.addEventListener('click', async () => {
      els.speedTestBtn.disabled = true;
      els.speedTestBtn.textContent = '⏳ 测速中...';
      els.speedResultText.textContent = '连接测速节点...';
      els.speedProgressFill.style.width = '5%';

      const res = await window.vpsBridge.runSpeedTest();
      els.speedTestBtn.disabled = false;
      els.speedTestBtn.textContent = '⚡ 重新下载测速';
      if (res && res.ok) {
        els.speedProgressFill.style.width = '100%';
        els.speedResultText.textContent = `${res.mbps} Mbps (${formatBytes(res.receivedBytes, 1)} / ${res.elapsedSec}s)`;
      } else {
        els.speedResultText.textContent = `失败: ${(res && res.error) || '网络异常'}`;
      }
    });

    window.vpsBridge.onSpeedTestProgress((prog) => {
      if (!prog) return;
      if (prog.error) {
        els.speedResultText.textContent = `失败: ${prog.error}`;
        return;
      }
      if (typeof prog.progress === 'number') {
        els.speedProgressFill.style.width = `${Math.round(prog.progress * 100)}%`;
      }
      if (typeof prog.mbps === 'number') {
        els.speedResultText.textContent = `${prog.mbps} Mbps`;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.vpsBridge.stopScreensaver();
      } else if (currentConfig && currentConfig.screensaver.exitMode === 'classic') {
        window.vpsBridge.stopScreensaver();
      }
    });
  }

  function startClock() {
    const tick = () => {
      const c = formatClock(new Date());
      els.clockTime.textContent = c.time;
      els.clockDate.textContent = `${c.date} · ${c.weekday}`;
      const activeSec = Math.floor((Date.now() - activeStartMs) / 1000);
      const mins = String(Math.floor(activeSec / 60)).padStart(2, '0');
      const secs = String(activeSec % 60).padStart(2, '0');
      els.idleCounter.textContent = `SCREENSAVER ACTIVE · ${mins}:${secs}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  async function init() {
    startClock();
    bindInteractions();

    const pva = new window.PVAAntiBurnInEngine({
      stageElement: els.stage,
      sweepElement: els.sweep,
      onShiftUpdate: (dx, dy) => {
        els.pvaGuardTag.textContent = `HVA-GUARD · SHIFT ${dx >= 0 ? '+' : ''}${dx},${dy >= 0 ? '+' : ''}${dy}`;
      }
    });

    const [cfg, geo] = await Promise.all([
      window.vpsBridge.getConfig(),
      window.vpsBridge.getWorldGeoJson()
    ]);

    currentConfig = cfg;
    maskIpState = Boolean(cfg.node.maskIp);
    worldGeoJson = geo;
    pva.applyConfig(cfg.antiBurnIn);

    window.vpsBridge.onConfigUpdated((updated) => {
      currentConfig = updated;
      maskIpState = Boolean(updated.node.maskIp);
      pva.applyConfig(updated.antiBurnIn);
    });

    window.vpsBridge.onTelemetry((data) => updateHud(data));

    resizeCanvas();
    window.addEventListener('resize', () => {
      resizeCanvas();
      if (isCardOpen) positionNodeCard();
    });

    requestAnimationFrame(drawScene);
  }

  init();
})();
