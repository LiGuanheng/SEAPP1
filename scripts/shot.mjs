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
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--mute-audio'],
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
await new Promise((r) => setTimeout(r, wait));

for (const sel of clicks) {
  const target = sel.startsWith('text=') ? `::-p-text(${sel.slice(5)})` : sel;
  await page.waitForSelector(target, { timeout: 15000 });
  await page.click(target);
  await new Promise((r) => setTimeout(r, 700));
}

for (const code of evals) {
  await page.evaluate(code);
  await new Promise((r) => setTimeout(r, 700));
}

await page.screenshot({ path: out });
const title = await page.title();
const dims = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { canvas: c ? `${c.width}x${c.height}` : 'none', body: `${document.body.clientWidth}x${document.body.clientHeight}` };
});
console.log(JSON.stringify({ url, out, title, dims, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
