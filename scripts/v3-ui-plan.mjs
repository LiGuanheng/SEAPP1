// Read-only planning for browser acceptance. Every returned action is executed through UI controls.
export function battlePlan() {
  const b = window.__SIEGE__.battle,
    allies = b.units.filter((u) => u.side === 0 && u.hp > 0),
    enemies = b.units.filter((u) => u.side === 1 && u.hp > 0),
    actions = [];
  const near = (u, r) => allies.filter((v) => Math.hypot(u.x - v.x, u.y - v.y) < r),
    dist = (u, v) => Math.hypot(u.x - v.x, u.y - v.y);
  for (const k of ["king", ...b.loadout.commanders]) {
    const u = b.getUnit(k);
    if (!u || !b.skillInfo(k).available) continue;
    let target;
    if (k === "titan")
      target = b.structures
        .filter(
          (s) =>
            s.hp > 0 &&
            ["wall", "gate"].includes(s.kind) &&
            dist(u, s) < 280 &&
            b.nav.clear(u, s, u.id, s.id),
        )
        .sort((a, c) => dist(u, a) - dist(u, c))[0];
    else if (k === "forest")
      target = near(u, 430)
        .filter((v) => v.hp / v.maxHp < 0.75)
        .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
    else if (k === "dragon")
      target = [...enemies, ...b.structures].find(
        (v) => v.hp > 0 && dist(u, v) < 250 && b.nav.clear(u, v, u.id, v.id),
      );
    else if (k === "web")
      target = enemies.find((v) => dist(u, v) < 400 && b.nav.clear(u, v, u.id, v.id));
    else if (k === "emperor") {
      if (near(u, 180).filter((v) => v.kind === "slime" || v.kind === "split").length > 10)
        target = u;
    } else if (near(u, 180).length > 4) target = u;
    if (target) actions.push({ type: "skill", kind: k, x: target.x, y: target.y });
  }
  const injured = allies
    .filter((u) => u.hp / u.maxHp < 0.65)
    .sort((a, c) => c.maxHp - c.hp - (a.maxHp - a.hp))[0];
  if (injured && near(injured, 160).length >= 3 && b.spellInfo("heal").available)
    actions.push({ type: "spell", kind: "heal", x: injured.x, y: injured.y });
  const push = allies
    .filter(
      (u) =>
        u.maxHp > 400 &&
        (u.hp < u.maxHp ||
          b.structures.some(
            (s) => s.hp > 0 && ["wall", "gate"].includes(s.kind) && dist(u, s) < 160,
          )),
    )
    .sort((a, c) => dist(a, { x: 2000, y: 1800 }) - dist(c, { x: 2000, y: 1800 }))[0];
  if (push && near(push, 180).length > 5)
    for (const k of ["barrier", "rage"])
      if (b.spellInfo(k).available) actions.push({ type: "spell", kind: k, x: push.x, y: push.y });
  const target = enemies
    .filter((e) => allies.some((u) => dist(e, u) < 340 && b.nav.clear(u, e, u.id, e.id)))
    .sort(
      (a, c) =>
        enemies.filter((e) => dist(e, c) < 150).length -
        enemies.filter((e) => dist(e, a) < 150).length,
    )[0];
  if (
    target &&
    enemies.filter((e) => dist(e, target) < 150).length >= 5 &&
    b.spellInfo("meteor").available
  )
    actions.push({ type: "spell", kind: "meteor", x: target.x, y: target.y });
  return {
    actions,
    snapshot: b.snapshot(),
    heroes: allies
      .filter((u) => ["king", ...b.loadout.commanders].includes(u.kind))
      .map((u) => ({ kind: u.kind, x: u.x, y: u.y, hp: u.hp })),
    canBuy: b.money >= 80,
  };
}
