import {
  ARMIES,
  ARMY_KEYS,
  COMMANDERS,
  COMMANDER_KEYS,
  DIFFICULTIES,
  SPECS,
  SPELLS,
  SPELL_KEYS,
  WORLD,
  type Spell,
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
import { DeploymentStream } from "./deployment";
import { PRIORITIES, routePoints, type Priority } from "./orders";
import { FRONTS, FRONT_KEYS, type Front } from "./world";
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
let deployBatch = 3;
let armyMode: "stock" | "field" = "stock";
let selectedMarkup = "";
let noticeTimer = 0;
let resultTimer = 0;
let introTimer = 0;
let helpWasPaused: boolean | null = null;
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const money = (n: number) => Math.floor(n).toLocaleString("zh-CN");
const icon = (key: Kind) => {
  const i = isArmy(key) ? ARMIES[key].sprite : 15;
  if (i >= 16)
    return `<span class="unit-icon new-unit-icon" style="--col:0;--row:${i - 16}"></span>`;
  return `<span class="unit-icon" style="--col:${i % 4};--row:${Math.floor(i / 4)}"></span>`;
};
const portrait = (c: Commander) =>
  `<div class="portrait" style="--col:${COMMANDERS[c].portrait % 3};--row:${Math.floor(COMMANDERS[c].portrait / 3)}"></div>`;
const skillIcon = (kind: Kind, spec: Specialization) => {
  const paths: Record<string, string> = {
    dragon: "M2 10 8 3 7 9 12 6 10 13 17 8 13 17 8 14 4 17 5 12Z",
    titan: "M3 2 12 2 16 6 12 10 9 7 4 16 2 15 7 6 3 6Z",
    moon: "M12 2A8 8 0 1 0 17 14 8 8 0 0 1 12 2Z",
    web: "M9 1V17M1 9H17M3 3 15 15M3 15 15 3M9 4 14 6 14 12 9 15 4 12 4 6Z",
    forest: "M16 2C4 1 1 9 5 14 13 18 18 10 16 2ZM3 17 13 5M8 12 8 7M8 12 13 12",
    emperor: "M9 2C7 6 2 10 3 13 5 19 15 18 16 13 17 9 12 6 9 2ZM5 7 4 3 8 5 9 2 11 5 15 3 14 7",
    summon: "M3 16V6L9 2 15 6V16M6 16V8L9 6 12 8V16M1 17H17",
    evolve: "M9 1 16 9 9 17 2 9ZM9 5 12 9 9 13 6 9Z",
    element: "M9 1 11 6 17 8 12 11 11 17 8 12 2 13 5 8 3 3 8 5Z",
  };
  return `<svg class="skill-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="${paths[kind] ?? paths[spec]}"/></svg>`;
};
const spellIcon = (k: Spell) => {
  const paths = {
    rage: "M9 1C8 7 3 6 4 12S14 19 15 11L12 6 11 12 8 10Z",
    heal: "M6 2H12V6H16V12H12V16H6V12H2V6H6Z",
    barrier: "M9 1 16 4 15 12 9 17 3 12 2 4ZM9 4V13",
    meteor: "M17 1 12 11 6 16 2 12 7 6ZM5 7 10 12M3 3 6 4M12 16 15 15",
  };
  return `<svg class="spell-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="${paths[k]}"/></svg><i>${SPELLS[k].key}</i>`;
};
function notice(s: string) {
  const n = $("#notice");
  if (!n) return;
  n.textContent = s;
  n.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => n.classList.remove("show"), 2800);
}
function clearBattle() {
  clearTimeout(introTimer);
  abort?.abort();
  abort = null;
  renderer?.destroy();
  renderer = null;
  battle = null;
  clearTimeout(resultTimer);
}
const footer =
  '<div class="edition"><span>原创世界 · 单场实时攻城</span><span>MONSTER SOVEREIGN / V3.1</span></div>';
function menu() {
  clearBattle();
  app.innerHTML = `<main class="menu" style="--cover:url('${artUrl("cover")}')"><div class="menu-shade"></div><div class="brand-mark">M / S</div><div class="menu-content"><div class="eyebrow"><span class="gold-line"></span> THE LAST SIEGE</div><p class="over-title">异 界 围 城</p><h1>魔物之王</h1><p class="latin-title">MONSTER SOVEREIGN</p><div class="title-rule"></div><p class="menu-story">圣曜城的钟声，即将宣告世界的终结。<br>掠夺外城物资，集结援军，向帝国圣晶发起决战。</p><button class="primary menu-start" data-action="new">开启最后总攻 <span>↗</span></button><button class="text-button" data-action="help">战场手册 <span>FIELD MANUAL</span></button></div><div class="menu-quote"><span>01 / 圣曜城</span><p>当群山苏醒，天空将不再属于帝国。</p></div>${footer}<div id="notice" role="status"></div></main>`;
  bindActions();
}
function bindActions() {
  for (const c of COMMANDER_KEYS)
    for (const el of document.querySelectorAll<HTMLElement>(`[data-key="${c}"]`))
      if (el.dataset.action === "commander" || el.dataset.action === "skill")
        el.title = `${COMMANDERS[c].description}\n冷却 ${COMMANDERS[c].cooldown}s · 施法距离 ${COMMANDERS[c].castRange}`;
  for (const k of ARMY_KEYS) {
    const d = ARMIES[k],
      tip = `${d.name} · ${d.description}\n基础生命 ${d.hp} · 基础伤害 ${d.damage}/s · 速度 ${d.speed} · 射程 ${d.range}`;
    for (const el of document.querySelectorAll<HTMLElement>(`[data-key="${k}"]`)) {
      if (el.classList.contains("troop-deploy")) el.title = tip;
      const row = el.closest<HTMLElement>(".army-row");
      if (row) row.title = tip;
    }
  }
  const kingSkill = $<HTMLElement>('[data-action="skill"][data-key="king"]');
  if (kingSkill) kingSkill.title = SPECS[loadout.spec].description;
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
    else if (a === "close-help") {
      $("#help-modal").remove();
      if (battle && helpWasPaused !== null) {
        battle.paused = helpWasPaused;
        helpWasPaused = null;
        updateHud();
      }
    } else if (a === "menu") menu();
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
        loadout = createLoadout(loadout.difficulty, b.dataset.key as Specialization);
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
      const n = purchase(loadout, b.dataset.key as Army, Number(b.dataset.count));
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
      clearTimeout(introTimer);
      battle!.paused = false;
      $("#intro-overlay")?.remove();
      renderer?.overview(false);
      updateHud();
    } else if (a === "pause") {
      battle!.paused = !battle!.paused;
      updateHud();
    } else if (a === "speed") {
      battle!.speed = battle!.speed === 1 ? 2 : 1;
      updateHud();
    } else if (a === "overview") renderer?.overview();
    else if (a === "front") {
      if (renderer) renderer.focus(renderer.rally?.x ?? 2000, renderer.rally?.y ?? 2940, 0.65);
    } else if (a === "guardian") {
      const u = battle?.units.find((u) => u.side === 1 && u.kind === "captain" && u.hp > 0);
      if (u) renderer?.focus(u.x, u.y, 0.85);
    } else if (a === "crystal") {
      if (renderer) renderer.focus(2000, 1840, 0.72);
    } else if (a === "charge") {
      battle?.charge();
      notice("明确命令：全军自动进攻 · 新下兵仍原地待命");
    } else if (a === "select-all") {
      setArmyMode("field");
      battle!.selected = new Set(
        battle!.units.filter((u) => u.side === 0 && u.hp > 0).map((u) => u.id),
      );
      updateHud();
    } else if (a === "sound") {
      sound.toggle();
      b.textContent = sound.muted ? "音效 关" : "音效 开";
    } else if (a === "buy") {
      if (!battle!.buy(b.dataset.key as Army, buyBatch)) notice("魔晶不足或兵种未解锁");
      updateHud();
    } else if (a === "army-mode") setArmyMode(b.dataset.key as "stock" | "field");
    else if (a === "select-kind") selectType(b.dataset.key as Kind, (ev as MouseEvent).shiftKey);
    else if (a === "halt") {
      battle?.halt(battle.selected);
      notice("所选部队原地待命 · 仅攻击射程内目标");
      updateHud();
    } else if (a === "deploy") {
      if (
        armyMode === "field" ||
        (!isArmy(b.dataset.key as Kind) && battle?.getUnit(b.dataset.key as Kind))
      ) {
        selectType(b.dataset.key as Kind, (ev as MouseEvent).shiftKey);
        return;
      }
      if ((ev as MouseEvent).shiftKey && renderer?.rally) {
        const p = renderer.rally;
        battle!.deploy(b.dataset.key as Kind, p.x, p.y, Infinity);
        updateHud();
      } else aimDeploy(b.dataset.key as Kind);
    } else if (a === "skill") aimSkill(b.dataset.key as Kind);
    else if (a === "spell") aimSpell(b.dataset.key as Spell);
    else if (a === "rally") {
      renderer!.mode = { type: "rally" };
      notice("点击四面集结区或已占领前线，设置快速出兵点");
    } else if (a === "quick-deploy") {
      const p = renderer!.rally!;
      const ok = battle!.deploy(
        b.dataset.key as Kind,
        p.x,
        p.y,
        (ev as MouseEvent).shiftKey ? Infinity : deployBatch,
      );
      renderer!.mode = { type: "none" };
      notice(ok ? "军团已从集结点出征" : "库存不足或集结点被敌军争夺，请重新设置");
      updateHud();
    } else if (a === "rally-all") {
      const p = renderer!.rally!;
      const ok = battle!.deployAll(p.x, p.y);
      notice(ok ? "全军已加入集结点召唤队列" : "无待部署库存，或集结点被争夺/失效");
      updateHud();
    } else if (a === "direction") {
      const p = FRONTS[b.dataset.key as Front];
      renderer!.focus(p.gateX, p.gateY, 0.6);
      renderer!.rally = { x: p.x, y: p.y };
      renderer!.mode = { type: "none" };
      notice(p.name + " · " + p.description);
      updateHud();
    } else if (a === "all-deploy") {
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
    content = `<div class="choice-grid difficulty">${(Object.keys(DIFFICULTIES) as Difficulty[])
      .map((k, i) => {
        const d = DIFFICULTIES[k];
        return `<button class="choice ${loadout.difficulty === k ? "selected" : ""}" data-action="difficulty" data-key="${k}"><span class="choice-number">0${i + 1}</span><div class="sigil">${["✧", "♜", "♛"][i]}</div><h3>${d.name}</h3><p>${["见证史诗，熟悉攻城与技能", "合理配兵，多路突破帝国防线", "高压城防，考验每一次决策"][i]}</p><div class="choice-detail"><span>初始魔晶 <b>${d.money}</b></span><span>净化倒计时 <b>${d.seconds / 60} 分钟</b></span></div></button>`;
      })
      .join("")}</div>`;
  if (wizard === 1)
    content = `<div class="choice-grid specs">${(Object.keys(SPECS) as Specialization[])
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
    )}</section><aside class="briefing"><div class="eyebrow">IMPERIAL INTELLIGENCE</div><h3>圣曜城 · 防御情报</h3><div class="tactical-map"><div class="intel-crystal">✧<span>中央日轮圣晶</span></div><div class="intel-inner"></div><span class="intel-west">西境薄墙 / 资源矿场</span><span class="intel-east">东境防空 / 弓手</span><div class="intel-wall"></div><span class="intel-gate">四面城门 · 三重防线</span><div class="intel-arrows">↑　　↑　　↑</div></div><p>东南西北均可出兵。西线薄墙利于破壁，东线防空密集，北线资源与法师并存，南线重炮守主门。先派掠夺者沿城外分路夺取物资，再用收入购买攻城援军。拆掉外城火力、占领前线，然后推进内城。中央日轮守护骑士拥有护盾和范围震荡；单路全军硬冲风险极高。</p><div class="loadout-summary"><span>${DIFFICULTIES[loadout.difficulty].name} / ${SPECS[loadout.spec].name}</span><b>${loadout.commanders.map((c) => COMMANDERS[c].name).join(" · ") || "请先选择统帅"}</b><span>军团 ${ARMY_KEYS.reduce((s, k) => s + loadout.inventory[k], 0)} 只 + ${loadout.commanders.length + 1} 名英雄</span></div></aside></div>`;
  app.innerHTML = `<main class="preparation" style="--cover:url('${artUrl("cover")}')"><header class="prep-header"><button class="back" data-action="prev">← 返回</button><div class="small-brand">异界围城 <span>魔物之王</span></div><div class="wallet">◈ <b>${money(loadout.money)}</b><span>可用魔晶</span></div></header><nav class="steps">${steps}</nav><section class="prep-heading"><div><span class="eyebrow">WAR COUNCIL / 0${wizard + 1}</span><h2>${["选择你的决战", "决定魔王的力量", "召集异界的王者", "铸成你的魔物联军"][wizard]}</h2><p>${["圣晶即将完成充能。选择挑战，然后为最后一战做好准备。", "你的专精会改变军团的价格、血脉或元素之力。", "不同的统帅，带来不同的破城方式。请挑选一至四位。", "购买进入库存；部署不再扣费。未花完的魔晶可在战中继续补兵。"][wizard]}</p></div>${wizard === 2 ? `<div class="selection-count">${loadout.commanders.length}<span>/ 4 位统帅</span></div>` : ""}</section><div class="prep-content">${content}</div><footer class="prep-footer"><span>${wizard === 3 ? "战中可自由购兵 · 可保留预备队 · 仅摧毁中央圣晶即可获胜" : "单场决战 · 无需经营 · 所有英雄均可手动指挥"}</span><button class="primary" data-action="${wizard === 3 ? "launch" : "next"}">${wizard === 3 ? "向圣曜城进军" : "继续"} <span>→</span></button></footer><div id="notice" role="status"></div></main>`;
  bindActions();
}
function setArmyMode(mode: "stock" | "field") {
  armyMode = mode;
  if (renderer) {
    renderer.mode = { type: "none" };
    renderer.routeDraft = null;
  }
  updateHud();
}
function selectType(kind: Kind, append = false) {
  if (!battle) return;
  if (!battle.units.some((u) => u.side === 0 && u.hp > 0 && u.kind === kind)) {
    notice("此兵种尚未出战 · 切换库存部署即可下兵");
    return;
  }
  setArmyMode("field");
  battle.selectKind(kind, append);
  updateHud();
}
function aimDeploy(kind: Kind) {
  armyMode = "stock";
  if (!renderer || !battle) return;
  if (isArmy(kind) ? battle.loadout.inventory[kind] <= 0 : !battle.heroInventory.has(kind)) {
    notice("没有库存：请先购买，已出场英雄不可重复部署");
    return;
  }
  renderer.mode = { type: "deploy", kind };
  notice("点地图批量出兵，长按连续投放；模式保持，可反复点放 · Esc取消");
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
function aimSpell(spell: Spell) {
  if (!battle || !renderer) return;
  const info = battle.spellInfo(spell),
    d = SPELLS[spell];
  if (!info.available) {
    notice(
      battle.paused
        ? "请先恢复战斗"
        : battle.mana < d.cost
          ? `魔力不足 · 需要${d.cost}`
          : `冷却剩余 ${Math.ceil(info.cooldown)} 秒`,
    );
    return;
  }
  renderer.mode = { type: "spell", kind: spell };
  notice(d.name + " · " + d.description);
  updateHud();
}
function startBattle(l: Loadout) {
  clearBattle();
  initial = structuredClone(l);
  loadout = structuredClone(l);
  battle = new Battle(l);
  battle.paused = true;
  buyBatch = 1;
  deployBatch = 3;
  armyMode = "stock";
  selectedMarkup = "";
  const heroCards = (["king", ...l.commanders] as Kind[])
    .map((k, i) => {
      const c = isCommander(k) ? COMMANDERS[k] : null;
      return `<div class="hero-slot" data-hero="${k}"><button class="hero-deploy" data-action="deploy" data-key="${k}" draggable="true" data-drag="${k}" title="拖放英雄到合法区域">${isCommander(k) ? portrait(k) : icon("king")}<span>${c?.name ?? "魔物之王"}</span><small class="hero-state">待部署</small></button><button class="skill-button" data-action="skill" data-key="${k}"><kbd>${skillIcon(k, l.spec)}<i>${i === 0 ? "F" : ["Q", "W", "E", "R"][i - 1]}</i></kbd><span>${c?.skill ?? SPECS[l.spec].skill}</span><small class="skill-cd">未部署</small></button></div>`;
    })
    .join("");
  const cards = ARMY_KEYS.filter((k) => unlocked(l, k))
    .map(
      (k) =>
        `<div class="troop-card" data-troop="${k}"><button class="troop-deploy" data-action="deploy" data-key="${k}" draggable="true" data-drag="${k}" title="点击或拖到地图部署">${icon(k)}<span class="troop-name">${ARMIES[k].name}</span><b class="troop-stock">${l.inventory[k]}</b><small class="troop-info">${ARMIES[k].batch}只 / 批</small></button><button class="quick-deploy" data-action="quick-deploy" data-key="${k}" title="一键投往集结点；Shift投全部库存">快速出兵 ↗</button><button class="buy-button" data-action="buy" data-key="${k}">＋ ◈${batchPrice(l, k)}<small class="affordable">可购${Math.floor(l.money / batchPrice(l, k))}批</small></button></div>`,
    )
    .join("");
  app.innerHTML = `<main class="battle-shell"><header class="battle-top"><button class="battle-brand" data-action="help">异界围城<span>THE LAST SIEGE</span></button><div class="objective"><div><span>摧毁中央日轮圣晶</span><b id="crystal-hp">100%</b></div><div class="objective-track"><i id="crystal-fill"></i></div><button class="guardian-status" id="guardian-status" data-action="guardian" title="日轮守护骑士：圣辉震荡与阶段护盾，驻守中央核心">日轮守护骑士</button></div><div class="clock-panel"><div class="clock-caption">距离净化降临 <span>${DIFFICULTIES[l.difficulty].name}</span></div><b id="clock">10:00</b><div class="charge-track"><i id="charge-fill"></i></div></div><div class="top-controls"><button data-action="sound">${sound.muted ? "音效 关" : "音效 开"}</button><button data-action="speed" id="speed">1×</button><button data-action="pause" id="pause">暂停 Ⅱ</button><button data-action="menu">主菜单</button></div></header><div class="battle-view" id="battle-view"><div class="battle-location"><span class="eyebrow">IMPERIAL CAPITAL</span><b>圣 曜 城</b><small id="campaign-phase">外城掠夺资源 → 内城进攻决战</small></div><aside class="map-panel"><canvas id="minimap" aria-label="点击小地图移动镜头"></canvas><div class="map-actions"><button data-action="overview">全景</button><button data-action="front">集结</button><button data-action="crystal">圣晶</button></div><div class="front-actions">${FRONT_KEYS.map((f) => `<button data-action="direction" data-key="${f}">${FRONTS[f].name.slice(0, 1)}</button>`).join("")}</div></aside><div class="battle-hint" id="mode-hint">拖放军团卡到城外召唤阵 · 框选军队 / 右键画路线 / 单击集火</div><div id="notice" role="status"></div><div class="pause-indicator" id="pause-indicator">战斗暂停 <small>空格继续 · 暂停时可购买预备军</small></div></div><section class="battle-dock"><div class="resource-row"><div class="crystal-wallet">◈ <b id="battle-money">${money(battle.money)}</b><span>魔晶</span><small id="income">战利品 +0</small></div><div class="force-counter"><span>在场 <b id="active-count">0</b><small>/ 300</small></span><span>预备 <b id="reserve-count">0</b></span><span>选中 <b id="selected-count">0</b></span></div><div class="batch-control"><label>购买 <select id="buy-batch"><option value="1">1批</option><option value="3">3批</option><option value="Infinity">尽可能多</option></select></label><label>部署 <select id="deploy-batch"><option value="1">1批</option><option value="3" selected>3批</option><option value="5">5批</option><option value="10">10批</option><option value="Infinity">全部库存</option></select></label></div><button class="small-gold" data-action="rally">设置集结点 ⚑</button><button class="small-gold" data-action="rally-all">一键全军 ↗</button><button class="small-gold" data-action="all-deploy">指定点全军</button><button class="small-gold" data-action="charge" title="明确命令当前军队与已排队军队自动攻城">全军自动进攻 ↑</button></div><div class="spell-row"><div class="mana-panel"><span>魔王法力 <b id="mana-value">100 / 100</b></span><div><i id="mana-fill"></i></div><small>每秒 +1.8 · 友军360距离提供施法视野</small></div><div class="spells">${SPELL_KEYS.map((k) => `<button class="spell-button" data-action="spell" data-key="${k}" data-spell="${k}" draggable="true" data-drag-spell="${k}" title="${SPELLS[k].description}"><kbd>${spellIcon(k)}</kbd><span>${SPELLS[k].name}<small>${SPELLS[k].cost}魔力</small></span><b class="spell-cd">就绪</b></button>`).join("")}</div><span class="rally-label" id="rally-label">集结：南境</span></div><div class="dock-main"><div class="troops-scroll">${cards}</div><div class="heroes-scroll">${heroCards}</div></div><div class="dock-footer command-footer"><div class="army-tabs"><button data-action="army-mode" data-key="stock" class="active">库存部署</button><button data-action="army-mode" data-key="field">战场选兵</button></div><div class="selection-summary"><span id="selection-label">部署后原地待命</span><div id="selection-types"></div></div><label class="priority-label">沿路优先 <select id="target-priority">${Object.entries(
    PRIORITIES,
  )
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join(
      "",
    )}<option value="mixed" disabled>混合优先级</option></select></label><button data-action="halt" id="halt-command">原地待命 S</button><span class="route-help" id="battle-message">右键拖画路线 · Shift+右键追加 · 到点停留</span><button data-action="select-all">全选 A</button><button data-action="help">?</button><span id="fps"></span></div></section></main><div class="cinematic" id="intro-overlay"><div class="cinematic-copy"><span class="eyebrow">THE LAST SIEGE / 最后的总攻</span><h2>圣曜城的黎明</h2><p>日轮圣晶即将净化这片大地。<br>让群山开路，让风暴撕开天幕。<br>今日，异界的命运由你决定。</p><div class="march-portraits">${l.commanders.map((c) => `<div>${portrait(c)}<span>${COMMANDERS[c].name}</span></div>`).join("")}</div><button class="primary" data-action="skip-intro">开始总攻 / 跳过演出 →</button></div></div>`;
  renderer = new Renderer(battle, $("#battle-view"), $("#minimap"));
  renderer.rally = { x: FRONTS.south.x, y: FRONTS.south.y };
  bindActions();
  bindBattleInput();
  const introStart = performance.now();
  renderer.onFrame = () => {
    if ($("#intro-overlay") && renderer) {
      const q = Math.min(1, (performance.now() - introStart) / 12000),
        ease = q * q * (3 - 2 * q);
      renderer.camera.x = 2000;
      renderer.camera.y = 1500 + 1000 * ease;
      const far = Math.min(renderer.width / 4200, renderer.height / 3800),
        near = Math.max(renderer.width / 4200, renderer.height / 3300);
      renderer.camera.zoom = far + (near - far) * ease;
    }
    updateHud();
  };
  introTimer = window.setTimeout(() => {
    if ($("#intro-overlay")) $('[data-action="skip-intro"]').click();
  }, 12000);
  renderer.onEvent = (e) => {
    if (["skill", "wall", "deploy", "capture", "victory", "defeat", "destroy"].includes(e.type))
      sound.play(e.kind === "titan" && e.type === "skill" ? "titan" : e.type);
    else if (e.type === "shot" && e.kind === "cannon") sound.play("cannon");
    if (e.type === "spell") sound.play("skill");
    if (e.type === "capture" || e.type === "reinforce" || e.type === "loot") notice(e.text ?? "");
    if (e.type === "victory" || e.type === "defeat") {
      if (renderer) renderer.camera = { x: 2000, y: 1840, zoom: 0.72 };
      resultTimer = window.setTimeout(showResult, 1600);
    }
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
  const members = b.members(b.selected),
    fieldCounts = new Map<Kind, number>(),
    selectedCounts = new Map<Kind, number>();
  for (const u of b.units)
    if (u.side === 0 && u.hp > 0) fieldCounts.set(u.kind, (fieldCounts.get(u.kind) ?? 0) + 1);
  for (const u of members) selectedCounts.set(u.kind, (selectedCounts.get(u.kind) ?? 0) + 1);
  $("#selected-count").textContent = String(members.length);
  for (const el of document.querySelectorAll<HTMLElement>('[data-action="army-mode"]'))
    el.classList.toggle("active", el.dataset.key === armyMode);
  $("#halt-command").toggleAttribute("disabled", members.length === 0);
  const travelling = members.filter((u) => u.order?.type === "move").length,
    waiting = members.filter((u) => u.order?.type === "hold").length;
  $("#selection-label").textContent = members.length
    ? `已选${members.length} · 行进${travelling} / 待命${waiting}`
    : armyMode === "field"
      ? "框选部队，或点兵种选同类"
      : "部署后原地待命 · Tab切换指挥";
  const markup = [...selectedCounts]
    .map(
      ([k, n]) =>
        `<button data-action="select-kind" data-key="${k}" title="点选全场同类，Shift追加">${isArmy(k) ? ARMIES[k].name : k === "king" ? "魔王" : isCommander(k) ? COMMANDERS[k].name : k} ×${n}</button>`,
    )
    .join("");
  if (markup !== selectedMarkup) {
    $("#selection-types").innerHTML = markup;
    selectedMarkup = markup;
  }
  const priorities = new Set(members.map((u) => u.priority)),
    priority = $<HTMLSelectElement>("#target-priority");
  priority.disabled = !members.length;
  priority.value = priorities.size === 1 ? [...priorities][0] : priorities.size ? "mixed" : "auto";
  const guardian = b.units.find((u) => u.side === 1 && u.kind === "captain" && u.hp > 0);
  $("#guardian-status").textContent = guardian
    ? `日轮守护骑士 ${Math.ceil((guardian.hp / guardian.maxHp) * 100)}%${guardian.sacredShield > 0 ? " · 圣光护盾" : ""}`
    : "守护骑士 已击破";
  $("#campaign-phase").textContent =
    `${b.crystal.hp < b.crystal.maxHp ? "中央核心决战" : b.units.some((u) => u.side === 0 && u.hp > 0 && u.x > 1200 && u.x < 2800 && u.y > 1100 && u.y < 2500) ? "内城进攻" : "外城资源掠夺"} · 已夺${b.stats.lootSites}处 / 物资+${b.stats.resourceIncome}`;
  $("#income").textContent = `战利品 +${b.stats.income}`;
  const time = Math.ceil(b.remaining);
  $("#clock").textContent = `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
  $("#crystal-hp").textContent = `${Math.ceil((b.crystal.hp / b.crystal.maxHp) * 100)}%`;
  $("#crystal-fill").style.width = `${(b.crystal.hp / b.crystal.maxHp) * 100}%`;
  $("#charge-fill").style.width = `${(b.time / DIFFICULTIES[b.loadout.difficulty].seconds) * 100}%`;
  $("#clock").classList.toggle("urgent", b.remaining < 60);
  $("#pause").textContent = b.paused ? "继续 ▶" : "暂停 Ⅱ";
  $("#speed").textContent = `${b.speed}×`;
  $("#pause-indicator").classList.toggle("visible", b.paused && !$("#intro-overlay"));
  $("#fps").textContent = `${Math.round(renderer.fps)} FPS`;
  $("#mode-hint").textContent =
    renderer.mode.type === "none"
      ? armyMode === "field"
        ? "框选或点兵种选同类 · 右键拖画路线 / Shift追加 · 沿途交战，到点停留"
        : "选卡点放 / 长按出兵 · 下兵原地待命 · Tab或战场选兵切换指挥"
      : renderer.mode.type === "deploy"
        ? "部署模式 · 点击批量 / 长按连续 · 绿色区域合法 · Esc取消"
        : renderer.mode.type === "rally"
          ? "设置集结点 · 点击绿色区域"
          : renderer.mode.type === "spell"
            ? "魔王法术 · 需要邻近友军与无遮挡视野 · 左键施法"
            : "统帅技能 · 注意英雄距离 · 左键确认 · Esc取消";
  $("#mana-value").textContent = `${Math.floor(b.mana)} / 100`;
  $("#mana-fill").style.width = `${b.mana}%`;
  $("#rally-label").textContent = renderer.rally
    ? `集结点 ${Math.round(renderer.rally.x)}, ${Math.round(renderer.rally.y)}`
    : "未设集结";
  for (const k of SPELL_KEYS) {
    const el = $<HTMLElement>(`[data-spell="${k}"]`),
      info = b.spellInfo(k);
    el.classList.toggle("ready", info.available);
    el.classList.toggle("aiming", renderer.mode.type === "spell" && renderer.mode.kind === k);
    el.querySelector(".spell-cd")!.textContent =
      b.mana < SPELLS[k].cost
        ? "魔力不足"
        : info.cooldown > 0
          ? `${Math.ceil(info.cooldown)}s`
          : "就绪";
  }
  for (const k of ARMY_KEYS) {
    const el = $(`[data-troop="${k}"]`);
    if (!el) continue;
    const count = fieldCounts.get(k) ?? 0,
      picked = selectedCounts.get(k) ?? 0;
    el.querySelector(".troop-stock")!.textContent = String(
      armyMode === "field" ? count : b.loadout.inventory[k],
    );
    el.querySelector(".troop-info")!.textContent =
      armyMode === "field"
        ? `场上${count} · 已选${picked}`
        : `${ARMIES[k].batch}只/批 · 场上${count}`;
    const card = el.querySelector<HTMLButtonElement>(".troop-deploy")!;
    card.draggable = armyMode === "stock";
    card.disabled = armyMode === "field" && count === 0;
    card.title = armyMode === "field" ? "点击选择全场同类 · Shift追加" : "点击或长按地图部署库存";
    el.classList.toggle("field-mode", armyMode === "field");
    el.classList.toggle("field-selected", picked > 0);
    el.querySelector(".quick-deploy")!.textContent =
      `出兵 ${Math.min(b.loadout.inventory[k], deployBatch * ARMIES[k].batch)} ↗`;
    el.classList.toggle("aiming", renderer.mode.type === "deploy" && renderer.mode.kind === k);
    el.querySelector<HTMLButtonElement>(".buy-button")!.disabled =
      b.money < batchPrice(b.loadout, k);
    el.querySelector(".affordable")!.textContent =
      `可购${Math.floor(b.money / batchPrice(b.loadout, k))}批`;
  }
  for (const k of ["king", ...b.loadout.commanders] as Kind[]) {
    const el = $(`[data-hero="${k}"]`);
    const info = b.skillInfo(k),
      queued = b.queue.some((q) => q.kind === k);
    el.classList.toggle("field-selected", selectedCounts.has(k));
    el.querySelector<HTMLButtonElement>(".hero-deploy")!.draggable =
      armyMode === "stock" && !info.unit;
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
    el.querySelector(".skill-button")!.classList.toggle("ready", info.available);
    el.classList.toggle("aiming", "kind" in renderer.mode && renderer.mode.kind === k);
  }
}
function bindBattleInput() {
  abort = new AbortController();
  const signal = abort.signal,
    r = renderer!,
    b = battle!,
    c = r.canvas;
  const stream = new DeploymentStream(b);
  r.onInputFrame = (now) =>
    stream.tick(now, r.mode.type === "deploy" && !document.hidden && !$("#help-modal"));
  signal.addEventListener("abort", () => stream.end(), { once: true });
  let down: {
    x: number;
    y: number;
    wx: number;
    wy: number;
    button: number;
    cx: number;
    cy: number;
    path: { x: number; y: number }[];
    append: boolean;
    dragged: boolean;
  } | null = null;
  const on = (target: EventTarget, event: string, fn: EventListener) =>
    target.addEventListener(event, fn, { signal });
  on(c, "contextmenu", (e) => e.preventDefault());
  const cancelGesture = () => {
    stream.end();
    down = null;
    r.routeDraft = null;
    r.selection = null;
  };
  for (const event of ["blur", "pointercancel"]) on(window, event, cancelGesture);
  on(document, "visibilitychange", cancelGesture);
  for (const event of ["blur", "pointerup", "pointercancel"]) on(window, event, () => stream.end());
  on(document, "visibilitychange", () => stream.end());
  on(c, "lostpointercapture", () => stream.end());
  for (const tray of document.querySelectorAll<HTMLElement>(".troops-scroll,.heroes-scroll"))
    tray.addEventListener(
      "wheel",
      (e) => {
        if (tray.scrollWidth > tray.clientWidth) {
          e.preventDefault();
          tray.scrollLeft += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        }
      },
      { signal, passive: false },
    );
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
    c.focus({ preventScroll: true });
    r.pointer = p;
    if (e.button === 2) {
      stream.end();
      if (r.mode.type !== "none") {
        r.mode = { type: "none" };
        updateHud();
        return;
      }
      e.preventDefault();
      if (!b.selected.size) {
        notice("先框选部队，或切到战场选兵后点选兵种");
        return;
      }
      armyMode = "field";
      down = {
        x: e.clientX,
        y: e.clientY,
        wx: p.x,
        wy: p.y,
        button: 2,
        cx: r.camera.x,
        cy: r.camera.y,
        path: [p],
        append: e.shiftKey,
        dragged: false,
      };
      c.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 0 && r.mode.type !== "none") {
      if (r.mode.type === "deploy") {
        const ok =
          r.mode.kind === "all"
            ? b.deployAll(p.x, p.y)
            : stream.begin(
                r.mode.kind,
                p.x,
                p.y,
                e.shiftKey ? Infinity : deployBatch,
                performance.now(),
              );
        notice(ok ? "军团正在从召唤阵出征" : "非法部署位置或库存不足");
        if (ok) {
          sound.play("deploy");
          r.rally = { ...p };
          if (r.mode.kind === "all" || !isArmy(r.mode.kind)) r.mode = { type: "none" };
          else c.setPointerCapture(e.pointerId);
        }
      } else if (r.mode.type === "rally") {
        if (!b.canDeploy(p.x, p.y)) notice("集结点必须在合法部署区");
        else {
          r.rally = { ...p };
          r.mode = { type: "none" };
          notice("集结点已设置，点击兵种下方快速出兵即可投放");
        }
      } else {
        const error =
          r.mode.type === "spell"
            ? b.castSpell(r.mode.kind, p.x, p.y)
            : b.cast(r.mode.kind, p.x, p.y);
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
      path: [],
      append: e.shiftKey,
      dragged: false,
    };
    c.setPointerCapture(e.pointerId);
  }) as EventListener);
  on(c, "pointermove", ((e: PointerEvent) => {
    r.pointer = r.screenToWorld(e.clientX, e.clientY);
    if (!down && r.mode.type === "none")
      r.hoverTarget = b.targetAt(r.pointer.x, r.pointer.y)?.id ?? 0;
    if (!down) return;
    if (down.button === 1) {
      r.camera.x = down.cx - (e.clientX - down.x) / r.camera.zoom;
      r.camera.y = down.cy - (e.clientY - down.y) / r.camera.zoom;
    } else if (down.button === 2) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) down.dragged = true;
      const last = down.path.at(-1)!;
      if (Math.hypot(r.pointer.x - last.x, r.pointer.y - last.y) > 55 && down.path.length < 96)
        down.path.push({ ...r.pointer });
      if (down.dragged) r.routeDraft = [...down.path, { ...r.pointer }];
    } else if (down.button === 0 && r.mode.type === "none")
      r.selection = {
        x: down.wx,
        y: down.wy,
        tx: r.pointer.x,
        ty: r.pointer.y,
      };
  }) as EventListener);
  on(c, "pointerup", ((e: PointerEvent) => {
    stream.end();
    if (down?.button === 2) {
      const p = r.screenToWorld(e.clientX, e.clientY),
        append = down.append || e.shiftKey;
      if (down.dragged) {
        b.followRoute(b.selected, routePoints([...down.path, p]), append);
        notice(
          append ? "已追加行进轨迹 · 沿途交战，到点停留" : "已设置行进轨迹 · 沿途交战，到点停留",
        );
      } else {
        const t = b.targetAt(p.x, p.y);
        if (t && !append) {
          b.command(b.selected, { type: "attack", target: t.id });
          notice("指定集火 · 目标击破后原地待命");
        } else {
          b.followRoute(b.selected, [p], append);
          notice(append ? "已追加路线点" : "向目标交战行进 · 到达后原地待命");
        }
      }
      r.routeDraft = null;
      down = null;
      updateHud();
      return;
    }
    if (down?.button === 0) {
      const p = r.screenToWorld(e.clientX, e.clientY);
      setArmyMode("field");
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const u = b.friendlyAt(p.x, p.y);
        if (!e.shiftKey) b.selected.clear();
        if (u) {
          if (e.shiftKey && b.selected.has(u.id)) b.selected.delete(u.id);
          else b.selected.add(u.id);
        }
      } else b.select(down.wx, down.wy, p.x, p.y, e.shiftKey);
      r.selection = null;
      updateHud();
    }
    down = null;
  }) as EventListener);
  on(c, "dblclick", ((e: MouseEvent) => {
    if (r.mode.type !== "none") return;
    const p = r.screenToWorld(e.clientX, e.clientY),
      u = b.friendlyAt(p.x, p.y);
    if (u) selectType(u.kind, e.shiftKey);
  }) as EventListener);
  on(document, "keydown", ((e: KeyboardEvent) => {
    if ((e.target as HTMLElement).matches("select,input,textarea") || $("#help-modal")) return;
    if (e.code === "Escape") {
      stream.end();
      r.mode = { type: "none" };
      r.selection = null;
      r.routeDraft = null;
      down = null;
      updateHud();
      return;
    }
    if ($("#intro-overlay")) {
      if (e.code === "Space" || e.code === "Enter") $('[data-action="skip-intro"]').click();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      stream.end();
      b.paused = !b.paused;
      updateHud();
    }
    if (e.code === "Tab") {
      e.preventDefault();
      setArmyMode(armyMode === "stock" ? "field" : "stock");
    }
    if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      b.halt(b.selected);
      notice("所选军队原地待命");
      updateHud();
    }
    if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setArmyMode("field");
      b.selected = new Set(b.units.filter((u) => u.hp > 0 && u.side === 0).map((u) => u.id));
      updateHud();
    }
    if (e.key.toLowerCase() === "f") aimSkill("king");
    const spell = SPELL_KEYS.find((k) => SPELLS[k].key.toLowerCase() === e.key.toLowerCase());
    if (spell && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      stream.end();
      aimSpell(spell);
    }
    const i = ["q", "w", "e", "r"].indexOf(e.key.toLowerCase());
    if (i >= 0 && b.loadout.commanders[i]) aimSkill(b.loadout.commanders[i]);
    if (["1", "2", "3"].includes(e.key)) {
      const gi = Number(e.key) - 1;
      if (e.ctrlKey) {
        e.preventDefault();
        b.groups[gi] = new Set(b.selected);
        notice(`编队${e.key}已保存`);
      } else {
        setArmyMode("field");
        b.selected = new Set([...b.groups[gi]].filter((id) => (b.byId.get(id)?.hp ?? 0) > 0));
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
      if (armyMode === "field" || (!isArmy(k) && b.getUnit(k))) {
        e.preventDefault();
        return;
      }
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
  for (const el of document.querySelectorAll<HTMLElement>("[data-drag-spell]")) {
    on(el, "dragstart", ((e: DragEvent) => {
      const k = el.dataset.dragSpell as Spell;
      stream.end();
      e.dataTransfer!.setData("text/plain", "spell:" + k);
      e.dataTransfer!.effectAllowed = "copy";
      r.mode = { type: "spell", kind: k };
      updateHud();
    }) as EventListener);
    on(el, "dragend", () => {
      r.mode = { type: "none" };
      updateHud();
    });
  }
  on(c, "dragover", ((e: DragEvent) => {
    e.preventDefault();
    r.pointer = r.screenToWorld(e.clientX, e.clientY);
    e.dataTransfer!.dropEffect = (
      r.mode.type === "spell"
        ? b.canCastSpell(r.pointer.x, r.pointer.y)
        : b.canDeploy(r.pointer.x, r.pointer.y)
    )
      ? "copy"
      : "none";
  }) as EventListener);
  on(c, "drop", ((e: DragEvent) => {
    e.preventDefault();
    const payload = e.dataTransfer!.getData("text/plain");
    const p = r.screenToWorld(e.clientX, e.clientY);
    if (payload.startsWith("spell:")) {
      const error = b.castSpell(payload.slice(6) as Spell, p.x, p.y);
      notice(error || "法术已释放");
    } else {
      const ok = b.deploy(payload as Kind, p.x, p.y, deployBatch);
      if (ok) r.rally = { ...p };
      notice(ok ? "部署成功 · 军团正在出征" : "非法部署或库存不足 · 未扣除库存");
    }
    r.mode = { type: "none" };
    updateHud();
  }) as EventListener);
  on($("#minimap"), "pointerdown", ((e: PointerEvent) => {
    const rect = $("#minimap").getBoundingClientRect();
    r.focus(
      ((e.clientX - rect.left) / rect.width) * WORLD.width,
      ((e.clientY - rect.top) / rect.height) * WORLD.height,
    );
  }) as EventListener);
  on($("#buy-batch"), "change", (() => {
    buyBatch = Number($<HTMLSelectElement>("#buy-batch").value);
  }) as EventListener);
  on($("#target-priority"), "change", (() => {
    b.setPriority(b.selected, $<HTMLSelectElement>("#target-priority").value as Priority);
    notice("已更新所选部队沿路目标优先级");
    updateHud();
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
  if (battle && battle.status === "battle") {
    helpWasPaused = battle.paused;
    battle.paused = true;
    updateHud();
  }
  const div = document.createElement("div");
  div.id = "help-modal";
  div.className = "modal";
  div.innerHTML = `<section class="manual"><button class="close" data-action="close-help">×</button><span class="eyebrow">FIELD MANUAL</span><h2>让每一支军团，抵达该去的战场。</h2><div class="manual-grid"><div><h3>01 / 部署与经济</h3><p>购买只扣一次魔晶，兵力进入库存。可从东南西北四面出兵。选卡后反复点地图，长按同一位置连续投放；1/3/5/10批或全部库存可调，默认3批。先设集结点，再点卡片下方出兵按钮；Shift一键投全部。拖放仍可用，300只以外的兵力保留在队列。</p><h3>02 / 指挥</h3><p>部署后原地待命。左键点选/框选，双击选择同类；底栏切换战场选兵后，点卡片选择全场同类，Shift追加。按住右键拖画行军轨迹，Shift+右键追加路点；单击敌人则集火。沿路攻击附近的优先目标，击退后继续行军，到终点停下；S立即待命。A全选，Tab切换底栏，Ctrl+1/2/3存编队，1/2/3选编队。全军自动进攻是明确命令，后续新部署仍待命。中键拖镜头，滚轮缩放，小地图定位。</p></div><div><h3>03 / 英雄与技能</h3><p>魔王F，统帅按招募顺序Q/W/E/R。先把英雄拖到合法区域，再按技能键，瞄准后左键确认。技能有距离和冷却；Esc取消。巨王必须指定可见墙段，龙息是扇形。通用魔王法术用Z/X/C/V或拖放图标：狂暴/治疗/守护/陨星，消耗随时间恢复的魔力，需要附近友军提供无遮挡视野。</p><h3>04 / 胜利之路</h3><p>核心节奏：外城掠夺→购买援军→拆城防/占前线→内城决战。资源设施奖励360–600魔晶，掠夺者击毁另加90。各方向守军可沿道路支援，核心有日轮守护骑士与精锐守军，注意护盾和震荡。无需清空所有资源；摧毁中央日轮圣晶即可胜利。巨人破侧墙，狼骑猎杀射手，地面拆防空后飞龙进军。四个前线据点需打通地面、清除守军、站稳8秒，随后+200魔晶并可就地部署援军。掠夺者对资源设施伤害×3且击毁额外+90；精灵范围魔法必须保护好。</p></div></div><p class="manual-footer">空格暂停，暂停时计时和技能冷却停止；2×同时加快战斗和倒计时。击杀、拆塔和占领奖励只有一次；内城预备队开局已存在，数量有限，沿城门与道路增援。魔王阵亡仍可战斗；时间耗尽或彻底力竭则失败。</p><button class="primary" data-action="close-help">明白了，准备出征 →</button></section>`;
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
