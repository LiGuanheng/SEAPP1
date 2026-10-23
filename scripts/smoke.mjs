/**
 * 端到端冒烟测试（真实浏览器，可指向本地或线上地址）。
 * 用法：node scripts/smoke.mjs [url]
 * 默认 http://localhost:4175/SEAPP1/
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('未找到 Chrome/Edge');
  process.exit(2);
}

const url = process.argv[2] || 'http://localhost:4175/SEAPP1/';
const outDir = resolve('docs/screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--mute-audio', '--disable-background-timer-throttling'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE ${m.text()}`);
});
page.on('requestfailed', (r) => errors.push(`REQFAIL ${r.url()}`));

const steps = [];
const step = (name, ok, extra = '') => {
  steps.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await wait(1200);
step('主菜单渲染', await page.evaluate(() => !!document.querySelector('.menu-actions .btn-primary')));
await page.screenshot({ path: `${outDir}/smoke-1-menu.png` });

await page.click('.menu-actions .btn-primary');
await wait(900);
step('开场演出出现', await page.evaluate(() => !!document.querySelector('.intro-skip')));
await page.screenshot({ path: `${outDir}/smoke-2-intro.png` });
await page.click('.intro-skip');
await wait(2400);
const council = await page.evaluate(() => ({
  cards: document.querySelectorAll('.build-card').length,
  day: window.__SEAPP1__?.state?.day,
  canvas: !!document.querySelector('canvas'),
}));
step('进入议事厅', council.day === 1 && council.cards >= 6, `建造卡 ${council.cards} 张`);
step('议事厅地图渲染', council.canvas);
await page.screenshot({ path: `${outDir}/smoke-3-council.png` });

const buildResult = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.build-card .mini-btn')].find((x) => x.textContent.includes('尸巢 30'));
  b?.click();
  const s = window.__SEAPP1__.state;
  return { corpses: s.resources.corpses, buildings: s.buildings.length };
});
step('建造尸巢扣资源', buildResult.corpses === 50 && buildResult.buildings === 2, JSON.stringify(buildResult));

await page.click('.march-btn');
await wait(3200);
const battle = await page.evaluate(() => ({
  hasSim: !!window.__SEAPP1__?.scene?.sim,
  cards: document.querySelectorAll('.unit-card').length,
  time: window.__SEAPP1__?.scene?.sim?.timeLimit,
}));
step('进入攻城战', battle.hasSim && battle.cards === 5, `限时 ${battle.time}s`);

await page.click('.unit-card');
await wait(300);
const box = await page.evaluate(() => {
  const c = window.__SEAPP1__.scene;
  const cam = c.cameras.main;
  const p = cam.getWorldPoint(720, 700);
  return { x: 720, y: 700, wx: Math.round(p.x), wy: Math.round(p.y) };
});
await page.mouse.click(720, 700);
await wait(600);
const deployed = await page.evaluate(() => window.__SEAPP1__.scene.sim.deployedTotal);
step('卡片投放部队', deployed.zombie > 0, `投放 ${deployed.zombie} 食尸鬼 @ (${box.wx},${box.wy})`);
await page.screenshot({ path: `${outDir}/smoke-4-battle.png` });

// 退出部署模式后框选
await page.keyboard.press('Escape');
await wait(300);
await page.mouse.move(400, 300);
await page.mouse.down();
await page.mouse.move(1100, 760, { steps: 8 });
await page.mouse.up();
await wait(400);
const selected = await page.evaluate(() => window.__SEAPP1__.scene.selection.length);
step('框选部队', selected > 0, `选中 ${selected}`);

await page.evaluate(() => window.__SEAPP1__.scene.advanceFor(120));
await wait(900);
const fight = await page.evaluate(() => {
  const s = window.__SEAPP1__.scene;
  const sim = s.sim;
  return {
    gates: s.state.walls.filter((w) => w.destroyed).length,
    kills: sim.kills,
    alive: sim.aliveUndead(),
    lighthouse: Math.round(sim.structures.get('lighthouse').hp),
  };
});
step('攻城推进与破墙', fight.gates > 0 || fight.kills > 0, JSON.stringify(fight));
await page.screenshot({ path: `${outDir}/smoke-5-breach.png` });

const retreat = await page.evaluate(() => {
  window.__SEAPP1__.scene.sim.retreat();
  return true;
});
void retreat;
await wait(2600);
step('战报面板出现', await page.evaluate(() => !!document.querySelector('.report')));
await page.screenshot({ path: `${outDir}/smoke-6-report.png` });

await page.evaluate(() => {
  const b = [...document.querySelectorAll('.report-foot .btn')].pop();
  b?.click();
});
await wait(2800);
const day2 = await page.evaluate(() => ({
  day: window.__SEAPP1__.state.day,
  phase: window.__SEAPP1__.state.phase,
  charge: window.__SEAPP1__.state.lighthouse.charge,
  zombies: window.__SEAPP1__.state.inventory.zombie,
}));
step('进入第 2 天', day2.day === 2 && day2.phase === 'council', JSON.stringify(day2));

// 存档
const saved = await page.evaluate(() => !!localStorage.getItem('SEAPP1.zombie-siege.save.v1'));
step('本地自动存档', saved);
await page.screenshot({ path: `${outDir}/smoke-7-day2.png` });

await browser.close();

const failed = steps.filter((s) => !s.ok);
console.log('\n==== SMOKE SUMMARY ====');
console.log(`${steps.length - failed.length}/${steps.length} passed`);
if (errors.length) {
  console.log('console errors:');
  for (const e of errors.slice(0, 10)) console.log('  ' + e);
}
console.log(JSON.stringify({ url, steps, errors }, null, 2));
process.exit(failed.length ? 1 : 0);
