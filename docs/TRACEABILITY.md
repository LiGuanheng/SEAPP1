# 需求追溯矩阵（Traceability Matrix）

> 需求 ID ↔ 设计模块 ↔ 源文件 ↔ 测试/证据 ↔ 状态。
> 状态只在**实际验证后**更新；`待实现` 不得写成 `已实现`。

**图例**：✅ 已实现并验证 ｜ 🟡 已实现待验证 ｜ ⬜ 待实现 ｜ ⏸ 延期

| 需求 | 优先级 | 设计模块 | 源文件 | 测试 / 证据 | 状态 |
|---|---|---|---|---|---|
| FR-01 主菜单 | P0 | UI Shell | `src/ui/shell.ts` `src/main.ts` | 手测：五个入口可点；无存档时"继续"禁用 | 🟡 |
| FR-02 开场 | P0 | Intro | `src/ui/intro.ts` | 手测：可跳过 | ⬜ |
| FR-03 大地图与镜头 | P0 | WorldScene | `src/game/WorldScene.ts` `src/config/mapData.ts` | 手测：平移/缩放/双路线 | ⬜ |
| FR-04 双资源账本 | P0 | Economy | `src/core/economy.ts` `src/core/state.ts` | `tests/economy.test.ts` | ⬜ |
| FR-05 建造次日生效 | P0 | Economy | `src/core/economy.ts` | `tests/economy.test.ts`（T01/T02） | ⬜ |
| FR-06 尸巢日繁殖 | P0 | Campaign | `src/core/campaign.ts` | T01 | ⬜ |
| FR-07 精锐改造扣源 | P0 | Economy | `src/core/economy.ts` | T02 | ⬜ |
| FR-08 三兵种差异 | P0 | Balance/Sim | `src/config/balance.ts` `src/battle/sim.ts` | 模拟对照：破墙效率 | ⬜ |
| FR-09 斧头巨汉 | P0 | Economy/Sim | `src/core/economy.ts` `src/battle/sim.ts` | 手测 + 模拟 | ⬜ |
| FR-10 批量部署 | P0 | Deployment | `src/battle/sim.ts` | T03 + 手测 | ⬜ |
| FR-11 半自动战斗 | P0 | Sim/AI | `src/battle/sim.ts` | 手测：框选/集火 | ⬜ |
| FR-12 墙段破坏持久 | P0 | Nav/Wall | `src/battle/nav.ts` `src/battle/sim.ts` `src/core/campaign.ts` | T04 | ⬜ |
| FR-13 前线占领 | P0 | Territory | `src/config/mapData.ts` `src/battle/sim.ts` | T05 | ⬜ |
| FR-14 人类防御 AI | P0 | Sim | `src/battle/sim.ts` | 手测 + 模拟 | ⬜ |
| FR-15 人类日发展 | P0 | HumanDirector | `src/core/campaign.ts` | T06 | ⬜ |
| FR-16 灯塔充能 | P0 | Campaign | `src/core/campaign.ts` | T07 | ⬜ |
| FR-17 日回合顺序 | P0 | Campaign | `src/core/campaign.ts` | T08 + 手测 | ⬜ |
| FR-18 万骸归一 | P0 | Sacrifice | `src/core/campaign.ts` | T09 | ⬜ |
| FR-19 胜负结局 | P0 | Campaign/UI | `src/core/campaign.ts` `src/ui/screens.ts` | T11 + 手测两条路径 | ⬜ |
| FR-20 战报 | P0 | Report UI | `src/ui/screens.ts` | 手测 | ⬜ |
| FR-21 存档读档 | P0 | Save | `src/core/save.ts` | T10 | ⬜ |
| FR-22 操作与提示 | P0 | Input/HUD | `src/game/WorldScene.ts` `src/ui/screens.ts` | 手测 | ⬜ |
| FR-23 画面与音效 | P0 | Art | `src/art/*` | 截图 + 手测 | ⬜ |
| FR-24 构建与部署 | P0 | Vite/CI | `vite.config.ts` `.github/workflows/deploy.yml` | `npm run build`、线上烟测 | ⬜ |
| FR-25 过程材料 | P0 | Docs | `docs/*` | 文档自检 | 🟡 |
| FR-26 蛛行者/第三线 | P1 | — | — | — | ⬜ |
| FR-27 预备队反攻 | P1 | — | — | — | ⏸ |
| FR-28 演示存档 | P1 | — | — | — | ⏸ |
| FR-29 六兵种四 Boss | P2 | — | — | — | ⏸ |
| FR-30 完整科技 | P2 | — | — | — | ⏸ |

> 说明：M0 阶段只有工程与菜单，绝大多数 FR 仍为 ⬜，待后续里程碑逐项回填。
