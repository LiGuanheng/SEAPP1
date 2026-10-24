import puppeteer from "puppeteer-core";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const url = process.argv[2] ?? "https://liguanheng.github.io/SEAPP1/";
const expectedCommit = process.argv[3];
const executablePath =
  process.env.CHROME_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--mute-audio"],
    defaultViewport: { width: 1440, height: 900 },
  }),
  page = await browser.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
});
try {
  const response = await page.goto(
    url + (url.includes("?") ? "&" : "?") + "release-audit=" + Date.now(),
    { waitUntil: "networkidle2", timeout: 60000 },
  );
  await page.waitForSelector('[data-action="new"]', { timeout: 45000 });
  const local = JSON.parse(readFileSync("dist/build-manifest.json", "utf8"));
  const remote = await page.evaluate(async () => {
    const r = await fetch("build-manifest.json?audit=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(`manifest HTTP ${r.status}`);
    return r.json();
  });
  const fileChecks = await page.evaluate(
    async (files) =>
      Promise.all(
        files.map(async (file) => {
          const r = await fetch(file.path + "?audit=" + Date.now(), { cache: "no-store" });
          const bytes = await r.arrayBuffer(),
            digest = await crypto.subtle.digest("SHA-256", bytes),
            hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(
              "",
            );
          return {
            path: file.path,
            status: r.status,
            match: hash === file.sha256,
            bytes: bytes.byteLength,
          };
        }),
      ),
    local.files,
  );
  const title = await page.title();
  await page.click('[data-action="new"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="next"]');
  const commanderCards = await page.$$eval(".commander-card", (els) => els.length);
  await page.click('[data-action="commander"][data-key="titan"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="preset"][data-key="breach"]');
  await page.click('[data-action="launch"]');
  await page.click('[data-action="skip-intro"]');
  await page.click('[data-action="direction"][data-key="west"]');
  await page.click('[data-action="rally-all"]');
  await new Promise((r) => setTimeout(r, 1400));
  const battle = await page.evaluate(() => window.__SIEGE__.battle.snapshot());
  await page.screenshot({ path: "docs/screenshots/v3.2/20-live-pages.png" });
  const result = {
    date: new Date().toISOString(),
    url,
    httpStatus: response.status(),
    title,
    expectedCommit: expectedCommit ?? null,
    deployedCommit: remote.sourceCommit,
    version: remote.version,
    cleanBuild: remote.dirtyWorkingTree === false,
    commanderCards,
    fileChecks,
    battle,
    errors,
    pass:
      response.status() === 200 &&
      title === "异界围城：魔物之王 · Monster Sovereign" &&
      commanderCards === 6 &&
      remote.version.startsWith("3.2.") &&
      remote.dirtyWorkingTree === false &&
      fileChecks.every((f) => f.status === 200 && f.match) &&
      (!expectedCommit || remote.sourceCommit === expectedCommit) &&
      battle.stats.deployed > 0 &&
      errors.length === 0,
  };
  writeFileSync("docs/v3.2/RELEASE_RESULTS.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
} finally {
  await browser.close();
}
