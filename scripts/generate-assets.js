/**
 * Pomflix asset generator — run with: node scripts/generate-assets.js
 * Requires: npm install sharp --save-dev --legacy-peer-deps
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ASSETS = path.join(__dirname, "..", "assets");
if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

// ─── Design tokens ──────────────────────────────────────────────────────────
const BG = "#0A0A0C";
const RED = "#8B1A2E";
const RED_MID = "#A32035";
const RED_BRIGHT = "#C5223A";
const RED_DARK = "#5C0E1C";
const SEED = "#F5BDBD";

// ─── Pomegranate icon SVG ────────────────────────────────────────────────────
function iconSVG(size) {
  const s = size;
  const cx = s * 0.5;
  const cy = s * 0.535;
  const bodyR = s * 0.288;
  const topY = cy - bodyR;

  const crownSpread = s * 0.133;
  const crownH = s * 0.092;       // tallest (center) prong height
  const crownHOuter = s * 0.072;  // outer prong height
  const crownW = s * 0.026;       // stroke width

  const seedR = s * 0.026;
  const g = seedR * 2.75;         // seed grid spacing

  return `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="52%" r="50%">
      <stop offset="0%" stop-color="${RED}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${RED}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="body" cx="37%" cy="31%" r="72%">
      <stop offset="0%" stop-color="${RED_BRIGHT}"/>
      <stop offset="52%" stop-color="${RED}"/>
      <stop offset="100%" stop-color="${RED_DARK}"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${s}" height="${s}" fill="${BG}"/>
  <rect width="${s}" height="${s}" fill="url(#bg)"/>

  <!-- Stem -->
  <line x1="${cx}" y1="${topY - crownH - s * 0.046}"
        x2="${cx}" y2="${topY - crownH + s * 0.004}"
        stroke="${RED_MID}" stroke-width="${crownW * 0.85}"
        stroke-linecap="round" opacity="0.65"/>

  <!-- Crown base arc -->
  <path d="M ${cx - crownSpread - crownW} ${topY + crownW * 0.5}
           Q ${cx} ${topY - crownH * 0.26} ${cx + crownSpread + crownW} ${topY + crownW * 0.5}"
        stroke="${RED_MID}" stroke-width="${crownW * 0.75}"
        stroke-linecap="round" fill="none" opacity="0.55"/>

  <!-- Crown prongs — 3 lines with round caps -->
  <line x1="${cx - crownSpread}" y1="${topY}"
        x2="${cx - crownSpread}" y2="${topY - crownHOuter}"
        stroke="${RED_MID}" stroke-width="${crownW}"
        stroke-linecap="round" opacity="0.9"/>
  <line x1="${cx}" y1="${topY}"
        x2="${cx}" y2="${topY - crownH}"
        stroke="${RED_MID}" stroke-width="${crownW}"
        stroke-linecap="round" opacity="0.9"/>
  <line x1="${cx + crownSpread}" y1="${topY}"
        x2="${cx + crownSpread}" y2="${topY - crownHOuter}"
        stroke="${RED_MID}" stroke-width="${crownW}"
        stroke-linecap="round" opacity="0.9"/>

  <!-- Body -->
  <circle cx="${cx}" cy="${cy}" r="${bodyR}" fill="url(#body)"/>

  <!-- Body rim (subtle darker stroke for volume) -->
  <circle cx="${cx}" cy="${cy}" r="${bodyR}"
          fill="none" stroke="${RED_DARK}" stroke-width="${s * 0.012}" opacity="0.35"/>

  <!-- Highlight -->
  <ellipse cx="${cx - bodyR * 0.21}" cy="${cy - bodyR * 0.27}"
           rx="${bodyR * 0.26}" ry="${bodyR * 0.165}"
           fill="white" opacity="0.11"/>

  <!-- Seeds — 7 dots, diamond cluster -->
  <circle cx="${cx}"          cy="${cy - g}"         r="${seedR}" fill="${SEED}" opacity="0.72"/>
  <circle cx="${cx - g}"      cy="${cy}"              r="${seedR}" fill="${SEED}" opacity="0.72"/>
  <circle cx="${cx}"          cy="${cy}"              r="${seedR}" fill="${SEED}" opacity="0.72"/>
  <circle cx="${cx + g}"      cy="${cy}"              r="${seedR}" fill="${SEED}" opacity="0.72"/>
  <circle cx="${cx - g * 0.55}" cy="${cy + g * 0.88}" r="${seedR}" fill="${SEED}" opacity="0.72"/>
  <circle cx="${cx + g * 0.55}" cy="${cy + g * 0.88}" r="${seedR}" fill="${SEED}" opacity="0.72"/>
  <circle cx="${cx}"          cy="${cy + g * 1.72}"  r="${seedR}" fill="${SEED}" opacity="0.65"/>
</svg>`;
}

// ─── Splash icon: bigger mark with "P" text if readable, else just mark ─────
function splashSVG(size) {
  // Splash is rendered via resizeMode:contain on the bg color
  // so we want the pomegranate centered with a bit of breathing room
  return iconSVG(size);
}

// ─── Android adaptive icon background ────────────────────────────────────────
function androidBgSVG(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${BG}"/>
</svg>`;
}

// ─── Android adaptive icon foreground (transparent bg, fruit only) ───────────
function androidFgSVG(size) {
  const svg = iconSVG(size);
  // Remove background rects — first two <rect> tags
  const trimmed = svg
    .replace(/<rect[^/]*fill="${BG}"[^/]*\/>/, "")
    .replace(/<rect[^/]*fill="url\(#bg\)"[^/]*\/>/, "");
  return trimmed;
}

// ─── Monochrome icon (white silhouette for notification icons etc) ────────────
function monoSVG(size) {
  const s = size;
  const cx = s * 0.5;
  const cy = s * 0.535;
  const bodyR = s * 0.288;
  const topY = cy - bodyR;
  const crownSpread = s * 0.133;
  const crownH = s * 0.092;
  const crownHOuter = s * 0.072;
  const crownW = s * 0.026;

  return `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${s}" height="${s}" fill="${BG}"/>
  <line x1="${cx}" y1="${topY - crownH - s*0.04}" x2="${cx}" y2="${topY - crownH}"
        stroke="white" stroke-width="${crownW * 0.85}" stroke-linecap="round" opacity="0.6"/>
  <path d="M ${cx - crownSpread} ${topY} Q ${cx} ${topY - crownH*0.24} ${cx + crownSpread} ${topY}"
        stroke="white" stroke-width="${crownW*0.7}" fill="none" stroke-linecap="round" opacity="0.5"/>
  <line x1="${cx - crownSpread}" y1="${topY}" x2="${cx - crownSpread}" y2="${topY - crownHOuter}"
        stroke="white" stroke-width="${crownW}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${topY}" x2="${cx}" y2="${topY - crownH}"
        stroke="white" stroke-width="${crownW}" stroke-linecap="round"/>
  <line x1="${cx + crownSpread}" y1="${topY}" x2="${cx + crownSpread}" y2="${topY - crownHOuter}"
        stroke="white" stroke-width="${crownW}" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="${bodyR}" fill="white" opacity="0.92"/>
</svg>`;
}

// ─── Favicon (48×48 simplified) ──────────────────────────────────────────────
function faviconSVG(size) {
  const s = size;
  const cx = s * 0.5;
  const cy = s * 0.55;
  const bodyR = s * 0.3;
  const topY = cy - bodyR;

  return `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${s}" height="${s}" fill="${BG}"/>
  <line x1="${cx}" y1="${topY}" x2="${cx}" y2="${topY - s*0.12}"
        stroke="${RED_MID}" stroke-width="${s*0.09}" stroke-linecap="round"/>
  <line x1="${cx - s*0.16}" y1="${topY}" x2="${cx - s*0.16}" y2="${topY - s*0.09}"
        stroke="${RED_MID}" stroke-width="${s*0.08}" stroke-linecap="round"/>
  <line x1="${cx + s*0.16}" y1="${topY}" x2="${cx + s*0.16}" y2="${topY - s*0.09}"
        stroke="${RED_MID}" stroke-width="${s*0.08}" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="${bodyR}" fill="${RED}"/>
  <circle cx="${cx}" cy="${cy}" r="${s*0.065}" fill="${SEED}" opacity="0.8"/>
</svg>`;
}

// ─── Generate all assets ─────────────────────────────────────────────────────
const assets = [
  { file: "icon.png",                     svg: iconSVG(1024) },
  { file: "splash-icon.png",              svg: splashSVG(512) },
  { file: "favicon.png",                  svg: faviconSVG(48) },
  { file: "android-icon-background.png",  svg: androidBgSVG(1024) },
  { file: "android-icon-foreground.png",  svg: androidFgSVG(1024) },
  { file: "android-icon-monochrome.png",  svg: monoSVG(1024) },
];

async function run() {
  console.log("Generating Pomflix assets...\n");
  for (const { file, svg } of assets) {
    const outPath = path.join(ASSETS, file);
    try {
      await sharp(Buffer.from(svg)).png().toFile(outPath);
      console.log(`  ✓  ${file}`);
    } catch (err) {
      console.error(`  ✗  ${file}:`, err.message);
    }
  }
  console.log("\nDone. Restart Expo to pick up the new icon.");
}

run();
