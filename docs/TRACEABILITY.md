# 需求追溯矩阵（Traceability Matrix）

> 需求 ID ↔ 设计模块 ↔ 源文件 ↔ 测试/证据 ↔ 状态。
> 状态只有在**实际运行验证后**才更新。最后更新：2026-10-24（M5）。

**图例**：✅ 已实现并验证 ｜ 🟡 已实现待复验 ｜ ⬜ 未实现 ｜ ⏸ 延期（明确不在 V1 范围）

| 需求 | 优先级 | 设计模块 | 源文件 | 测试 / 证据 | 状态 |
|---|---|---|---|---|---|
| FR-01 主菜单 | P0 | UI Shell | `src/ui/shell.ts` `src/main.ts` | 冒烟 1；无存档时"继续"禁用；返回菜单销毁 Phaser 实例与监听 | ✅ |
| FR-02 可跳过开场 | P0 | Intro | `src/ui/intro.ts` | 冒烟 2；`intro-skip` 直接进入议事厅 | ✅ |
| FR-03 大地图与镜头 | P0 | WorldScene | `src/game/WorldScene.ts` `src/config/mapData.ts` | 160×112 地图；WASD/滚轮/空格；三方向路线 | ✅ |
| FR-04 双资源账本 | P0 | Economy | `src/core/economy.ts` `src/core/state.ts` | `tests/economy.test.ts`；事件账本 `ledger` | ✅ |
| FR-05 建造次日生效 | P0 | Economy | `src/core/economy.ts` | `economy.test.ts`「建造尸巢立即扣资源，但当日不产兵」 | ✅ |
| FR-06 尸巢日繁殖 | P0 | Economy | `src/core/economy.ts` | `economy.test.ts` 12/22/35 三档 | ✅ |
| FR-07 精锐改造扣源 | P0 | Economy | `src/core/economy.ts` | `economy.test.ts` 扣 2 食尸鬼+2 精华；不足则拒绝 | ✅ |
| FR-08 三兵种差异 | P0 | Balance/Sim | `src/config/balance.ts` `src/battle/sim.ts` | siege 1/0.6/2.5；速度 58/100/34；目标偏好 | ✅ |
| FR-09 斧头巨汉 | P0 | Economy/Sim | `src/core/economy.ts` `src/battle/sim.ts` | 祭坛+25 精华唤醒；独立卡位；重伤休整 | ✅ |
| FR-10 批量部署 | P0 | Sim | `src/battle/sim.ts` | 冒烟 6（投放 30）；`canDeploy` 返回 6 种失败原因 | ✅ |
| FR-11 半自动战斗与指令 | P0 | Sim | `src/battle/sim.ts` | 冒烟 7（框选 27）；右键移动/集火 | ✅ |
| FR-12 墙段破坏持久 | P0 | Nav/Sim | `src/battle/nav.ts` `src/battle/sim.ts` | `campaign.test.ts`「缺口跨日保持」；冒烟 8 破墙 | ✅ |
| FR-13 前线占领 | P0 | Territory | `src/config/mapData.ts` `src/battle/sim.ts` | 8 秒占领；`campaign.test.ts` 次日激活 | ✅ |
| FR-14 人类自动防御 | P0 | Sim | `src/battle/sim.ts` | 8 座+新建塔；射程/间隔/转向；圣光塔需供电 | ✅ |
| FR-15 人类日发展 | P0 | HumanDirector | `src/core/campaign.ts` | `campaign.test.ts` 军营尽毁不补兵；战报显示人类行动 | ✅ |
| FR-16 灯塔充能 | P0 | Campaign | `src/core/campaign.ts` | `campaign.test.ts` 16/13/10%；能源站当日生效 | ✅ |
| FR-17 日回合顺序 | P0 | Campaign | `src/core/campaign.ts` | 冒烟 9–11（战报→第 2 天）；`advanceDay` 单次调用 | ✅ |
| FR-18 万骸归一 | P0 | Sacrifice | `src/core/campaign.ts` | `campaign.test.ts` 预览/一次性/兵力守恒；终局流程实测 | ✅ |
| FR-19 胜负结局 | P0 | Campaign/UI | `src/core/campaign.ts` `src/ui/report.ts` | 胜利与失败两条路径实测，截图 `m4-victory.png` / `m4-defeat.png` | ✅ |
| FR-20 战报 | P0 | Report UI | `src/ui/report.ts` | 冒烟 9；含兵力/城防/灯塔/人类反应/次日生产 | ✅ |
| FR-21 存档读档 | P0 | Save | `src/core/save.ts` | `save.test.ts` 9 用例；坏档不白屏；冒烟 11 | ✅ |
| FR-22 操作与提示 | P0 | Input/HUD | `src/game/WorldScene.ts` `src/ui/hud.ts` | 冒烟；键位与《操作说明》一致（W 为镜头，技能未实现） | ✅ |
| FR-23 画面与声音 | P0 | Art/Audio | `src/art/*` `src/audio.ts` | 程序化像素素材；Web Audio 合成音效；静音开关 | ✅ |
| FR-24 构建与部署 | P0 | Vite/CI | `vite.config.ts` `.github/workflows/deploy.yml` | GitHub Actions 成功；https://liguanheng.github.io/SEAPP1/ HTTP 200 | ✅ |
| FR-25 过程材料 | P0 | Docs | `docs/*` | SRS/SDD/TRACEABILITY/TEST_REPORT/DEV_LOG/DECISIONS/AI_COLLABORATION/ASSET_LICENSES/USER_MANUAL | ✅ |
| FR-26 蛛行者 | P1 | Economy/Sim | `src/core/economy.ts` | 2 级变异池解锁；模型与批次数值已实现 | ✅ |
| FR-26b 第三前线 | P1 | Territory | `src/config/mapData.ts` | 三处前线均可占领，已实现 | ✅ |
| FR-27 人类预备队与反攻 | P1 | — | — | 未实现（人类只做建设/补兵） | ⏸ |
| FR-28 演示存档 | P1 | — | — | 未实现（可用 `?nopause=1` 加速演示） | ⏸ |
| FR-29 完整六兵种四 Boss | P2 | — | — | 法师/腐鸦/三额外 Boss 未实现 | ⏸ |
| FR-30 完整三线科技 | P2 | — | — | 完整 6 建筑科技树未实现 | ⏸ |

## 非功能需求

| NFR | 要求 | 证据 | 状态 |
|---|---|---|---|
| NFR-01 可用性 | 1366×768 可操作 | 1440×900 / 1366×768 人工检查 | ✅ |
| NFR-02 性能 | 100 单位稳定 | 逻辑 0.2ms/tick（347 单位）；渲染 FPS 待真机复验 | 🟡 |
| NFR-03 正确性 | 无负资源、日结算不重复 | 32 个单元测试 + 不变量校验 | ✅ |
| NFR-04 可维护性 | 数值集中、逻辑与渲染分离 | `config/balance.ts`；`core/`、`battle/` 不依赖 Phaser | ✅ |
| NFR-05 可复现 | lockfile + 固定种子 | `package-lock.json`；`createCampaign(seed)` | ✅ |
| NFR-06 数据可靠性 | schemaVersion + 坏档恢复 | `save.test.ts` | ✅ |
| NFR-07 安全与许可 | 无 token、素材可追溯 | `.gitignore`；`ASSET_LICENSES.md` | ✅ |
| NFR-08 可部署性 | 无后端、Pages 可访问 | Actions 部署成功；线上 HTTP 200 | ✅ |
| NFR-09 可追溯 | 需求→代码→测试 | 本文件 + 6 个里程碑提交 | ✅ |
| NFR-10 美术质量 | 非几何占位的完整画面 | 程序化像素素材 + AI 关键视觉 + 截图 | ✅ |

## 提交 ↔ 里程碑对照

| 里程碑 | commit | 说明 |
|---|---|---|
| M0 | `7c7f1f8` | 需求与工程骨架 |
| M1 | `a8d4e76` | 攻城画面样板 |
| M2 | `d1beea4` | 战术部署与可破坏城墙 |
| M3 | `3883014` | 多日战役与经济 |
| M4 | `a154a54` | 终局献祭与结局 |
| M5 | 见 `git log` 最后一个 `test:` 提交 | 测试、CI、部署、文档 |

> 说明：FR-27/28/29/30 为 P1/P2，V1 未实现，未在 UI 或文档中宣称完成。
