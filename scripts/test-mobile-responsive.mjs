import { chromium } from "@playwright/test";

const viewports = [
  { name: "Android Small (360x640)", width: 360, height: 640 },
  { name: "iPhone (390x844)", width: 390, height: 844 },
  { name: "Android Large (412x915)", width: 412, height: 915 },
];

const paths = ["/", "/login", "/signup", "/offline.html"];

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  let hasOverflow = false;

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    for (const p of paths) {
      await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        return {
          scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
          clientWidth: doc.clientWidth,
          hasHScroll: Math.max(doc.scrollWidth, body.scrollWidth) > doc.clientWidth + 1,
        };
      });

      if (overflow.hasHScroll) {
        console.error(
          `❌ [${vp.name}] ${p} has horizontal overflow! scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
        );
        hasOverflow = true;
      } else {
        console.log(`✅ [${vp.name}] ${p} fits perfectly (width: ${overflow.clientWidth}px)`);
      }
    }
    await context.close();
  }

  await browser.close();

  if (hasOverflow) {
    process.exit(1);
  } else {
    console.log("\n🎉 All tested pages are 100% mobile-responsive with zero horizontal overflow!");
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

