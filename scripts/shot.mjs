/**
 * 无头浏览器截图与烟测脚本（使用本机 Chrome，不下载浏览器）。
 * 用法：
 *   node scripts/shot.mjs --url=http://localhost:4173/SEAPP1/ --out=docs/screenshots/x.png
 *   node scripts/shot.mjs --url=... --out=... --click=".btn-primary" --wait=1200
 *   node scripts/shot.mjs --url=... --out=... --eval="window.__game.debugJump(5)"
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const idx = a.indexOf('=');
    return idx === -1 ? [a.replace(/^--/, ''), 'true'] : [a.slice(2, idx), a.slice(idx + 1)];
  }),
);

const url = args.url || 'http://localhost:4173/SEAPP1/';
const out = resolve(args.out || 'docs/screenshots/shot.png');
const wait = Number(args.wait || 900);
const clicks = args.click ? String(args.click).split('|') : [];
const evals = args.eval ? String(args.eval).split('|') : [];
const speed = Number(args.speed || 1);
const width = Number(args.width || 1440);
const height = Number(args.height || 900);

mkdirSync(dirname(out), { recursive: true });

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('未找到 Chrome/Edge 可执行文件');
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--hide-scrollbars',
    '--mute-audio',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion,TranslateUI',
  ],
  defaultViewport: { width, height, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));
page.on('requestfailed', (req) => errors.push(`REQFAIL: ${req.url()} ${req.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

// 保持渲染帧活跃：无头模式下单纯等待会被浏览器降频，导致 Phaser 看起来“卡住”
async function waitAlive(ms) {
  const end = Date.now() + ms;
  let tick = 0;
  while (Date.now() < end) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(0))));
    // 轻微移动鼠标，避免无头浏览器把页面当作被遮挡而停止合成
    await page.mouse.move(640 + (tick % 7) * 6, 400 + (tick % 5) * 5).catch(() => {});
    tick++;
    await new Promise((r) => setTimeout(r, 100));
  }
}
await waitAlive(wait);

for (const sel of clicks) {
  const target = sel.startsWith('text=') ? `::-p-text(${sel.slice(5)})` : sel;
  await page.waitForSelector(target, { timeout: 15000 });
  await page.click(target);
  await waitAlive(700);
}

const advance = Number(args.advance || 0);
if (advance > 0) {
  await page.evaluate((sec) => {
    const g = window.__SEAPP1__;
    if (g?.scene?.advanceFor) g.scene.advanceFor(sec);
  }, advance);
  await new Promise((r) => setTimeout(r, 1200));
}

if (speed !== 1) {
  await page.evaluate((sp) => {
    const g = window.__SEAPP1__;
    if (g?.scene?.setSpeed) g.scene.setSpeed(sp);
  }, speed);
}

await page.bringToFront();
await page.evaluate(() => window.focus());

for (const code of evals) {
  await page.evaluate(code);
  await waitAlive(700);
}

await page.mouse.move(width / 2, height / 2);
await new Promise((r) => setTimeout(r, 120));
await page.screenshot({ path: out });
const title = await page.title();
const dims = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const g = window.__SEAPP1__;
  return {
    canvas: c ? `${c.width}x${c.height}` : 'none',
    body: `${document.body.clientWidth}x${document.body.clientHeight}`,
    inFocus: g?.game?.loop?.inFocus,
    simElapsed: g?.scene?.sim ? +g.scene.sim.elapsed.toFixed(1) : undefined,
    simUnits: g?.scene?.sim?.units?.length,
    badge: document.querySelector('.demo-badge')?.textContent,
  };
});
console.log(JSON.stringify({ url, out, title, dims, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
