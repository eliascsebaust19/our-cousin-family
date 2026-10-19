import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ICONS_DIR = path.resolve(process.cwd(), "public/icons");
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

function generateSvg({ maskable = false }) {
  // If maskable, fill edge-to-edge without rounded corners, content in safe zone (center 75%)
  if (maskable) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#23815c" />
      <stop offset="100%" stop-color="#144d36" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#072016" flood-opacity="0.3" />
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" />
  <g transform="translate(76, 76) scale(0.70)" filter="url(#shadow)">
    <!-- Connected Cousin Figures -->
    <circle cx="170" cy="190" r="70" fill="#fdfcf9" />
    <circle cx="342" cy="190" r="70" fill="#fdfcf9" opacity="0.82" />
    <path
      d="M80 400 c18 -68 70 -105 132 -105 h88 c62 0 114 37 132 105"
      fill="none"
      stroke="#fdfcf9"
      stroke-width="48"
      stroke-linecap="round"
    />
    <circle cx="256" cy="115" r="28" fill="#e9b44c" />
  </g>
</svg>`.trim();
  }

  // Standard icon with rounded corners & subtle border
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg-std" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#23815c" />
      <stop offset="100%" stop-color="#144d36" />
    </linearGradient>
    <filter id="shadow-std" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#072016" flood-opacity="0.35" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bg-std)" />
  <g transform="translate(30, 20) scale(0.88)" filter="url(#shadow-std)">
    <!-- Connected Cousin Figures -->
    <circle cx="170" cy="190" r="70" fill="#fdfcf9" />
    <circle cx="342" cy="190" r="70" fill="#fdfcf9" opacity="0.85" />
    <path
      d="M80 400 c18 -68 70 -105 132 -105 h88 c62 0 114 37 132 105"
      fill="none"
      stroke="#fdfcf9"
      stroke-width="48"
      stroke-linecap="round"
    />
    <circle cx="256" cy="115" r="28" fill="#e9b44c" />
  </g>
</svg>`.trim();
}

async function main() {
  const stdSvg = generateSvg({ maskable: false });
  const maskSvg = generateSvg({ maskable: true });

  fs.writeFileSync(path.join(ICONS_DIR, "icon.svg"), stdSvg, "utf8");
  fs.writeFileSync(path.join(ICONS_DIR, "icon-maskable.svg"), maskSvg, "utf8");
  console.log("Wrote SVG icons.");

  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage();

  const targets = [
    { svg: stdSvg, file: "icon-192.png", size: 192 },
    { svg: stdSvg, file: "icon-512.png", size: 512 },
    { svg: maskSvg, file: "icon-192-maskable.png", size: 192 },
    { svg: maskSvg, file: "icon-512-maskable.png", size: 512 },
    { svg: stdSvg, file: "apple-touch-icon.png", size: 180 },
  ];

  for (const { svg, file, size } of targets) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:transparent;">${svg}</body></html>`);
    const outPath = path.join(ICONS_DIR, file);
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log(`Generated ${file} (${size}x${size})`);
  }

  // Also copy apple-touch-icon.png to public root for default Apple mobile web apps
  fs.copyFileSync(path.join(ICONS_DIR, "apple-touch-icon.png"), path.resolve(process.cwd(), "public/apple-touch-icon.png"));
  console.log("Copied apple-touch-icon.png to public/apple-touch-icon.png");

  await browser.close();
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});

