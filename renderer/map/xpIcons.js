/**
 * Retro Windows XP "My Computer" & "Remote Server" SVG icons
 * Color-graded in dark tactical emerald/slate to blend seamlessly into the dark radar world map
 * while preserving the unmistakable nostalgic Windows XP CRT + desktop + server silhouettes.
 */
(function (global) {
  const MY_COMPUTER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <!-- Dark metallic slate-emerald XP CRT shell -->
    <linearGradient id="crtBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3c5a4d"/>
      <stop offset="50%" stop-color="#22382f"/>
      <stop offset="100%" stop-color="#111f19"/>
    </linearGradient>
    <linearGradient id="crtSide" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d3229"/>
      <stop offset="100%" stop-color="#0b1511"/>
    </linearGradient>
    <!-- Muted nocturnal XP Bliss screen (emerald-teal phosphor) -->
    <linearGradient id="xpSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a282e"/>
      <stop offset="60%" stop-color="#124748"/>
      <stop offset="100%" stop-color="#1c665b"/>
    </linearGradient>
    <linearGradient id="xpHill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#26a662"/>
      <stop offset="100%" stop-color="#0d4a2b"/>
    </linearGradient>
    <linearGradient id="xpTaskbar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#165a5e"/>
      <stop offset="100%" stop-color="#0b3136"/>
    </linearGradient>
    <linearGradient id="caseTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#355246"/>
      <stop offset="100%" stop-color="#1d3129"/>
    </linearGradient>
    <linearGradient id="caseFront" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2a4339"/>
      <stop offset="65%" stop-color="#1b2f27"/>
      <stop offset="100%" stop-color="#101d18"/>
    </linearGradient>
    <linearGradient id="kbdGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#314d42"/>
      <stop offset="100%" stop-color="#162620"/>
    </linearGradient>
    <linearGradient id="glassGlare" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8affcb" stop-opacity="0.16"/>
      <stop offset="48%" stop-color="#8affcb" stop-opacity="0.02"/>
      <stop offset="52%" stop-color="#8affcb" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Ground shadow -->
  <ellipse cx="32" cy="57.5" rx="24" ry="4" fill="#000000" opacity="0.55"/>

  <!-- Classic horizontal desktop case -->
  <path d="M9 43 L16 38 L53 38 L57 43 L57 52 C57 53.2 56 54 54.8 54 L11.2 54 C10 54 9 53.2 9 52 Z"
        fill="url(#caseFront)" stroke="#4c8c6c" stroke-width="1.2" stroke-linejoin="round"/>
  <polygon points="10,43 16.5,38.5 52.5,38.5 56,43" fill="url(#caseTop)"/>
  <!-- CD-ROM & floppy slots + subtle LEDs -->
  <rect x="13" y="45.6" width="16" height="2.8" rx="0.7" fill="#13241d" stroke="#3c7056" stroke-width="0.7"/>
  <rect x="33" y="46.2" width="10" height="1.6" rx="0.4" fill="#0d1a14"/>
  <circle cx="49" cy="47.2" r="1.4" fill="#2ee88a"/>
  <circle cx="53" cy="47.2" r="1.0" fill="#c79e3e" opacity="0.8"/>

  <!-- CRT rear tube & stand -->
  <path d="M46 10 L53 15 L52 33 L46 37 Z" fill="url(#crtSide)" stroke="#427a5e" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="M25 36 L39 36 L42 41 L22 41 Z" fill="#1b2f27" stroke="#427a5e" stroke-width="1.1" stroke-linejoin="round"/>

  <!-- CRT front bezel -->
  <rect x="10" y="7" width="38" height="30" rx="3" fill="url(#crtBody)" stroke="#58a37d" stroke-width="1.3"/>
  <rect x="13.5" y="10.5" width="31" height="22.5" rx="1.4" fill="#081511" stroke="#36664f" stroke-width="0.8"/>

  <!-- Nocturnal XP Bliss desktop inside CRT -->
  <clipPath id="crtScreenClip">
    <rect x="14.6" y="11.6" width="28.8" height="20.3" rx="1"/>
  </clipPath>
  <g clip-path="url(#crtScreenClip)">
    <rect x="14.6" y="11.6" width="28.8" height="20.3" fill="url(#xpSky)"/>
    <ellipse cx="22" cy="15.5" rx="4.2" ry="1.3" fill="#8ef7dc" opacity="0.22"/>
    <ellipse cx="34" cy="14.6" rx="5.0" ry="1.5" fill="#8ef7dc" opacity="0.18"/>
    <path d="M13 25 Q23 19.5 33 23.5 T45 22 L45 32 L13 32 Z" fill="url(#xpHill)"/>
    <!-- XP taskbar & start pill -->
    <rect x="14.6" y="29" width="28.8" height="3" fill="url(#xpTaskbar)"/>
    <rect x="14.6" y="29" width="7" height="3" rx="0.8" fill="#239657"/>
    <polygon points="14.6,11.6 34,11.6 22,31.9 14.6,31.9" fill="url(#glassGlare)"/>
  </g>

  <!-- Bezel LED & buttons -->
  <circle cx="42.5" cy="34.8" r="1.1" fill="#2ee88a"/>
  <rect x="35" y="34.2" width="4.5" height="1.1" rx="0.4" fill="#3a6350"/>

  <!-- Classic angled keyboard -->
  <polygon points="5,58 11,52.5 47,52.5 52,58" fill="url(#kbdGrad)" stroke="#4c8c6c" stroke-width="1.1" stroke-linejoin="round"/>
  <line x1="12" y1="54.5" x2="45" y2="54.5" stroke="#539172" stroke-width="1.0" stroke-dasharray="2.5 1.5" opacity="0.75"/>
  <line x1="9.5" y1="56.3" x2="47.5" y2="56.3" stroke="#539172" stroke-width="1.0" stroke-dasharray="3 1.5" opacity="0.75"/>
</svg>`;

  const XP_SERVER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">
  <defs>
    <!-- Dark tactical steel-emerald server tower -->
    <linearGradient id="srvFront" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#37574c"/>
      <stop offset="50%" stop-color="#1e342c"/>
      <stop offset="100%" stop-color="#0f1c17"/>
    </linearGradient>
    <linearGradient id="srvSide" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#192d26"/>
      <stop offset="100%" stop-color="#091310"/>
    </linearGradient>
    <linearGradient id="srvScreen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#041910"/>
      <stop offset="100%" stop-color="#0a3320"/>
    </linearGradient>
    <!-- Dark radar-matched XP network globe -->
    <radialGradient id="xpGlobe" cx="35%" cy="32%" r="65%">
      <stop offset="0%" stop-color="#3fb3a0"/>
      <stop offset="52%" stop-color="#155754"/>
      <stop offset="100%" stop-color="#072226"/>
    </radialGradient>
    <linearGradient id="srvGlass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7dffba" stop-opacity="0.16"/>
      <stop offset="50%" stop-color="#7dffba" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Shadow -->
  <ellipse cx="32" cy="57.5" rx="23" ry="4" fill="#000000" opacity="0.58"/>

  <!-- Left tall XP server tower -->
  <polygon points="30,8 37,11.5 37,49.5 30,53" fill="url(#srvSide)" stroke="#427a5e" stroke-width="1.1" stroke-linejoin="round"/>
  <rect x="8" y="8" width="22" height="45" rx="2.2" fill="url(#srvFront)" stroke="#58a37d" stroke-width="1.3"/>
  <!-- Drive bays -->
  <rect x="11.5" y="12.5" width="15" height="3.4" rx="0.7" fill="#13261f" stroke="#3c7358" stroke-width="0.7"/>
  <rect x="11.5" y="18.2" width="15" height="3.4" rx="0.7" fill="#13261f" stroke="#3c7358" stroke-width="0.7"/>
  <rect x="11.5" y="24" width="15" height="3.0" rx="0.7" fill="#0d1b16"/>
  <!-- Status LEDs -->
  <circle cx="13.5" cy="31" r="1.5" fill="#2ee88a"/>
  <circle cx="18.5" cy="31" r="1.3" fill="#32c9c4"/>
  <circle cx="23" cy="31" r="1.1" fill="#cca241" opacity="0.85"/>
  <!-- Ventilation grille -->
  <line x1="12" y1="37" x2="26" y2="37" stroke="#3d7358" stroke-width="1.4"/>
  <line x1="12" y1="40.5" x2="26" y2="40.5" stroke="#3d7358" stroke-width="1.4"/>
  <line x1="12" y1="44" x2="26" y2="44" stroke="#3d7358" stroke-width="1.4"/>
  <line x1="12" y1="47.5" x2="26" y2="47.5" stroke="#3d7358" stroke-width="1.4"/>

  <!-- Right companion XP CRT Console -->
  <rect x="27" y="16" width="29" height="24" rx="2.6" fill="url(#srvFront)" stroke="#58a37d" stroke-width="1.3"/>
  <path d="M36 40 L47 40 L49 45 L34 45 Z" fill="#1a2f27" stroke="#427a5e" stroke-width="1.0"/>
  <rect x="30" y="19" width="23" height="17.5" rx="1.1" fill="url(#srvScreen)" stroke="#386e54" stroke-width="0.8"/>
  <!-- Subtle green terminal lines -->
  <line x1="32.5" y1="22.8" x2="43" y2="22.8" stroke="#2ee88a" stroke-width="1.2"/>
  <line x1="32.5" y1="26.2" x2="48.5" y2="26.2" stroke="#32c9c4" stroke-width="1.1" opacity="0.85"/>
  <line x1="32.5" y1="29.6" x2="45.5" y2="29.6" stroke="#2ee88a" stroke-width="1.1" opacity="0.8"/>
  <line x1="32.5" y1="33" x2="39" y2="33" stroke="#62d99a" stroke-width="1.1" opacity="0.7"/>
  <polygon points="30,19 45,19 36,36.5 30,36.5" fill="url(#srvGlass)"/>
  <circle cx="51" cy="38.2" r="1.0" fill="#2ee88a"/>

  <!-- Nocturnal XP Network Globe Badge -->
  <g transform="translate(46, 45)">
    <circle cx="0" cy="0" r="11" fill="url(#xpGlobe)" stroke="#4da386" stroke-width="1.2"/>
    <path d="M-6.5,-2.5 Q-2.8,-6.2 1.8,-4.5 Q4.5,-1.8 2.8,1.8 Q-1,3.5 -4.8,1.8 Z" fill="#26a662" opacity="0.82"/>
    <path d="M2.8,2.8 Q6.2,2 7.2,5.5 Q4.6,8 1.8,6.4 Z" fill="#1f8a50" opacity="0.82"/>
    <ellipse cx="0" cy="0" rx="10.5" ry="4.2" fill="none" stroke="#85e6cf" stroke-width="0.65" opacity="0.38"/>
    <ellipse cx="0" cy="0" rx="4.8" ry="10.5" fill="none" stroke="#85e6cf" stroke-width="0.65" opacity="0.38"/>
  </g>
</svg>`;

  function svgToImage(svgText) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText.trim());
    return img;
  }

  global.XPIcons = {
    myComputer: svgToImage(MY_COMPUTER_SVG),
    xpServer: svgToImage(XP_SERVER_SVG)
  };
})(window);
