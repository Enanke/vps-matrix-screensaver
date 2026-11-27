/**
 * Early retro-skeuomorphic service icons (beveled glass, CRT TV, Polaroid camera, embossed badges)
 * color-graded to sit harmoniously inside the dark tactical radar world map.
 */
(function (global) {
  function svgToImage(svgText) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText.trim());
    return img;
  }

  // 1. Google — Early 2000s classic Catull serif 'g' on a glossy dark sapphire-emerald beveled tile
  const GOOGLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <linearGradient id="gTile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2c5f8a"/>
      <stop offset="50%" stop-color="#183d5e"/>
      <stop offset="100%" stop-color="#0d2236"/>
    </linearGradient>
    <linearGradient id="gGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c9f2ff" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#c9f2ff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="52" height="52" rx="12" fill="url(#gTile)" stroke="#5da8cf" stroke-width="2"/>
  <rect x="8" y="8" width="48" height="23" rx="10" fill="url(#gGloss)"/>
  <text x="32" y="45" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="40" fill="#e6fff4" stroke="#0b2030" stroke-width="0.8">g</text>
</svg>`;

  // 2. YouTube — Classic early iOS/2007 retro CRT Television icon with dials & glowing play screen
  const YOUTUBE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <linearGradient id="ytBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5c4738"/>
      <stop offset="55%" stop-color="#382a21"/>
      <stop offset="100%" stop-color="#1f1712"/>
    </linearGradient>
    <radialGradient id="ytTube" cx="42%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#2e5446"/>
      <stop offset="100%" stop-color="#0d1e18"/>
    </radialGradient>
  </defs>
  <!-- Rabbit-ear antennas -->
  <line x1="25" y1="14" x2="18" y2="6" stroke="#85a898" stroke-width="2" stroke-linecap="round"/>
  <line x1="35" y1="14" x2="43" y2="6" stroke="#85a898" stroke-width="2" stroke-linecap="round"/>
  <!-- Retro wooden/bronze TV cabinet -->
  <rect x="5" y="13" width="54" height="43" rx="8" fill="url(#ytBody)" stroke="#9e826b" stroke-width="1.8"/>
  <!-- Recessed curved CRT glass screen -->
  <rect x="9.5" y="18" width="35" height="32" rx="6" fill="url(#ytTube)" stroke="#5f8272" stroke-width="1.4"/>
  <!-- Glossy crimson-amber retro play button -->
  <polygon points="22,26 36,34 22,42" fill="#e65a50" stroke="#ffd2cc" stroke-width="1.2" stroke-linejoin="round"/>
  <!-- Right side rotary tuning dials & speaker grille -->
  <circle cx="51" cy="24" r="3.6" fill="#25362e" stroke="#8da89a" stroke-width="1.2"/>
  <circle cx="51" cy="34" r="3.6" fill="#25362e" stroke="#8da89a" stroke-width="1.2"/>
  <line x1="47.5" y1="42" x2="54.5" y2="42" stroke="#8da89a" stroke-width="1.3"/>
  <line x1="47.5" y1="45.5" x2="54.5" y2="45.5" stroke="#8da89a" stroke-width="1.3"/>
  <line x1="47.5" y1="49" x2="54.5" y2="49" stroke="#8da89a" stroke-width="1.3"/>
</svg>`;

  // 3. ChatGPT — Skeuomorphic dark emerald metallic medallion with embossed 6-petal neural knot
  const CHATGPT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <radialGradient id="cgBg" cx="38%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#2b8c76"/>
      <stop offset="60%" stop-color="#124a3e"/>
      <stop offset="100%" stop-color="#08241e"/>
    </radialGradient>
    <linearGradient id="cgGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d4fff2" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#d4fff2" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="27" fill="url(#cgBg)" stroke="#62d9bc" stroke-width="2"/>
  <ellipse cx="32" cy="18" rx="18" ry="9" fill="url(#cgGloss)"/>
  <g transform="translate(32,32)" fill="none" stroke="#dcfff4" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M0,-14 C6,-14 10,-9 8,-3 L-2,3" transform="rotate(0)"/>
    <path d="M0,-14 C6,-14 10,-9 8,-3 L-2,3" transform="rotate(60)"/>
    <path d="M0,-14 C6,-14 10,-9 8,-3 L-2,3" transform="rotate(120)"/>
    <path d="M0,-14 C6,-14 10,-9 8,-3 L-2,3" transform="rotate(180)"/>
    <path d="M0,-14 C6,-14 10,-9 8,-3 L-2,3" transform="rotate(240)"/>
    <path d="M0,-14 C6,-14 10,-9 8,-3 L-2,3" transform="rotate(300)"/>
  </g>
</svg>`;

  // 4. Antigravity — Glossy skeuomorphic zero-G orbital crest & floating delta prism
  const ANTIGRAVITY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <linearGradient id="agBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22575e"/>
      <stop offset="55%" stop-color="#102e36"/>
      <stop offset="100%" stop-color="#07181d"/>
    </linearGradient>
    <linearGradient id="agApex" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9effe6"/>
      <stop offset="100%" stop-color="#28d49c"/>
    </linearGradient>
    <linearGradient id="agGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c4fff5" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#c4fff5" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="52" height="52" rx="13" fill="url(#agBg)" stroke="#5ae0cc" stroke-width="2"/>
  <rect x="8" y="8" width="48" height="22" rx="10" fill="url(#agGloss)"/>
  <!-- Levitating orbital ring -->
  <ellipse cx="32" cy="37" rx="19" ry="7" fill="none" stroke="#5ae0cc" stroke-width="1.8" transform="rotate(-14 32 37)" opacity="0.8"/>
  <!-- Sculpted floating 'A' delta -->
  <path d="M32 14 L46 47 L39.5 47 L36 38 L28 38 L24.5 47 L18 47 Z M32 23.5 L29.4 33 L34.6 33 Z" fill="url(#agApex)" stroke="#0c2624" stroke-width="0.9"/>
  <circle cx="48" cy="24" r="2.4" fill="#b8fff4"/>
</svg>`;

  // 5. X — Skeuomorphic dark beveled keycap with metallic double-stroke X
  const X_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <linearGradient id="xKey" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#354742"/>
      <stop offset="50%" stop-color="#192421"/>
      <stop offset="100%" stop-color="#0b1210"/>
    </linearGradient>
    <linearGradient id="xGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d2fff0" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#d2fff0" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="52" height="52" rx="12" fill="url(#xKey)" stroke="#6ea391" stroke-width="2"/>
  <rect x="9" y="9" width="46" height="21" rx="9" fill="url(#xGloss)"/>
  <!-- Engraved X glyph -->
  <path d="M18 17 L25.5 17 L46 47 L38.5 47 Z" fill="#d8fff0"/>
  <path d="M44.5 17 L34.2 29.8 L31.2 25.5 L39.5 17 Z M29.8 34.5 L19.5 47 L24.5 47 L32.8 38.6 Z" fill="#90d9bf"/>
</svg>`;

  // 6. Facebook — Classic 2008 glossy dark-slate-indigo beveled 'f' tile
  const FACEBOOK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <linearGradient id="fbBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3a5c85"/>
      <stop offset="60%" stop-color="#223b5c"/>
      <stop offset="100%" stop-color="#12233a"/>
    </linearGradient>
    <linearGradient id="fbGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d0ebff" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#d0ebff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="52" height="52" rx="11" fill="url(#fbBg)" stroke="#6d99c7" stroke-width="2"/>
  <rect x="8" y="8" width="48" height="22" rx="9" fill="url(#fbGloss)"/>
  <rect x="8" y="47" width="48" height="9" rx="3" fill="#4f79ab" opacity="0.26"/>
  <path d="M36 56 L36 37 L42.5 37 L43.6 29.5 L36 29.5 L36 24.8 C36 22.6 36.8 21 39.8 21 L44 21 L44 14.3 C42.8 14.1 40.3 14 37.8 14 C31.8 14 28 17.6 28 24.1 L28 29.5 L22 29.5 L22 37 L28 37 L28 56 Z" fill="#e6f7ff"/>
</svg>`;

  // 7. Instagram — Classic 2011 Skeuomorphic Retro Polaroid Camera (muted nocturnal leather & glass lens!)
  const INSTAGRAM_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <linearGradient id="igTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5e4637"/>
      <stop offset="100%" stop-color="#38281f"/>
    </linearGradient>
    <linearGradient id="igBot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4e5952"/>
      <stop offset="100%" stop-color="#27302b"/>
    </linearGradient>
    <radialGradient id="igLens" cx="38%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#4fd4b4"/>
      <stop offset="40%" stop-color="#143d38"/>
      <stop offset="100%" stop-color="#071210"/>
    </radialGradient>
  </defs>
  <clipPath id="igClip"><rect x="6" y="6" width="52" height="52" rx="12"/></clipPath>
  <g clip-path="url(#igClip)">
    <rect x="6" y="6" width="52" height="20" fill="url(#igTop)"/>
    <rect x="6" y="26" width="52" height="32" fill="url(#igBot)"/>
    <!-- Classic muted rainbow corner stripe -->
    <rect x="12" y="6" width="2.4" height="20" fill="#c7524a" opacity="0.85"/>
    <rect x="14.4" y="6" width="2.4" height="20" fill="#cf9c46" opacity="0.85"/>
    <rect x="16.8" y="6" width="2.4" height="20" fill="#42a866" opacity="0.85"/>
    <rect x="19.2" y="6" width="2.4" height="20" fill="#468ac2" opacity="0.85"/>
  </g>
  <rect x="6" y="6" width="52" height="52" rx="12" fill="none" stroke="#85a696" stroke-width="2"/>
  <line x1="7" y1="26" x2="57" y2="26" stroke="#18211d" stroke-width="1.6"/>
  <!-- Viewfinder -->
  <rect x="44" y="12" width="8" height="8" rx="2" fill="#131c19" stroke="#7d998b" stroke-width="1.1"/>
  <!-- Recessed glass camera lens -->
  <circle cx="32" cy="34" r="13.5" fill="#1a2621" stroke="#99bfb0" stroke-width="2.2"/>
  <circle cx="32" cy="34" r="9.5" fill="url(#igLens)" stroke="#3e6e5f" stroke-width="1.2"/>
  <circle cx="28.5" cy="30.5" r="2.6" fill="#c7fff0" opacity="0.72"/>
</svg>`;

  // 8. Telegram — Glossy dark cerulean-emerald 3D glass sphere with embossed paper plane
  const TELEGRAM_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <radialGradient id="tgBall" cx="35%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#3da8c4"/>
      <stop offset="58%" stop-color="#195c78"/>
      <stop offset="100%" stop-color="#0b2c3d"/>
    </radialGradient>
    <linearGradient id="tgGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d4f7ff" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#d4f7ff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="27" fill="url(#tgBall)" stroke="#68cde6" stroke-width="2"/>
  <ellipse cx="32" cy="17" rx="17" ry="8.5" fill="url(#tgGloss)"/>
  <!-- Embossed paper airplane -->
  <polygon points="15,32 47,19 41,46 30,38 25,42 26,35" fill="#e6fcff"/>
  <polygon points="47,19 26,35 30,38" fill="#8fd5e8"/>
</svg>`;

  // 9. LINE (Tokyo, Japan HQ) — Classic glossy skeuomorphic green speech bubble
  const LINE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <linearGradient id="lnBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2c9c56"/>
      <stop offset="60%" stop-color="#176135"/>
      <stop offset="100%" stop-color="#0b361c"/>
    </linearGradient>
    <linearGradient id="lnGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ccffe0" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="#ccffe0" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="52" height="52" rx="13" fill="url(#lnBg)" stroke="#5ee08e" stroke-width="2"/>
  <rect x="8" y="8" width="48" height="22" rx="10" fill="url(#lnGloss)"/>
  <path d="M32 17 C20 17 12 24 12 32.5 C12 39.2 17.6 44.6 25.5 46.5 L24 51.5 L31.2 47.4 C31.5 47.4 31.7 47.4 32 47.4 C44 47.4 52 40.5 52 32.5 C52 24 44 17 32 17 Z" fill="#e6fff0"/>
  <text x="32" y="36" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-weight="800" font-size="11.5" fill="#13592f" letter-spacing="0.5">LINE</text>
</svg>`;

  // Geographically distributed across North America, Europe, and Japan (Tokyo)
  const SERVICE_NODES = [
    // North America (USA + Canada)
    { id: 'google',      name: 'Google',      region: 'US West',    lat: 47.6, lon: -122.3, icon: svgToImage(GOOGLE_SVG) },
    { id: 'antigravity', name: 'Antigravity', region: 'Canada',     lat: 56.0, lon: -106.0, icon: svgToImage(ANTIGRAVITY_SVG) },
    { id: 'chatgpt',     name: 'ChatGPT',     region: 'US Central', lat: 39.7, lon: -101.0, icon: svgToImage(CHATGPT_SVG) },
    { id: 'x',           name: 'X',           region: 'US South',   lat: 26.5, lon: -97.5,  icon: svgToImage(X_SVG) },
    { id: 'youtube',     name: 'YouTube',     region: 'US East',    lat: 41.0, lon: -74.0,  icon: svgToImage(YOUTUBE_SVG) },
    // Japan (mother company HQ in Japan)
    { id: 'line',        name: 'LINE',        region: 'Tokyo, JP',  lat: 35.7, lon: 139.7,  icon: svgToImage(LINE_SVG) },
    // Europe (Ireland/UK, France/West EU, Northern/Central EU)
    { id: 'facebook',    name: 'Facebook',    region: 'Ireland',    lat: 53.3, lon: -6.2,   icon: svgToImage(FACEBOOK_SVG) },
    { id: 'instagram',   name: 'Instagram',   region: 'France',     lat: 46.5, lon: 4.5,    icon: svgToImage(INSTAGRAM_SVG) },
    { id: 'telegram',    name: 'Telegram',    region: 'Europe',     lat: 57.5, lon: 16.5,   icon: svgToImage(TELEGRAM_SVG) }
  ];

  global.ServiceRadarNodes = SERVICE_NODES;
})(window);
