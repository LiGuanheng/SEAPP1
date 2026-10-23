import {
  ARMIES,
  ARMY_KEYS,
  COMMANDERS,
  COMMANDER_KEYS,
  DIFFICULTIES,
  SPECS,
  isArmy,
  isCommander,
  type Army,
  type Commander,
  type Difficulty,
  type Kind,
  type Specialization,
} from "./data";
import {
  batchPrice,
  createLoadout,
  dismiss,
  preset,
  purchase,
  recruit,
  refund,
  unlocked,
  type Loadout,
} from "./economy";
import { Battle } from "./simulation";
import { Renderer, artUrl, loadArt } from "./render";
import { sound } from "./sound";
import "./style.css";
const app = document.getElementById("app")!;
let loadout = createLoadout();
let initial: Loadout | null = null;
let battle: Battle | null = null;
let renderer: Renderer | null = null;
let abort: AbortController | null = null;
let wizard = 0;
let buyBatch = 1;
let deployBatch = 1;
let noticeTimer = 0;
let resultTimer = 0;
const $ = <T extends Element = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const money = (n: number) => Math.floor(n).toLocaleString("zh-CN");
const icon = (key: Kind) => {
  const i = isArmy(key) ? ARMIES[key].sprite : 15;
  return `<span class="unit-icon" style="--col:${i % 4};--row:${Math.floor(i / 4)}"></span>`;
};
const portrait = (c: Commander) =>
  `<div class="portrait" style="--col:${COMMANDERS[c].portrait % 3};--row:${Math.floor(COMMANDERS[c].portrait / 3)}"></div>`;
function notice(s: string) {
  const n = $("#notice");
  if (!n) return;
  n.textContent = s;
  n.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => n.classList.remove("show"), 2800);
}
function clearBattle() {
  abort?.abort();
  abort = null;
  renderer?.destroy();
  renderer = null;
  battle = null;
  clearTimeout(resultTimer);
}
const footer =
  '<div class="edition"><span>原创世界 · 单场实时攻城</span><span>MONSTER SOVEREIGN / V2</span></div>';
function menu() {
  clearBattle();
  app.innerHTML = `<main class="menu" style="--cover:url('${artUrl("cover")}')"><div class="menu-shade"></div><div class="brand-mark">M / S</div><div class="menu-content"><div class="eyebrow"><span class="gold-line"></span> THE LAST SIEGE</div><p class="over-title">异 界 围 城</p><h1>魔物之王</h1><p class="latin-title">MONSTER SOVEREIGN</p><div class="title-rule"></div><p class="menu-story">圣曜城的钟声，即将宣告世界的终结。<br>集结你的魔物联军，向帝国最后的光发起总攻。</p><button class="primary menu-start" data-action="new">开启最后总攻 <span>↗</span></button><button class="text-button" data-action="help">战场手册 <span>FIELD MANUAL</span></button></div><div class="menu-quote"><span>01 / 圣曜城</span><p>当群山苏醒，天空将不再属于帝国。</p></div>${footer}<div id="notice" role="status"></div></main>`;
  bindActions();
}
function bindActions() {
  app.onclick = (ev) => {
    const b = (ev.target as Element).closest<HTMLElement>("[data-action]");
    if (!b) return;
    sound.play("click");
    const a = b.dataset.action!;
    if (a === "new") {
      loadout = createLoadout();
      wizard = 0;
      showWizard();
    } else if (a === "help") showHelp();
    else if (a === "close-help") $("#help-modal").remove();
    else if (a === "menu") menu();
    else if (a === "prev") {
      if (wizard > 0) {
        wizard--;
        showWizard();
      } else menu();
    } else if (a === "next") {
      if (wizard === 2 && !loadout.commanders.length) {
        notice("请至少招募一位统帅");
        return;
      }
      wizard++;
      showWizard();
    } else if (a === "difficulty") {
      if (loadout.difficulty !== b.dataset.key)
        loadout = createLoadout(b.dataset.key as Difficulty, loadout.spec);
      showWizard();
    } else if (a === "spec") {
      if (loadout.spec !== b.dataset.key)
        loadout = createLoadout(
          loadout.difficulty,
          b.dataset.key as Specialization,
        );
      showWizard();
    } else if (a === "commander") {
      const k = b.dataset.key as Commander;
      const message = loadout.commanders.includes(k)
        ? dismiss(loadout, k)
          ? ""
          : "先退还该统帅的专属兵"
        : recruit(loadout, k)
          ? ""
          : "最多四位统帅，或魔晶不足";
      showWizard();
      if (message) notice(message);
    } else if (a === "preset") {
      loadout = preset(
        loadout.difficulty,
        loadout.spec,
        b.dataset.key as "breach" | "sky" | "swarm",
      );
      showWizard();
    } else if (a === "buy-pre") {
      const n = purchase(
        loadout,
        b.dataset.key as Army,
        Number(b.dataset.count),
      );
      showWizard();
      if (!n) notice("魔晶不足或尚未解锁");
    } else if (a === "refund") {
      refund(loadout, b.dataset.key as Army);
      showWizard();
    } else if (a === "launch") {
      if (!ARMY_KEYS.some((k) => loadout.inventory[k] > 0)) {
        notice("请先购买军团");
        return;
      }
      startBattle(loadout);
    } else if (a === "retry" && initial) startBattle(initial);
    else if (a === "reconfigure") {
      if (initial) loadout = structuredClone(initial);
      wizard = 3;
      clearBattle();
      showWizard();
    } else if (a === "skip-intro") {
      battle!.paused = false;
      $("#intro-overlay")?.remove();
      updateHud();
    } else if (a === "pause") {
      battle!.paused = !battle!.paused;
      updateHud();
    } else if (a === "speed") {
      battle!.speed = battle!.speed === 1 ? 2 : 1;
      updateHud();
    } else if (a === "overview") renderer?.overview();
    else if (a === "front") {
      if (renderer) renderer.camera = { x: 1600, y: 1630, zoom: 0.66 };
    } else if (a === "crystal") {
      if (renderer) renderer.camera = { x: 1600, y: 1080, zoom: 0.72 };
    } else if (a === "charge") {
      battle?.charge();
      notice("全军继续向圣晶推进 · 保留指定集火");
    } else if (a === "select-all") {
      battle!.selected = new Set(
        battle!.units.filter((u) => u.side === 0 && u.hp > 0).map((u) => u.id),
      );
      updateHud();
    } else if (a === "sound") {
      sound.toggle();
      b.textContent = sound.muted ? "音效 关" : "音效 开";
    } else if (a === "buy") {
      if (!battle!.buy(b.dataset.key as Army, buyBatch))
        notice("魔晶不足或兵种未解锁");
      updateHud();
    } else if (a === "deploy") aimDeploy(b.dataset.key as Kind);
    else if (a === "skill") aimSkill(b.dataset.key as Kind);
    else if (a === "all-deploy") {
      renderer!.mode = { type: "deploy", kind: "all" };
      notice("点击合法部署区，全部库存将依次出征");
      updateHud();
    } else if (a === "cancel") {
      renderer!.mode = { type: "none" };
      updateHud();
    }
  };
}
function showWizard() {
  const names = ["战役难度", "魔王专精", "统帅议会", "军团整备"];
  const steps = names
    .map(
      (n, i) =>
        `<div class="step ${wizard === i ? "current" : wizard > i ? "done" : ""}"><b>0${i + 1}</b><span>${n}</span></div>`,
    )
    .join("");
  let content = "";
  if (wizard === 0)
    content = `<div class="choice-grid difficulty">${(
      Object.keys(DIFFICULTIES) as Difficulty[]
    )
      .map((k, i) => {
        const d = DIFFICULTIES[k];
        return `<button class="choice ${loadout.difficulty === k ? "selected" : ""}" data-action="difficulty" data-key="${k}"><span class="choice-number">0${i + 1}</span><div class="sigil">${["✧", "♜", "♛"][i]}</div><h3>${d.name}</h3><p>${["见证史诗，熟悉攻城与技能", "合理配兵，多路突破帝国防线", "高压城防，考验每一次决策"][i]}</p><div class="choice-detail"><span>初始魔晶 <b>${d.money}</b></span><span>净化倒计时 <b>${d.seconds / 60} 分钟</b></span></div></button>`;
      })
      .join("")}</div>`;
  if (wizard === 1)
    content = `<div class="choice-grid specs">${(
      Object.keys(SPECS) as Specialization[]
    )
      .map((k, i) => {
        const s = SPECS[k];
        return `<button class="choice ${loadout.spec === k ? "selected" : ""}" data-action="spec" data-key="${k}"><div class="spec-art spec-${i}">${icon((["split", "golem", "wyvern"] as Army[])[i])}</div><span class="eyebrow">${["THE SUMMONER", "THE ASCENDANT", "THE STARFALL"][i]}</span><h3>${s.name}</h3><em>${s.title}</em><p>${s.description}</p><div class="skill-badge">F / ${s.skill}</div></button>`;
      })
      .join("")}</div>`;
  if (wizard === 2)
    content = `<div class="commander-grid">${COMMANDER_KEYS.map((k) => {
      const c = COMMANDERS[k],
        selected = loadout.commanders.includes(k);
      return `<button class="commander-card ${selected ? "selected" : ""}" data-action="commander" data-key="${k}" style="--accent:${c.color}">${portrait(k)}<div class="commander-info"><div class="commander-rank">${selected ? "0" + (loadout.commanders.indexOf(k) + 1) + " / 已招募" : "＋ 招募统帅"}<b>◈ ${c.price}</b></div><h3>${c.name}</h3><em>${c.title}</em><p>${c.skill} · ${ARMIES[c.army].name}</p></div></button>`;
    }).join(
      "",
    )}</div><p class="hint-line">每位统帅带来一位可部署英雄、一种专属兵和一个手动技能。最多四位；费用计入总预算。</p>`;
  if (wizard === 3)
    content = `<div class="army-layout"><section class="army-list"><div class="preset-row"><span>推荐军团</span><button data-action="preset" data-key="breach">群山破城</button><button data-action="preset" data-key="sky">苍穹突袭</button><button data-action="preset" data-key="swarm">千凝洪流</button></div>${ARMY_KEYS.map(
      (k) => {
        const d = ARMIES[k],
          open = unlocked(loadout, k);
        return `<div class="army-row ${open ? "" : "locked"}">${icon(k)}<div class="army-name"><h4>${d.name}${!open ? "<small>未解锁</small>" : ""}</h4><p>${d.description}</p></div><div class="army-price"><b>◈ ${batchPrice(loadout, k)}</b><span>每批 ${d.batch} 只</span></div><div class="inventory-count"><b>${loadout.inventory[k]}</b><span>库存</span></div><div class="purchase-buttons"><button data-action="buy-pre" data-key="${k}" data-count="1" ${open ? "" : "disabled"}>＋1批</button><button data-action="buy-pre" data-key="${k}" data-count="3" ${open ? "" : "disabled"}>＋3批</button><button data-action="buy-pre" data-key="${k}" data-count="Infinity" ${open ? "" : "disabled"}>尽可能多</button><button class="refund" data-action="refund" data-key="${k}" title="退还1批" ${loadout.inventory[k] ? "" : "disabled"}>−</button></div></div>`;
      },
    ).join(
      "",
    )}</section><aside class="briefing"><div class="eyebrow">IMPERIAL INTELLIGENCE</div><h3>圣曜城 · 防御情报</h3><div class="tactical-map"><div class="intel-crystal">✧<span>中央日轮圣晶</span></div><div class="intel-inner"></div><span class="intel-west">重炮 / 西境据点</span><span class="intel-east">防空 / 东境据点</span><div class="intel-wall"></div><span class="intel-gate">正门 · 重装守军</span><div class="intel-arrows">↑　　↑　　↑</div></div><p>正门最短，炮火最密。巨人破开薄弱侧墙，夺下前线据点；地面部队先拆防空，再让飞龙进入内城。</p><div class="loadout-summary"><span>${DIFFICULTIES[loadout.difficulty].name} / ${SPECS[loadout.spec].name}</span><b>${loadout.commanders.map((c) => COMMANDERS[c].name).join(" · ") || "请先选择统帅"}</b><span>军团 ${ARMY_KEYS.reduce((s, k) => s + loadout.inventory[k], 0)} 只 + ${loadout.commanders.length + 1} 名英雄</span></div></aside></div>`;
  app.innerHTML = `<main class="preparation" style="--cover:url('${artUrl("cover")}')"><header class="prep-header"><button class="back" data-action="prev">← 返回</button><div class="small-brand">异界围城 <span>魔物之王</span></div><div class="wallet">◈ <b>${money(loadout.money)}</b><span>可用魔晶</span></div></header><nav class="steps">${steps}</nav><section class="prep-heading"><div><span class="eyebrow">WAR COUNCIL / 0${wizard + 1}</span><h2>${["选择你的决战", "决定魔王的力量", "召集异界的王者", "铸成你的魔物联军"][wizard]}</h2><p>${["圣晶即将完成充能。选择挑战，然后为最后一战做好准备。", "你的专精会改变军团的价格、血脉或元素之力。", "不同的统帅，带来不同的破城方式。请挑选一至四位。", "购买进入库存；部署不再扣费。未花完的魔晶可在战中继续补兵。"][wizard]}</p></div>${wizard === 2 ? `<div class="selection-count">${loadout.commanders.length}<span>/ 4 位统帅</span></div>` : ""}</section><div class="prep-content">${content}</div><footer class="prep-footer"><span>${wizard === 3 ? "战中可自由购兵 · 可保留预备队 · 仅摧毁中央圣晶即可获胜" : "单场决战 · 无需经营 · 所有英雄均可手动指挥"}</span><button class="primary" data-action="${wizard === 3 ? "launch" : "next"}">${wizard === 3 ? "向圣曜城进军" : "继续"} <span>→</span></button></footer><div id="notice" role="status"></div></main>`;
  bindActions();
}
function aimDeploy(kind: Kind) {
  if (!renderer || !battle) return;
  if (
    isArmy(kind)
      ? battle.loadout.inventory[kind] <= 0
      : !battle.heroInventory.has(kind)
  ) {
    notice("没有库存：请先购买，已出场英雄不可重复部署");
    return;
  }
  renderer.mode = { type: "deploy", kind };
  notice("点击地图绿色区域部署 · Esc取消");
  updateHud();
}
function aimSkill(kind: Kind) {
  if (!renderer || !battle) return;
  const info = battle.skillInfo(kind);
  if (!info.available) {
    notice(
      !info.unit
        ? "请先部署该英雄"
        : info.exhausted
          ? "本场次数已用尽"
          : battle.paused
            ? "请先恢复战斗"
            : `冷却剩余 ${Math.ceil(info.cooldown)} 秒`,
    );
    return;
  }
  renderer.mode = { type: "skill", kind };
  notice("选择范围或方向后左键施放 · Esc取消");
  updateHud();
}
function startBattle(l: Loadout) {
  clearBattle();
  initial = structuredClone(l);
  loadout = structuredClone(l);
  battle = new Battle(l);
  battle.paused = true;
  buyBatch = 1;
  deployBatch = 1;
  const heroCards = (["king", ...l.commanders] as Kind[])
    .map((k, i) => {
      const c = isCommander(k) ? COMMANDERS[k] : null;
      return `<div class="hero-slot" data-hero="${k}"><button class="hero-deploy" data-action="deploy" data-key="${k}" draggable="true" data-drag="${k}" title="拖放英雄到合法区域">${isCommander(k) ? portrait(k) : icon("king")}<span>${c?.name ?? "魔物之王"}</span><small class="hero-state">待部署</small></button><button class="skill-button" data-action="skill" data-key="${k}"><kbd>${i === 0 ? "F" : ["Q", "W", "E", "R"][i - 1]}</kbd><span>${c?.skill ?? SPECS[l.spec].skill}</span><small class="skill-cd">未部署</small></button></div>`;
    })
    .join("");
  const cards = ARMY_KEYS.filter((k) => unlocked(l, k))
    .map(
      (k) =>
        `<div class="troop-card" data-troop="${k}"><button class="troop-deploy" data-action="deploy" data-key="${k}" draggable="true" data-drag="${k}" title="点击或拖到地图部署">${icon(k)}<span class="troop-name">${ARMIES[k].name}</span><b class="troop-stock">${l.inventory[k]}</b><small>${ARMIES[k].batch}只 / 批</small></button><button class="buy-button" data-action="buy" data-key="${k}">＋ ◈${batchPrice(l, k)}</button></div>`,
    )
    .join("");
  app.innerHTML = `<main class="battle-shell"><header class="battle-top"><button class="battle-brand" data-action="help">异界围城<span>THE LAST SIEGE</span></button><div class="objective"><div><span>摧毁中央日轮圣晶</span><b id="crystal-hp">100%</b></div><div class="objective-track"><i id="crystal-fill"></i></div></div><div class="clock-panel"><div class="clock-caption">距离净化降临 <span>${DIFFICULTIES[l.difficulty].name}</span></div><b id="clock">10:00</b><div class="charge-track"><i id="charge-fill"></i></div></div><div class="top-controls"><button data-action="sound">${sound.muted ? "音效 关" : "音效 开"}</button><button data-action="speed" id="speed">1×</button><button data-action="pause" id="pause">暂停 Ⅱ</button><button data-action="menu">主菜单</button></div></header><div class="battle-view" id="battle-view"><div class="battle-location"><span class="eyebrow">IMPERIAL CAPITAL</span><b>圣 曜 城</b><small>白金帝国 · 最后防线</small></div><aside class="map-panel"><canvas id="minimap" aria-label="点击小地图移动镜头"></canvas><div class="map-actions"><button data-action="overview">全景</button><button data-action="front">前线</button><button data-action="crystal">圣晶</button></div></aside><div class="battle-hint" id="mode-hint">拖放军团卡到城外召唤阵 · 框选军队 / 右键移动或集火</div><div id="notice" role="status"></div><div class="pause-indicator" id="pause-indicator">战斗暂停 <small>空格继续 · 暂停时可购买预备军</small></div></div><section class="battle-dock"><div class="resource-row"><div class="crystal-wallet">◈ <b id="battle-money">${money(battle.money)}</b><span>魔晶</span><small id="income">战利品 +0</small></div><div class="force-counter"><span>在场 <b id="active-count">0</b><small>/ 300</small></span><span>预备 <b id="reserve-count">0</b></span><span>选中 <b id="selected-count">0</b></span></div><div class="batch-control"><label>购买 <select id="buy-batch"><option value="1">1批</option><option value="3">3批</option><option value="Infinity">尽可能多</option></select></label><label>部署 <select id="deploy-batch"><option value="1">1批</option><option value="3">3批</option><option value="Infinity">全部库存</option></select></label></div><button class="small-gold" data-action="all-deploy">全部部署 ↗</button><button class="small-gold" data-action="charge">全军冲锋 ↑</button></div><div class="dock-main"><div class="troops-scroll">${cards}</div><div class="heroes-scroll">${heroCards}</div></div><div class="dock-footer"><span id="battle-message">据点需地面连通、无敌军争夺并占领8秒</span><div><button data-action="select-all">全选军队 A</button><button data-action="help">操作手册 ?</button><span id="fps"></span></div></div></section></main><div class="cinematic" id="intro-overlay"><div class="cinematic-copy"><span class="eyebrow">THE LAST SIEGE / 最后的总攻</span><h2>圣曜城的黎明</h2><p>日轮圣晶即将净化这片大地。<br>让群山开路，让风暴撕开天幕。<br>今日，异界的命运由你决定。</p><div class="march-portraits">${l.commanders.map((c) => `<div>${portrait(c)}<span>${COMMANDERS[c].name}</span></div>`).join("")}</div><button class="primary" data-action="skip-intro">开始总攻 / 跳过演出 →</button></div></div>`;
  renderer = new Renderer(battle, $("#battle-view"), $("#minimap"));
  bindActions();
  bindBattleInput();
  renderer.onFrame = updateHud;
  renderer.onEvent = (e) => {
    if (
      [
        "skill",
        "wall",
        "deploy",
        "capture",
        "victory",
        "defeat",
        "destroy",
      ].includes(e.type)
    )
      sound.play(e.type);
    else if (e.type === "shot" && e.kind === "cannon") sound.play("cannon");
    if (e.type === "capture" || e.type === "reinforce") notice(e.text ?? "");
    if (e.type === "victory" || e.type === "defeat")
      resultTimer = window.setTimeout(showResult, 1600);
  };
  renderer.start();
  updateHud();
  Object.assign(window, {
    __SIEGE__: {
      get battle() {
        return battle;
      },
      get renderer() {
        return renderer;
      },
      startBattle,
      menu,
      preset,
      worldToScreen: (x: number, y: number) => renderer?.worldToScreen(x, y),
    },
  });
}
function updateHud() {
  if (!battle || !renderer) return;
  const b = battle;
  $("#battle-money").textContent = money(b.money);
  $("#active-count").textContent = String(b.active);
  $("#reserve-count").textContent = String(b.reserves);
  $("#selected-count").textContent = String(b.selected.size);
  $("#income").textContent = `战利品 +${b.stats.income}`;
  const time = Math.ceil(b.remaining);
  $("#clock").textContent = `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
  $("#crystal-hp").textContent =
    `${Math.ceil((b.crystal.hp / b.crystal.maxHp) * 100)}%`;
  $("#crystal-fill").style.width = `${(b.crystal.hp / b.crystal.maxHp) * 100}%`;
  $("#charge-fill").style.width =
    `${(b.time / DIFFICULTIES[b.loadout.difficulty].seconds) * 100}%`;
  $("#clock").classList.toggle("urgent", b.remaining < 60);
  $("#pause").textContent = b.paused ? "继续 ▶" : "暂停 Ⅱ";
  $("#speed").textContent = `${b.speed}×`;
  $("#pause-indicator").classList.toggle(
    "visible",
    b.paused && !$("#intro-overlay"),
  );
  $("#fps").textContent = `${Math.round(renderer.fps)} FPS`;
  $("#mode-hint").textContent =
    renderer.mode.type === "none"
      ? "拖放军团卡到召唤阵 · 框选 / 右键移动集火 · 中键拖动 / 滚轮缩放"
      : renderer.mode.type === "deploy"
        ? "部署模式 · 绿色区域合法 · 左键确认 · Esc取消"
        : "施法模式 · 注意英雄距离 · 左键确认 · Esc取消";
  for (const k of ARMY_KEYS) {
    const el = $(`[data-troop="${k}"]`);
    if (!el) continue;
    el.querySelector(".troop-stock")!.textContent = String(
      b.loadout.inventory[k],
    );
    el.classList.toggle(
      "aiming",
      renderer.mode.type === "deploy" && renderer.mode.kind === k,
    );
    el.querySelector<HTMLButtonElement>(".buy-button")!.disabled =
      b.money < batchPrice(b.loadout, k);
  }
  for (const k of ["king", ...b.loadout.commanders] as Kind[]) {
    const el = $(`[data-hero="${k}"]`);
    const info = b.skillInfo(k),
      queued = b.queue.some((q) => q.kind === k);
    el.querySelector(".hero-state")!.textContent = info.unit
      ? "已出战"
      : b.heroInventory.has(k)
        ? "待部署"
        : queued
          ? "召唤中"
          : "已阵亡";
    el.querySelector(".skill-cd")!.textContent = info.unit
      ? info.exhausted
        ? "次数用尽"
        : info.cooldown > 0
          ? `${Math.ceil(info.cooldown)}s`
          : "就绪"
      : "—";
    el.querySelector(".skill-button")!.classList.toggle(
      "ready",
      info.available,
    );
    el.classList.toggle(
      "aiming",
      renderer.mode.type !== "none" && renderer.mode.kind === k,
    );
  }
}
function bindBattleInput() {
  abort = new AbortController();
  const signal = abort.signal,
    r = renderer!,
    b = battle!,
    c = r.canvas;
  let down: {
    x: number;
    y: number;
    wx: number;
    wy: number;
    button: number;
    cx: number;
    cy: number;
  } | null = null;
  const on = (target: EventTarget, event: string, fn: EventListener) =>
    target.addEventListener(event, fn, { signal });
  on(c, "contextmenu", (e) => e.preventDefault());
  c.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      r.zoomAt(e.deltaY, e.clientX, e.clientY);
    },
    { signal, passive: false },
  );
  on(c, "pointerdown", ((e: PointerEvent) => {
    if ($("#intro-overlay")) return;
    const p = r.screenToWorld(e.clientX, e.clientY);
    r.pointer = p;
    if (e.button === 2) {
      e.preventDefault();
      if (!b.selected.size) notice("先框选部队，或按A全选");
      else {
        const t = b.targetAt(p.x, p.y);
        b.command(
          b.selected,
          t
            ? { type: "attack", target: t.id }
            : { type: "move", x: p.x, y: p.y },
        );
        b.events.push({ type: "deploy", x: p.x, y: p.y, radius: 35 });
        notice(t ? "已下达集火命令" : "已下达移动命令");
      }
      return;
    }
    if (e.button === 0 && r.mode.type !== "none") {
      if (r.mode.type === "deploy") {
        const ok =
          r.mode.kind === "all"
            ? b.deployAll(p.x, p.y)
            : b.deploy(r.mode.kind, p.x, p.y, deployBatch);
        notice(ok ? "军团正在从召唤阵出征" : "非法部署位置或库存不足");
        if (ok) {
          sound.play("deploy");
          r.mode = { type: "none" };
        }
      } else {
        const error = b.cast(r.mode.kind, p.x, p.y);
        if (error) notice(error);
        else {
          sound.play("skill");
          r.mode = { type: "none" };
        }
      }
      updateHud();
      return;
    }
    down = {
      x: e.clientX,
      y: e.clientY,
      wx: p.x,
      wy: p.y,
      button: e.button,
      cx: r.camera.x,
      cy: r.camera.y,
    };
    c.setPointerCapture(e.pointerId);
  }) as EventListener);
  on(c, "pointermove", ((e: PointerEvent) => {
    r.pointer = r.screenToWorld(e.clientX, e.clientY);
    if (!down) return;
    if (down.button === 1) {
      r.camera.x = down.cx - (e.clientX - down.x) / r.camera.zoom;
      r.camera.y = down.cy - (e.clientY - down.y) / r.camera.zoom;
    } else if (down.button === 0 && r.mode.type === "none")
      r.selection = {
        x: down.wx,
        y: down.wy,
        tx: r.pointer.x,
        ty: r.pointer.y,
      };
  }) as EventListener);
  on(c, "pointerup", ((e: PointerEvent) => {
    if (down?.button === 0) {
      const p = r.screenToWorld(e.clientX, e.clientY);
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5)
        b.select(p.x - 30, p.y - 30, p.x + 30, p.y + 30, e.shiftKey);
      else b.select(down.wx, down.wy, p.x, p.y, e.shiftKey);
      r.selection = null;
      updateHud();
    }
    down = null;
  }) as EventListener);
  on(document, "keydown", ((e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).matches("select,input,textarea") ||
      $("#help-modal")
    )
      return;
    if (e.code === "Escape") {
      r.mode = { type: "none" };
      r.selection = null;
      down = null;
      updateHud();
      return;
    }
    if ($("#intro-overlay")) {
      if (e.code === "Space" || e.code === "Enter")
        $('[data-action="skip-intro"]').click();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      b.paused = !b.paused;
      updateHud();
    }
    if (e.key.toLowerCase() === "a") {
      b.selected = new Set(
        b.units.filter((u) => u.hp > 0 && u.side === 0).map((u) => u.id),
      );
      updateHud();
    }
    if (e.key.toLowerCase() === "f") aimSkill("king");
    const i = ["q", "w", "e", "r"].indexOf(e.key.toLowerCase());
    if (i >= 0 && b.loadout.commanders[i]) aimSkill(b.loadout.commanders[i]);
    if (["1", "2", "3"].includes(e.key)) {
      const gi = Number(e.key) - 1;
      if (e.ctrlKey) {
        e.preventDefault();
        b.groups[gi] = new Set(b.selected);
        notice(`编队${e.key}已保存`);
      } else {
        b.selected = new Set(
          [...b.groups[gi]].filter((id) => (b.byId.get(id)?.hp ?? 0) > 0),
        );
        updateHud();
      }
    }
    if (e.key === "Home") r.overview();
    if (e.key === "ArrowUp") r.camera.y -= 100;
    if (e.key === "ArrowDown") r.camera.y += 100;
    if (e.key === "ArrowLeft") r.camera.x -= 100;
    if (e.key === "ArrowRight") r.camera.x += 100;
  }) as EventListener);
  for (const el of document.querySelectorAll<HTMLElement>("[data-drag]")) {
    on(el, "dragstart", ((e: DragEvent) => {
      const k = el.dataset.drag as Kind;
      e.dataTransfer!.setData("text/plain", k);
      e.dataTransfer!.effectAllowed = "copy";
      r.mode = { type: "deploy", kind: k };
      updateHud();
    }) as EventListener);
    on(el, "dragend", (() => {
      r.mode = { type: "none" };
      updateHud();
    }) as EventListener);
  }
  on(c, "dragover", ((e: DragEvent) => {
    e.preventDefault();
    r.pointer = r.screenToWorld(e.clientX, e.clientY);
    e.dataTransfer!.dropEffect = b.canDeploy(r.pointer.x, r.pointer.y)
      ? "copy"
      : "none";
  }) as EventListener);
  on(c, "drop", ((e: DragEvent) => {
    e.preventDefault();
    const k = e.dataTransfer!.getData("text/plain") as Kind;
    const p = r.screenToWorld(e.clientX, e.clientY);
    const ok = b.deploy(k, p.x, p.y, deployBatch);
    notice(ok ? "部署成功 · 军团正在出征" : "非法部署或库存不足 · 未扣除库存");
    r.mode = { type: "none" };
    updateHud();
  }) as EventListener);
  on($("#minimap"), "pointerdown", ((e: PointerEvent) => {
    const rect = $("#minimap").getBoundingClientRect();
    r.camera.x = ((e.clientX - rect.left) / rect.width) * 3200;
    r.camera.y = ((e.clientY - rect.top) / rect.height) * 2400;
  }) as EventListener);
  on($("#buy-batch"), "change", (() => {
    buyBatch = Number($<HTMLSelectElement>("#buy-batch").value);
  }) as EventListener);
  on($("#deploy-batch"), "change", (() => {
    deployBatch = Number($<HTMLSelectElement>("#deploy-batch").value);
  }) as EventListener);
}
function showResult() {
  if (!battle) return;
  const won = battle.status === "victory",
    s = battle.stats;
  const el = document.createElement("div");
  el.className = `result-overlay ${won ? "won" : "lost"}`;
  el.innerHTML = `<section class="result-card"><span class="eyebrow">${won ? "A NEW AGE BEGINS" : "THE LIGHT HAS FALLEN"}</span><div class="result-sigil">${won ? "✧" : "♜"}</div><h2>${won ? "异界的新王" : "最后的光，吞没了军团"}</h2><p>${battle.reason}</p><div class="result-stats"><div><b>${Math.floor(battle.time)}s</b><span>战斗用时</span></div><div><b>${s.deployed}</b><span>累计出征</span></div><div><b>${s.kills}</b><span>击败守军</span></div><div><b>${s.walls}</b><span>破坏墙段</span></div><div><b>${s.income}</b><span>战利魔晶</span></div></div><div class="result-actions"><button class="primary" data-action="retry">原阵容再战 →</button><button data-action="reconfigure">重新配兵</button><button data-action="menu">返回主菜单</button></div><small>圣晶是唯一胜利目标 · 所有战报数据来自本场真实战斗</small></section>`;
  app.append(el);
  sound.play(won ? "victory" : "defeat");
}
function showHelp() {
  if ($("#help-modal")) return;
  const div = document.createElement("div");
  div.id = "help-modal";
  div.className = "modal";
  div.innerHTML = `<section class="manual"><button class="close" data-action="close-help">×</button><span class="eyebrow">FIELD MANUAL</span><h2>让每一支军团，抵达该去的战场。</h2><div class="manual-grid"><div><h3>01 / 部署与经济</h3><p>购买只扣一次魔晶，兵力进入库存。拖动兵种或英雄卡到城外三个召唤区，也可点卡后点地图。选择1批、3批或全部库存；大军依次入场，300只上限外的兵力继续排队。</p><h3>02 / 指挥</h3><p>左键框选，右键移动或集火。A全选，Ctrl+1/2/3存编队，1/2/3选编队。全军冲锋恢复自动推进，同时保留你的集火目标。中键拖镜头，滚轮缩放，小地图定位。</p></div><div><h3>03 / 英雄与技能</h3><p>魔王F，统帅按招募顺序Q/W/E/R。先把英雄拖到合法区域，再按技能键，瞄准后左键确认。技能有距离和冷却；Esc取消。巨王必须指定墙段，龙息是扇形。</p><h3>04 / 胜利之路</h3><p>摧毁中央日轮圣晶即可胜利。巨人破侧墙，狼骑猎杀射手，地面拆防空后飞龙进军。两个据点需打通地面、清除守军、站稳8秒，随后+200魔晶并可就地部署援军。</p></div></div><p class="manual-footer">空格暂停，暂停时计时和技能冷却停止；2×同时加快战斗和倒计时。击杀、拆塔和占领奖励只有一次；军营最多出动三波预备队。魔王阵亡仍可战斗；时间耗尽或彻底力竭则失败。</p><button class="primary" data-action="close-help">明白了，准备出征 →</button></section>`;
  app.append(div);
}
async function boot() {
  app.innerHTML =
    '<div class="loading"><span class="brand-mark">M / S</span><h2>异界围城 · 魔物之王</h2><p>正在集结异界联军…</p></div>';
  await loadArt();
  menu();
  Object.assign(window, {
    __SIEGE__: {
      startBattle,
      preset,
      menu,
      get battle() {
        return battle;
      },
      get renderer() {
        return renderer;
      },
    },
  });
}
window.addEventListener("error", (e) => {
  console.error("Game error", e.error);
  if (!$("#fatal-error")) {
    const p = document.createElement("div");
    p.id = "fatal-error";
    p.innerHTML =
      '<p>战场出现异常，请重新进入战役。</p><button onclick="location.reload()">重新加载</button>';
    app.append(p);
  }
});
void boot();
