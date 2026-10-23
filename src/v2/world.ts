import type { Kind } from "./data";
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
}
export const OUTPOSTS = [
  {
    name: "西境哨所",
    x: 850,
    y: 1360,
    w: 360,
    h: 230,
    progress: 0,
    captured: false,
    contested: false,
    connected: false,
  },
  {
    name: "东境哨所",
    x: 2300,
    y: 1360,
    w: 330,
    h: 230,
    progress: 0,
    captured: false,
    contested: false,
    connected: false,
  },
];
export function createStructures(difficulty: string): Structure[] {
  let id = 1;
  const a: Structure[] = [];
  function add(
    kind: Kind,
    x: number,
    y: number,
    w: number,
    h: number,
    hp: number,
    weak = false,
  ) {
    a.push({
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
      reward:
        kind === "barracks"
          ? 100
          : ["arrow", "cannon", "antiAir", "holy"].includes(kind)
            ? 25
            : 0,
      paid: false,
      attackFlash: 0,
    });
  }
  // Complete enclosure. Segments are real collision objects, not a painted overlay.
  for (let x = 550; x <= 2650; x += 100) {
    const gate = x >= 1450 && x <= 1650,
      weak = (x >= 850 && x <= 1050) || (x >= 2250 && x <= 2450);
    add(
      gate ? "gate" : "wall",
      x,
      1700,
      100,
      48,
      gate ? 1500 : weak ? 650 : 1050,
      weak,
    );
    add("wall", x, 300, 100, 48, 1400);
  }
  for (let y = 400; y < 1700; y += 100) {
    add("wall", 500, y, 48, 100, 1100);
    add("wall", 2700, y, 48, 100, 1100);
  }
  for (let x = 1230; x < 2030; x += 100) {
    add("wall", x, 660, 100, 40, 850);
    add(
      x === 1530 || x === 1630 ? "gate" : "wall",
      x,
      1380,
      100,
      40,
      x === 1530 || x === 1630 ? 850 : 650,
      x < 1400 || x > 1800,
    );
  }
  for (let y = 760; y < 1380; y += 100) {
    add("wall", 1180, y, 40, 100, 650, y >= 1160);
    add("wall", 2020, y, 40, 100, 650, y >= 1160);
  }
  add("arrow", 650, 1620, 70, 75, 650);
  add("arrow", 1200, 1600, 70, 75, 650);
  add("arrow", 1990, 1600, 70, 75, 650);
  add("arrow", 2600, 1620, 70, 75, 650);
  add("cannon", 850, 1510, 95, 75, 850);
  if (difficulty !== "easy") add("cannon", 1580, 1540, 100, 80, 1100);
  add("antiAir", 2330, 1520, 70, 80, 800);
  add("antiAir", 1770, 820, 70, 80, 750);
  if (difficulty === "hard") add("cannon", 2180, 1510, 90, 75, 850);
  add("holy", 1310, 1130, 70, 75, 800);
  add("holy", 1940, 1130, 70, 75, 800);
  add("barracks", 1080, 1360, 130, 90, 1300);
  add("barracks", 2160, 1090, 130, 90, 1200);
  add("crystal", 1600, 1000, 100, 100, 5600);
  return a;
}
