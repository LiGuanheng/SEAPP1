import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--mute-audio"],
  defaultViewport: { width: 1600, height: 1000 },
});
const p = await browser.newPage();
p.on("pageerror", (e) => console.log("ERROR", e.message));
await p.goto("http://127.0.0.1:5186/", { waitUntil: "networkidle0" });
await p.waitForSelector('[data-action="new"]');
await p.click('[data-action="new"]');
await p.click('[data-action="next"]');
await p.click('[data-action="next"]');
await p.click('[data-action="commander"][data-key="titan"]');
await p.click('[data-action="next"]');
await p.click('[data-action="preset"][data-key="breach"]');
await p.click('[data-action="launch"]');
await p.click('[data-action="skip-intro"]');
await p.click('[data-action="overview"]');
await new Promise((r) => setTimeout(r, 800));
await p.screenshot({ path: "docs/screenshots/v3/01-first-city.png" });
console.log(
  await p.evaluate(() => ({
    snapshot: window.__SIEGE__.battle.snapshot(),
    size: document.querySelector("#battle-canvas").getBoundingClientRect().toJSON(),
    newArt: [...document.images].filter((i) => i.src.includes("v3")),
  })),
);
await browser.close();
