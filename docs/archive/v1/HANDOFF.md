# 交接报告｜《丧尸围城：亡骸君主》v1.0.0

> 用途：把当前版本交给 **① 测试方（GPT）** 做黑盒验收，**② Codex** 做工程优化。
> 本文只写**已经发生的事实**与**明确未完成的事**。凡是没实测过的，一律标「未验证」，不作结论。
>
> 生成时间：2026-10-24 03:40 (UTC+8)　对应提交：`main` @ 见 §0.3

---

## 0. 30 秒速览

### 0.1 关键链接

| 项目 | 值 |
|---|---|
| 线上可玩地址 | https://liguanheng.github.io/SEAPP1/ |
| GitHub 仓库 | https://github.com/LiGuanheng/SEAPP1 |
| 部署方式 | GitHub Actions → GitHub Pages（`build_type=workflow`，push `main` 自动部署） |
| 本地工程路径 | `C:/Users/lgh11/WorkBuddy/SEAPP1` |

### 0.2 技术栈与规模

| 项 | 值 |
|---|---|
| 引擎 | Phaser 3.90.0（仅用于战场渲染） |
| 语言 / 构建 | TypeScript 5.9.3 / Vite 7.3.7 |
| 测试 | Vitest 5.0.5（34 用例）+ puppeteer-core 24（真实浏览器 E2E） |
| Node | 22.22.2（构建产物与 Node 版本无关，浏览器运行） |
| 源码规模 | `src/` 30 个 `.ts`，约 **8.6k 行**（其中 `battle/sim.ts` 1324 行、`game/WorldScene.ts` 958 行） |
| 构建产物 | `index.js` 1363 KB / gzip **387 KB**；`index.css` 22.9 KB |
| 素材 | 全部**程序化绘制**（像素画布）+ 3 张 AI 关键视觉（菜单、双结局） |
| 存档 | `localStorage`，key = `SEAPP1.zombie-siege.save.v1`，schemaVersion = 1 |

### 0.3 提交历史（10 条，全部已 push，无改写、无 force）

```
b30c408  feat: add axe brute charged slam               ← 当前 HEAD（本次交接前）
22d088b  docs: refresh screenshots from the deployed build
76e2247  fix: make essence economy reachable
40ed588  test: verify campaign and deploy web build
634f5c4  ci: build, test and deploy to GitHub Pages
a154a54  feat: complete final assault and ending
3883014  feat: add campaign progression and economy
d1beea4  feat: implement tactical deployment and destructible walls
a8d4e76  feat: build siege visual vertical slice
7c7f1f8  docs: establish requirements and project skeleton
```

> 本次交接另有一提交 `chore: add headless simulator and handoff report`（见 §0.4），把命令行模拟器、确定性修复与本文一起入库。

### 0.4 本次交接新增的三件事（Codex 请优先知晓）

1. **`npm run sim` 现在真的能用了**——之前 `package.json` 指向不存在的 `scripts/simulate.ts`（坏入口），现已实现为 headless 战斗模拟器。
2. **修掉一个非确定性缺陷**：`BattleSim` 用 `Math.random()` 初始化 `retarget` 计时器，导致**同一 seed 两次运行结果不同**（实测灯塔血量 10661 / 10848 / 12000 三次都不一样）。已改为战斗内种子随机数，并新增回归用例。
3. **因此修正了文档里一处虚假数据**：原文档写「第 5 天 150+8 把灯塔打到 11434/12000」，实测是 **12000/12000（完全未受损）**。已在 `BALANCE_NOTES.md` / `DEV_LOG.md` 更正。

---

## 1. 现在到底能玩到什么

一轮完整闭环（**已实测跑通**，非演示）：

```
主菜单 → 开场演出(可跳过) → 议事厅(建设) → 出征 → 攻城战 → 战报
   ↑                                                    ↓
   └────────── 次日议事厅(人类也在发展) ←── 日终结算 ←──┘
                                    ↓
                        第 N 天 → 万骸归一(不可逆) → 终局战 → 双结局
```

**具体系统**（每条都有对应实现文件，见 §3）：

- **亡灵侧经济**：尸巢（产兵 12/22/35 每日）、变异池、黑暗祭坛、王座（统御 180/300/450）、精锐改造、尸骸招募、巨汉唤醒。
- **人类侧 AI**：预算驱动，按「修墙 → 补兵 → 建塔 → 研究」优先级自动消耗，每日结算可见。
- **攻城**：卡片批量投放（30/12/4/8/1）、框选、右键移动/集火、1×/2×、暂停、撤退、全军冲锋（F）。
- **可破坏城防**：外墙 10 段 + 内墙 6 段 + 双城门，分段血量独立、4 档损伤表现、破口**跨日保留**。
- **3 条攻城路线**：正门 / 东西两侧，配合 3 个可占领前线（占领 8 秒，**次日**才能从该处出兵）。
- **灯塔倒计时**：每日充能 10% + 每座能源站 +3%（普通难度），充满即失败；摧毁能源站会拖慢它。
- **终局**：「万骸归一」一次性献祭所有建筑换兵力，君主化身入场，420 秒总攻，双结局 + 独立插画。
- **存档**：自动存档 + 手动「保存并返回」+ 坏档容错 + 战斗中刷新回退到议事厅。

---

## 2. 怎么跑起来

### 2.1 只想玩

直接开 https://liguanheng.github.io/SEAPP1/ ，桌面 Chrome / Edge 全屏。

### 2.2 要改代码

```bash
cd C:/Users/lgh11/WorkBuddy/SEAPP1
npm ci
npm run dev            # http://localhost:5173/
```

### 2.3 要验证（三条命令，互不替代）

```bash
npm run test                                   # 单元/模拟：34 用例，约 1.5s
npm run build                                  # 类型检查 + 生产构建（必须先过 tsc --noEmit）
npm run sim -- --final                         # 命令行战斗模拟（不需要浏览器）
node scripts/smoke.mjs https://liguanheng.github.io/SEAPP1/?nopause=1   # 真实浏览器 E2E，12 步
```

`npm run sim` 参数：

```bash
npm run sim -- --day 5 --army zombie:150,brute:8 --throne 2 --seed 20261024
npm run sim -- --final --army zombie:220,brute:24,boss:1 --json
npm run sim -- --scatter        # 随机散点投放（模拟玩家乱点，结果通常更差）
npm run sim -- --stagger 3      # 分 3 波投入，每波间隔 30s
```

---

## 3. 架构地图（Codex 必读）

### 3.1 分层与依赖方向

```
config/   纯数据（数值、地图、版本）        ← 谁都能 import，自己不 import 别人
core/     战役状态 / 经济 / 存档 / 结算      ← 不 import phaser（已核验：0 处）
battle/   实时战斗模拟 + 流场寻路            ← 不 import phaser（已核验：0 处）
art/      像素画布绘制（Canvas 2D 生成贴图）  ← 不 import phaser
game/     Phaser 场景：把 sim 的每帧状态画出来 ← 只有这里 import phaser
ui/       DOM 界面（菜单/议事厅/HUD/战报）    ← 不 import phaser
```

**关键设计**：`core` 与 `battle` 是**纯逻辑**，可以在 Node 里 headless 跑（这正是 `npm run sim` 和 Vitest 平衡测试成立的原因）。**新增玩法逻辑请放在 `core`/`battle`，不要写进 `WorldScene`**，否则会失去可测性。

### 3.2 数据流

```
CampaignState (core/types.ts)
   │  战斗前：把库存/建筑/城墙/据点/难度 打包进 SimOptions
   ▼
BattleSim (battle/sim.ts)  ──每帧 update(1/30)──►  units / structures / events
   │                                                   │
   │                                          WorldScene.syncUnits() 读状态画精灵
   ▼                                                   ▼
BattleResult (battle/result.ts)  ──►  applyBattleResult() 写回 CampaignState
   │                                        │
   └──► 战报 UI (ui/report.ts)               └──► advanceDay()：人类 AI / 充能 / 次日生产
```

### 3.3 关键文件对照

| 文件 | 行数 | 职责 | 改动风险 |
|---|---|---|---|
| `src/core/types.ts` | ~230 | 全部状态类型（`CampaignState` 等） | **高**：改字段要同步 `save.ts` 迁移 |
| `src/core/state.ts` | 150 | 开局状态、`validateState` 不变量 | 中 |
| `src/core/economy.ts` | ~200 | 建造/升级/改造/招募/唤醒（先校验后原子扣费） | 中 |
| `src/core/campaign.ts` | 356 | 战斗写回、人类 AI、充能、次日、献祭 | **高** |
| `src/core/save.ts` | ~150 | 序列化/归一化/坏档恢复 | **高** |
| `src/config/balance.ts` | 270 | 所有数值的唯一来源 | 低（改这里最安全） |
| `src/config/mapData.ts` | ~225 | 地图、城墙、塔、设施、据点、建造点 | 中 |
| `src/battle/sim.ts` | 1324 | 战斗模拟主体（寻路跟随、战斗、塔防、占领、胜负） | **高** |
| `src/battle/nav.ts` | ~180 | Dijkstra 流场（墙体=高代价） | 高 |
| `src/game/WorldScene.ts` | 958 | 渲染 + 输入 + 特效（不参与判定） | 中 |
| `src/ui/shell.ts` | 493 | 屏幕路由（菜单/议事厅/战斗/结局） | 中 |
| `src/ui/hud.ts` | ~400 | 战斗 HUD、小地图、兵种卡 | 中 |

### 3.4 必须守住的不变量（破坏会导致存档/结算出错）

1. 资源**永不为负**；任何支出先 `canAfford` 再扣。
2. `state.inventory` = 战斗结束时 `remaining（未出战） + survivors（幸存返回） + converted（战中转化）`。
3. `state.lighthouse.charge` 只增不减（除非胜利清档）；`0~100`。
4. `finalAssaultTriggered = true` 后**不可回退**：建筑全毁、资源清零、议事厅不能再经营。
5. 城墙 `destroyed` 跨日保留；破口不修（人类 AI 只修未倒塌的墙）。
6. 据点占领后 `activeForDeploy` **次日**才生效。
7. 存档 schema 变更必须升 `SAVE_SCHEMA_VERSION` 并在 `normalize()` 里做兼容。
8. 战斗模拟**必须**只用 `this.rng()`，禁止 `Math.random()`（否则确定性测试失效，见 §0.4）。

---

## 4. 给 GPT 的测试手册（黑盒验收）

> 目标：**用最少时间找出最可能崩的地方**。不要重复验证「界面好看」这类主观项。

### 4.1 十分钟快速验收（必做）

| # | 步骤 | 预期 |
|---|---|---|
| TC-01 | 打开线上地址，等 3 秒 | 主菜单出现（暗色、有主视觉），F12 Console **无红色报错** |
| TC-02 | 点「开始新战役」→ 等 2 秒 → 点「跳过」 | 进入议事厅，顶部显示 `第 1 天`，资源 `尸骸 80 / 精华 12` |
| TC-03 | 点左侧「尸巢」建造（30 尸骸） | 尸骸 80 → **50**，出现「建造中」，槽位状态变化 |
| TC-04 | 点右下「出征」 | 进入战场，底部 5 张兵种卡，倒计时 240 秒 |
| TC-05 | 点「食尸鬼」卡 → 点地图下方绿圈内 | 出现约 30 个食尸鬼；卡片库存减少；日志出现「投放 …×30」 |
| TC-06 | 点地图空白处外，扣住左键拖一个框 | 左侧出现「已选中 N 个单位」 |
| TC-07 | 右键点城墙方向 | 被选中单位往该方向移动/攻击 |
| TC-08 | 点「撤退」 | 弹出战报，显示击杀/阵亡/灯塔受损/战利品 |
| TC-09 | 战报页点最后一个按钮（下一天） | 回到议事厅，`第 2 天`，尸骸与精华按生产增加，人类有动作 |
| TC-10 | 刷新页面 → 点「继续战役」 | 回到第 2 天议事厅，资源与建筑与刷新前一致 |

> 以上 10 条**全部通过**才算「可交付」；任一条失败按 §4.4 记录。

### 4.2 深度测试矩阵

**A. 部署与指挥**

| # | 步骤 | 预期 | 失败时重点看 |
|---|---|---|---|
| A-01 | 不选卡片，直接点地图 | 不应投放任何单位 | `sim.deployedTotal` 是否变化 |
| A-02 | 选卡片后点**绿圈外**（如城内） | 提示「未占领/不在部署区」，不扣库存 | 提示文案是否出现 |
| A-03 | 连续点到库存耗尽 | 自动退出部署模式，卡片变灰 | 是否仍能无限投放 |
| A-04 | 统御打满后继续投放 | 提示统御不足，剩余库存保留 | 统御数字是否超上限 |
| A-05 | 框选后按 `F`（全军冲锋） | 剩余预备队被自动投入并推进 | 是否把兵投进墙里/水里 |
| A-06 | 按 `Esc` | 退出部署模式（不应直接退出战斗） | — |

**B. 城防与战斗**

| # | 步骤 | 预期 | 失败时重点看 |
|---|---|---|---|
| B-01 | 集中兵力打外城门 | 城门血量下降、变色、出现裂纹；倒下后有碎块+震屏 | 城门是否"打不动"或"瞬倒" |
| B-02 | 破墙后观察单位 | 单位**从缺口**进入，不再攻击残墙 | 是否卡在墙边原地抖动 |
| B-03 | 让疾行者靠近炮塔 | 疾行者优先扑炮塔/远程守军 | 是否无视塔直冲灯塔 |
| B-04 | 站在据点 8 秒 | 进度条满 → 占领 → 日志提示「次日可用」 | 当天就能出兵＝bug |
| B-05 | 打掉 2 座能源站后结束当天 | 战报里灯塔充能明显下降（约 -6%） | 能源站无效 |
| B-06 | 打到灯塔血量归零 | 立即胜利，弹战报 | 血量卡在 1 或超时 |

**C. 日循环与存档**

| # | 步骤 | 预期 | 失败时重点看 |
|---|---|---|---|
| C-01 | 建造后马上刷新 | 建造状态（施工中/已完工）不丢失 | 资源回滚/建筑消失 |
| C-02 | 战斗中途刷新 | 回到**议事厅**（不是战斗），且不重复扣兵 | 卡在黑屏 |
| C-03 | 手动改 localStorage 成 `{broken` 后点继续 | 提示「存档已损坏」，停留主菜单，不白屏 | 页面崩溃 |
| C-04 | 同一建造点连续点两次升级 | 第二次应被拒绝（资源/等级限制），不重复扣费 | 资源被扣两次 |
| C-05 | 巨汉唤醒后重伤 | 次日应处于休整状态，不可再部署 | 可无限次唤醒 |

**D. 终局与结局**

| # | 步骤 | 预期 | 失败时重点看 |
|---|---|---|---|
| D-01 | 第 1 天直接点「万骸归一」 | 未满足条件时按钮禁用或有明确提示 | 能提前发动＝条件漏洞 |
| D-02 | 满足条件后点开确认框 | 显示「现有库存 + 尸巢 + 尸骸兑换 + 精华重塑 = 总兵力」 | 预览数字与实际不符 |
| D-03 | 确认发动 | 所有建筑消失、资源清零、进入终局战、场上有君主 | 还能回议事厅＝严重 bug |
| D-04 | 终局失败（建议只带 20 兵） | 420 秒后失败 → 战报 → 「曙光长明」结局，存档**保留** | 结局页空白 |
| D-05 | 终局胜利 | 胜利结局，存档**清空**，主菜单「继续」变灰 | 胜利后还能读旧档 |

**E. 兼容与性能**

| # | 步骤 | 预期 | 失败时重点看 |
|---|---|---|---|
| E-01 | 窗口从 1920 拖到 1024 宽 | HUD 不重叠、不溢出、小地图仍在右下 | 元素错位/被裁切 |
| E-02 | 浏览器缩放到 80% / 125% | 点击坐标仍然准确（点哪投哪） | 点击偏移＝坐标换算 bug |
| E-03 | 开 F12 Performance 打一场终局（300+ 单位） | 记录**真实 FPS**（这是当前最大未知项） | 掉到 30 以下请记录机型 |
| E-04 | 连打 3 天后看任务管理器内存 | 内存应稳定，不应逐场暴涨 | 每场 +100MB＝泄漏 |
| E-05 | 手机 / iPad 打开 | 当前**未做移动端适配**，允许不可用，但应记录现象 | — |

### 4.3 已知脆弱点（优先打这里，最可能出问题）

1. **单位聚团**：大量单位挤在墙前会重叠成两团，有效攻击面比理论小很多。视觉上「一坨」，也会拖慢破墙。
2. **投放位置影响极大**：固定 5 条通道投放 vs 随机散点，终局结果能差 10%+ 灯塔伤害。玩家乱点可能明显更弱。
3. **中期打不到灯塔**：第 5 天规模（150 食尸鬼 + 8 重装，王座 II）能破 6 段墙，但**灯塔 12000/12000 完全未受损**。这是数值问题，不是操作问题。
4. **真机 FPS 从未测过**：所有自动化都在无头软件渲染上跑，帧率数据不可信。
5. **人类 AI 不反攻**：只会修墙/补兵/建塔/研究，不会来打你的前线据点。
6. **无 3× 倍速、无编队（Ctrl/Alt 数字）**：只有 1×/2× 和「全选/冲锋」。
7. **终局无独立过场**：确认弹窗后直接进战场。

### 4.4 缺陷报告模板（请按这个格式回传，方便直接进 issue）

```
【编号】BUG-001
【严重度】P0 阻塞 / P1 严重 / P2 一般 / P3 体验
【标题】一句话说清"什么情况下什么坏了"
【环境】Chrome 版本 / 系统 / 窗口尺寸 / 线上或本地
【复现步骤】
 1.
 2.
 3.
【期望】
【实际】
【复现率】3/3 或 1/5
【证据】截图 / Console 报错原文 / 当时的 day 与兵力
【附加线索】是否刷新后仍存在；是否是特定兵种/特定墙段
```

> 如果 Console 有报错，请**原样复制**，不要转述。`WorldScene` 的异常通常会中断渲染但保留 DOM，看起来像"卡住"。

### 4.5 不要浪费时间的事

- 不要评价「美术是否精美」「文案是否有文采」——这是主观项，且已知只有程序化像素 + 3 张 AI 图。
- 不要重复测「菜单能不能点」——已覆盖。
- 不要试图在手机上通关——移动端明确未适配。

---

## 5. 给 Codex 的优化交接（工程）

### 5.1 先读这 5 个文件（按顺序，约 15 分钟）

1. `docs/TEST_REPORT.md` §6「已知缺陷」——所有已知问题的清单与成因。
2. `docs/DECISIONS.md`——为什么用流场而非 A*、为什么墙体是高代价障碍、为什么素材程序化。
3. `src/config/balance.ts`——所有数值的唯一来源。
4. `src/battle/sim.ts` 的 `update()` / `updateUndead()` / `deploy()` / `damageStructure()`。
5. `src/core/campaign.ts` 的 `applyBattleResult()` / `advanceDay()`。

### 5.2 不许破坏的契约

| 契约 | 原因 | 违反后果 |
|---|---|---|
| `core/` 与 `battle/` 不 import phaser | headless 测试与 CLI 模拟依赖 | 测试全挂，无法回归 |
| `BattleSim` 只用 `this.rng()`，禁 `Math.random()` | 同 seed 可复现（已有回归用例锁死） | 平衡测试随机飘，无法定位改动效果 |
| `vite.config.ts` 的 `base: '/SEAPP1/'` | GitHub Pages 子路径部署 | 线上白屏 |
| 构建必须 `tsc --noEmit` 通过 | CI 会跑 `npm run build` | 部署失败 |
| 存档 schema 变更要升版本 + 迁移 | 玩家旧档会坏 | 读档崩溃 |
| `finalAssaultTriggered` 单向 | 剧情与资源不可逆 | 可以刷资源 |
| 提交历史不 squash / 不 rebase / 不 force | **课程要求，老师会查提交历史** | 直接判作业不合格 |

### 5.3 待办清单（按优先级，含定位与验收标准）

#### P0 — 直接影响「好不好玩」

**P0-1 解决单位聚团 / 攻击面问题**
- 位置：`src/battle/sim.ts` 的分离力（`COMBAT.separationStrength = 0.62`）、`damageStructure` 的调用点、`nav.ts` 的流场。
- 现象：单位挤在墙前叠成一团；150 单位实际只有约 10~15 个在输出。
- 建议：给"正在攻击同一目标"的单位分配**环形站位槽**（arrival slot），或在墙前引入"排队宽度"限制；分离力按距离分层而非全局常数。
- 验收：`npm run sim -- --day 5 --army zombie:150,brute:8 --throne 2` 的灯塔伤害从 **0** 变为 **> 0**，且 `npm run test` 仍全绿。

**P0-2 中期难度曲线**
- 位置：`src/config/balance.ts`（城墙/塔/灯塔血量、充能速度）、`src/core/campaign.ts`。
- 现象：第 5 天规模打不动灯塔；只有滚到终局规模才有胜算 → 中期缺少"差一点"的张力。
- 建议：让**充能压力**（而非血量）成为中期主要威胁；或让破损城防对后续进攻提供加成（破口越大，单位涌入越快）。
- 验收：CLI 跑 `day 3/5/7` 三档，灯塔伤害应呈**单调递增且第 7 天接近但未达胜利**。

**P0-3 真机性能基线**
- 位置：`WorldScene.syncUnits()`（每帧遍历全部单位 + 重设 depth/tint）、`maxActive`（260/180/320/220）。
- 现状：**从未在真实 GPU 上测过 FPS**。
- 做法：在 1440×900 下打一场 300 单位终局，记录 FPS 曲线；若 <45，先降低每帧 `setDepth` 调用（改为分桶）、关闭 `postFX.addVignette`、或降低同屏上限。
- 验收：给出「机型 + 平均 FPS + 最低 FPS」的实测表格，写进 `TEST_REPORT.md` §5.3。

#### P1 — 明显缺失但非阻塞

**P1-1 3× 倍速 + 编队**
- 位置：`WorldScene.setSpeed()`（现支持 1×/2×）、`ui/hud.ts` 的倍速按钮；编队需在 `WorldScene` 加 `groups: Map<number, Set<number>>`。
- 验收：`3` 键切 3×；`Ctrl+1..9` 存编组，`1..9` 调出。

**P1-2 人类 AI 反攻前线**
- 位置：`src/core/campaign.ts` 的 `humanTurn()`。
- 设计：预算充足时，有概率夺回一个玩家占领的据点（把 `owner` 改回 `human`，并要求玩家重打）。
- 验收：连续 5 天后至少出现一次「据点被夺回」的战报条目。

**P1-3 终局过场 + 君主主动技能**
- 位置：`src/ui/shell.ts` 的 `executeSacrifice()` 之后；`src/battle/sim.ts` 的 lord 分支。
- 建议：过场用已有 `intro.ts` 的分层结构复用；君主技能（如「亡者号令」：10 秒内全场攻速 +30%）用 `skill` 字段，仿照 boss 的 `skill` 冷却实现。

**P1-4 移动端 / 触屏**
- 位置：`src/style.css` 的媒体查询、`WorldScene` 的指针事件（当前依赖右键与滚轮）。
- 最低要求：竖屏给出「请横屏」提示；触屏支持单指拖动平移、双指缩放、长按=右键。

#### P2 — 内容扩展（任务书里的加分项）

- 亡灵法师（远程 AOE）、腐鸦（空中，无视墙体直线飞向灯塔）。
- 3 个额外 Boss（白骨领主 / 瘟疫巨兽 / 骸骨巨龙），复用 `boss` 的 `HumanoidCfg` 与 `skill` 机制。
- 完整 6 建筑科技树（现为 3 建筑 + 4 升级）。
- 新手引导（第 1 天用气泡提示 3 步）。

### 5.4 已知技术债（含成因，避免二次踩坑）

| 债 | 成因 | 建议 |
|---|---|---|
| `WorldScene.ts` 958 行，渲染/输入/特效/调试混在一起 | 里程碑赶工 | 拆成 `WorldRenderer` / `InputController` / `FxPlayer` |
| `shell.ts` 493 行做屏幕路由 | 没有路由框架 | 保留现状即可，DOM 界面不需要框架 |
| `sim.ts` 1324 行单类 | 战斗逻辑内聚 | 若加 Boss 技能，先抽 `abilities/` |
| 无 ECS / 无对象池 | 单位上限 320，够用 | 不要为了"架构好看"重写 |
| `docs/` 中部分截图来自无头渲染 | 无头不可代表真机 | 补真机截图 |
| devDependencies 有 7 个 high 漏洞（`extract-zip`，来自 puppeteer-core） | 仅测试工具链 | 不进构建产物；若在意可等 puppeteer-core 25 稳定后升级 |

### 5.5 改数值的标准流程（不要跳过）

```bash
# 1. 改 src/config/balance.ts（或 mapData.ts）
# 2. 用 CLI 扫一遍三个关键点
npm run sim -- --day 1 --army zombie:60
npm run sim -- --day 5 --army zombie:150,brute:8 --throne 2
npm run sim -- --final --army zombie:220,brute:24,boss:1
# 3. 跑单测确认没有回归
npm run test
# 4. 只有三步都符合预期，才提交
```

> **注意**：CLI 的 `--day N` 会同步放大该日的人类守军与城防强度，所以「同样的兵力、不同 day」结果不同，这是有意的，不是 bug。

### 5.6 提交规范（这门课会查历史）

- 一个逻辑改动 = 一个提交，信息用 `feat:` / `fix:` / `test:` / `docs:` / `ci:` / `chore:` 前缀。
- **禁止** `git commit --amend` 修改已 push 的提交、禁止 `push --force`、禁止把 10 个提交 squash 成 1 个。
- 每个提交都要能独立构建（CI 会在每次 push 跑 `npm run build`）。
- 改数值也必须带一句"为什么"，写在提交信息正文里。

### 5.7 常见坑（会让你以为代码坏了）

1. **无头截图/自动化看起来"卡住"**：Phaser 在页面失焦时会暂停主循环。测试 URL 必须带 `?nopause=1`。
2. **想快进战斗**：调 `window.__SEAPP1__.scene.advanceFor(秒)`（同步推进模拟，不依赖帧率）。
3. **调试句柄**：`window.__SEAPP1__ = { scene, state, game }`、`window.__SEAPP1_SHELL__ = shell`。生产构建里也存在，介意的话用 `import.meta.env.DEV` 包一层。
4. **`npm run build` 比 `vite build` 慢**：因为它先跑 `tsc --noEmit`，这是有意的。
5. **本地预览路径**：`vite preview` 要带 `--base=/SEAPP1/`，否则资源 404（Windows Git Bash 下还要 `MSYS_NO_PATHCONV=1`）。

---

## 6. 现状与差距（诚实清单）

### 6.1 已验证（有证据）

- 34 个自动化用例通过（经济 8 / 战役 12 / 存档 9 / 战斗 5）。
- 线上端到端 12 步冒烟通过，无 console 错误（`scripts/smoke.mjs`）。
- 胜利/失败两条结局链路均走通（截图 `docs/screenshots/m4-victory.png`、`m4-defeat.png`）。
- 存档：正常读写、坏档容错、战斗中断回退，均已实测。
- 战斗模拟：**同 seed 完全可复现**（本次新增回归用例）。

### 6.2 未验证（请在交接后补）

| 项 | 状态 | 谁来补 |
|---|---|---|
| 真实 GPU 上的 FPS / 内存 | **完全未测** | Codex 或学生 |
| 移动端 / 触屏 | 未适配，未测 | Codex（P1-4） |
| 长时间（10 天满局）稳定性 | 只跑过 2~3 天 | GPT 挂机测试 |
| 三档难度的手感差异 | 只缩放了参数，未分别试玩 | 学生 |
| 音频在真实扬声器下的表现 | 只验证了不报错 | 学生 |

### 6.3 明确未做（不要当成已完成）

- 3× 倍速、编队、编队 UI。
- 人类 AI 反攻。
- 终局过场动画、君主主动技能。
- 亡灵法师 / 腐鸦 / 3 个额外 Boss / 完整科技树。
- 新手引导。
- P2 的移动端适配。

---

## 7. 附录

### A. 关键数值（改之前先看这张表）

| 项 | 值 |
|---|---|
| 开局 | 60 食尸鬼 / 80 尸骸 / 12 精华 / 王座 I / 尸巢 I |
| 兵种（HP / DPS / 速度 / 统御 / 批量 / 攻城倍率） | 食尸鬼 60/6/58/1/30/×1；疾行者 45/9/100/2/12/×0.6；重装 420/18/34/6/4/×2.5；蛛行者 85/11/82/3/8/×0.8；巨汉 2500/90/40/10/1/×3.2 |
| 王座统御 | I 180 / II 300（70 尸骸 + 12 精华）/ III 450（130 + 25） |
| 尸巢产兵 | 12 / 22 / 35 每日 |
| 城防 | 外墙 3200 · 外城门 5200 · 内墙 4200 · 内城门 5200 · 灯塔 **12000** |
| 塔（HP / DPS / 射程） | 机枪 950/34/250 · 重炮 1100/80每3.5s(溅射62)/330 · 防空 700/55/300 · 圣光 1100/30/230 |
| 时限 | 攻城 240s · 终局 420s |
| 同屏上限 | 普通 260 / 低画质 180 / 终局 320 / 终局低画质 220 |
| 难度 | 简单 12 天·预算22·充能7%+2%/站；普通 10 天·30·10%+3%；困难 8 天·38·11%+4% |
| 精华来源 | 每 4 击杀 +1；每摧毁设施/塔 +3；据点 +4/+4/+3 |

### B. 公开 API 速查（在 Console 可直接用）

```js
const sc = window.__SEAPP1__.scene;
sc.sim.deploy('zombie', 80*32, 106*32);   // 投放
sc.sim.allOutCharge();                    // 全军冲锋（返回 {deployed}）
sc.sim.retreat();                         // 撤退
sc.sim.aliveUndead();                     // 在场亡灵数
sc.sim.commandInfo();                     // {used, cap}
sc.advanceFor(60);                        // 同步快进 60 秒
sc.setSpeed(2);                           // 1×/2×
sc.cameras.main.centerOn(80*32, 88*32);   // 镜头
window.__SEAPP1_SHELL__.state;            // 当前战役状态（可读可改，仅调试用）
```

### C. 可直接复制的两段 Prompt

**发给 GPT（测试）：**

```
你是黑盒测试。请打开 https://liguanheng.github.io/SEAPP1/ ，按我给的交接报告
docs/HANDOFF.md 的第 4 章执行测试（TC-01~TC-10 必须全做，再挑 A/B/C/D 里
你认为风险最高的 8 条）。要求：
1) 每条给出 PASS/FAIL，FAIL 必须按 4.4 模板写清步骤与期望/实际；
2) 记录浏览器版本、窗口尺寸、Console 是否有红色报错（原样复制）；
3) 额外重点验证 4.3 列出的 7 个脆弱点；
4) 不要评价美术与文案；不要测移动端（明确未适配）。
最后给出：P0/P1 缺陷列表（按影响排序）+ 一句总体结论（能否通关）。
```

**发给 Codex（优化）：**

```
这是《丧尸围城：亡骸君主》v1.0.0 的交接。仓库：https://github.com/LiGuanheng/SEAPP1
先读 docs/HANDOFF.md 第 5 章，再按顺序读 docs/TEST_REPORT.md §6、docs/DECISIONS.md、
src/config/balance.ts、src/battle/sim.ts、src/core/campaign.ts。

硬约束（违反即回滚）：
- core/ 与 battle/ 不得 import phaser；BattleSim 不得用 Math.random()（必须用 this.rng()）。
- vite base 必须是 /SEAPP1/；npm run test 与 npm run build 必须全绿。
- 禁止 amend / rebase / force push，提交信息用 feat/fix/test/docs 前缀，按逻辑拆分提交。

本轮目标（按顺序，做完一个提交一次）：
1) P0-1 解决单位聚团导致的有效攻击面过小；
2) P0-2 调整中期难度曲线（用 npm run sim 验证 day 1/5/7 单调递增且第 7 天接近但未胜）；
3) P1-1 加 3× 倍速与编队。
验收：npm run test 全绿；npm run sim -- --day 5 --army zombie:150,brute:8 --throne 2 的灯塔伤害从 0 变为 >0；
每个改动附一句"为什么"写进提交正文。
```

---

## 8. 联系人 / 下一步

1. **学生（LiGuanheng）**：亲自通关一次；在自己的机器上记录一次真实 FPS 补进 `TEST_REPORT.md` §5.3；试玩后填 `AI_COLLABORATION.md` 的「学生反馈」。
2. **GPT**：按 §4 出测试报告 → 缺陷回到 §5.3 的待办里。
3. **Codex**：按 §5.3 的 P0 顺序推进，每完成一项提交并 push（CI 会自动部署到线上，可在 Actions 页看结果）。

> 本文与代码不同步时，**以代码为准**，并请顺手更新本文——它是后续所有人的入口。
