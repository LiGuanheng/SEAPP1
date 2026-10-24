import { type Difficulty, type Kind, WORLD } from "./data";
export type Front = "south" | "west" | "east" | "north";
export type District = "field" | "outer" | "inner" | "core";
export interface Structure {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  weak?: boolean;
  cooldown: number;
  reward: number;
  paid: boolean;
  attackFlash: number;
  district: District;
  front: Front;
  variant: number;
  resource?: boolean;
}
export const FRONTS: Record<
  Front,
  {
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    gateX: number;
    gateY: number;
    description: string;
  }
> = {
  south: {
    name: "南境 · 王道",
    x: 2000,
    y: 3370,
    w: 2300,
    h: 240,
    gateX: 2000,
    gateY: 3050,
    description: "重炮与主门，正面破城；军需充足",
  },
  west: {
    name: "西境 · 裂石",
    x: 250,
    y: 1800,
    w: 240,
    h: 2200,
    gateX: 600,
    gateY: 1900,
    description: "薄墙、矿场与轻骑，适合掠夺破壁",
  },
  east: {
    name: "东境 · 鹰卫",
    x: 3750,
    y: 1800,
    w: 240,
    h: 2200,
    gateX: 3400,
    gateY: 1700,
    description: "防空与弓手密集，地面迂回",
  },
  north: {
    name: "北境 · 静林",
    x: 2000,
    y: 230,
    w: 2300,
    h: 220,
    gateX: 2200,
    gateY: 550,
    description: "林地补给、法师与坚墙，侧翼突袭",
  },
};
export const FRONT_KEYS = Object.keys(FRONTS) as Front[];
export function frontAt(x: number, y: number): Front {
  const dx = (x - WORLD.crystal.x) / 1400,
    dy = (y - WORLD.crystal.y) / 1250;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "west" : "east") : dy < 0 ? "north" : "south";
}
export function districtAt(x: number, y: number): District {
  if (x > 1600 && x < 2400 && y > 1450 && y < 2150) return "core";
  if (x > 1200 && x < 2800 && y > 1100 && y < 2500) return "inner";
  if (x > 600 && x < 3400 && y > 550 && y < 3050) return "outer";
  return "field";
}
export const OUTPOSTS = FRONT_KEYS.map((front) => ({
  name: `${FRONTS[front].name.slice(0, 2)}前线`,
  front,
  x: front === "west" ? 950 : front === "east" ? 3050 : 2000,
  y: front === "south" ? 2770 : front === "north" ? 820 : 1800,
  w: 260,
  h: 220,
  progress: 0,
  captured: false,
  contested: false,
  connected: false,
}));
export const RESOURCE_NAMES: Partial<Record<Kind, string>> = {
  warehouse: "魔晶仓库",
  supply: "军需营地",
  mine: "魔晶矿场",
  transport: "帝国运输车",
};
export function createStructures(difficulty: Difficulty): Structure[] {
  const a: Structure[] = [];
  let id = 1;
  const add = (
    kind: Kind,
    x: number,
    y: number,
    w: number,
    h: number,
    hp: number,
    district: District,
    weak = false,
    variant = 0,
  ) => {
    const resource = kind in RESOURCE_NAMES;
    const reward = resource
      ? kind === "warehouse"
        ? 220
        : kind === "mine"
          ? 200
          : 150
      : kind === "barracks"
        ? 110
        : ["arrow", "cannon", "antiAir", "holy"].includes(kind)
          ? 40
          : 0;
    const s: Structure = {
      id: id++,
      kind,
      x,
      y,
      w,
      h,
      hp,
      maxHp: hp,
      weak,
      cooldown: 1 + (id % 7) * 0.13,
      reward,
      paid: false,
      attackFlash: 0,
      district,
      front: frontAt(x, y),
      variant,
      resource,
    };
    a.push(s);
    return s;
  };
  // Edges meet exactly at corners; every ring has four destructible gates.
  const ring = (
    l: number,
    t: number,
    r: number,
    b: number,
    district: District,
    hp: number,
    gates: { north: number; south: number; west: number; east: number },
  ) => {
    const edge = (
      start: number,
      end: number,
      fixed: number,
      horizontal: boolean,
      front: Front,
      gate: number,
    ) => {
      const part = (lo: number, hi: number) => {
        const count = Math.ceil((hi - lo) / 100),
          length = (hi - lo) / count;
        for (let i = 0; i < count; i++) {
          const p = lo + (i + 0.5) * length;
          const weak =
            (district === "outer" &&
              ((front === "west" && p > 2200) || (front === "north" && p < 1400))) ||
            (district === "inner" && front === "east" && p > 2000);
          add(
            "wall",
            horizontal ? p : fixed,
            horizontal ? fixed : p,
            horizontal ? length : 60,
            horizontal ? 60 : length,
            weak ? Math.round(hp * 0.58) : hp,
            district,
            weak,
          );
        }
      };
      part(start, gate - 80);
      add(
        "gate",
        horizontal ? gate : fixed,
        horizontal ? fixed : gate,
        horizontal ? 160 : 60,
        horizontal ? 60 : 160,
        Math.round(hp * 0.85),
        district,
      );
      part(gate + 80, end);
    };
    edge(l - 30, r + 30, t, true, "north", gates.north);
    edge(l - 30, r + 30, b, true, "south", gates.south);
    edge(t + 30, b - 30, l, false, "west", gates.west);
    edge(t + 30, b - 30, r, false, "east", gates.east);
  };
  ring(600, 550, 3400, 3050, "outer", 1000, { north: 2200, south: 2000, west: 1900, east: 1700 });
  ring(1200, 1100, 2800, 2500, "inner", 1250, { north: 1800, south: 2200, west: 1600, east: 1950 });
  ring(1600, 1450, 2400, 2150, "core", 900, { north: 2000, south: 2000, west: 1800, east: 1800 });
  for (const [kind, x, y] of [
    ["supply", 1500, 3230],
    ["transport", 2580, 3200],
    ["mine", 440, 2400],
    ["supply", 410, 1200],
    ["warehouse", 3550, 2200],
    ["transport", 3550, 1050],
    ["mine", 1400, 420],
    ["supply", 2750, 400],
    ["warehouse", 1540, 2760],
    ["mine", 880, 2250],
    ["supply", 3080, 1270],
    ["warehouse", 2500, 850],
  ] as [Kind, number, number][])
    add(kind, x, y, 105, 85, kind === "transport" ? 400 : 660, districtAt(x, y));
  for (const [kind, x, y, d] of [
    ["arrow", 1830, 2960, "outer"],
    ["cannon", 2210, 2850, "outer"],
    ["arrow", 2460, 2970, "outer"],
    ["antiAir", 2040, 2860, "outer"],
    ["arrow", 710, 1730, "outer"],
    ["arrow", 760, 2400, "outer"],
    ["antiAir", 3250, 1530, "outer"],
    ["arrow", 3270, 1910, "outer"],
    ["arrow", 3210, 2300, "outer"],
    ["arrow", 2010, 650, "outer"],
    ["cannon", 2470, 720, "outer"],
    ["cannon", 1450, 2250, "inner"],
    ["holy", 2520, 2320, "inner"],
    ["cannon", 2600, 1530, "inner"],
    ["holy", 1400, 1320, "inner"],
    ["antiAir", 1770, 1250, "inner"],
    ["antiAir", 2600, 2030, "inner"],
    ["antiAir", 1910, 2310, "inner"],
    ["holy", 1800, 1740, "core"],
    ["holy", 2230, 1920, "core"],
    ["antiAir", 2220, 1590, "core"],
    ["antiAir", 1830, 1980, "core"],
  ] as [Kind, number, number, District][])
    add(kind, x, y, kind === "cannon" ? 90 : 60, 70, kind === "cannon" ? 900 : 720, d);
  if (difficulty === "hard") {
    add("cannon", 920, 1480, 90, 70, 900, "outer");
    add("antiAir", 1450, 2050, 60, 70, 720, "inner");
  }
  for (const [x, y, v] of [
    [1450, 2010, 4],
    [2530, 1770, 5],
    [1510, 1600, 4],
    [2500, 1270, 5],
  ])
    add("barracks", x, y, 150, 110, 1250, "inner", false, v);
  for (const [x, y, v] of [
    [950, 1110, 6],
    [1000, 2710, 7],
    [2900, 2780, 6],
    [3030, 950, 7],
    [1430, 840, 7],
    [2700, 2820, 6],
  ])
    add("cityblock", x, y, 180, 130, 800, "outer", false, v);
  let decor = 0;
  for (const y of [900, 1240, 1510, 2110, 2440, 2770])
    for (const x of [830, 1080, 1390, 1670, 2240, 2510, 2870, 3150]) {
      if (x > 1150 && x < 2850 && y > 1050 && y < 2600) continue;
      const xx = x + Math.sin(x + y) * 28,
        yy = y + Math.cos(x - y) * 30;
      if (
        a.some(
          (s) => s.kind !== "wall" && s.kind !== "gate" && Math.hypot(s.x - xx, s.y - yy) < 210,
        )
      )
        continue;
      add(
        "cityblock",
        xx,
        yy,
        90,
        70,
        420,
        "outer",
        false,
        decor++ % 4 === 0 ? 7 : 10 + (decor % 6),
      );
    }
  add("cityblock", 2000, 1330, 170, 100, 900, "inner", false, 8);
  add("crystal", 2000, 1800, 120, 120, 5600, "core");
  return a;
}
