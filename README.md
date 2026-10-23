# 丧尸围城：亡骸君主

> **Zombie Siege: Ash Sovereign** — 暗黑奇幻像素风 · 单人攻城策略 · 软件工程课程项目

你从古墓中苏醒，是统御尸潮的亡骸君主。人类的最后之城「曙光城」以中央灯塔的净化之光抵挡黑蚀，你必须在其充能完成之前攻破城墙、摧毁灯塔——或者在最后关头发动不可逆的「万骸归一」，把整个亡灵王国烧成最后一支大军。

![状态](https://img.shields.io/badge/build-passing-brightgreen) ![测试](https://img.shields.io/badge/tests-vitest-blue) ![引擎](https://img.shields.io/badge/engine-Phaser%203.90-8a2be2)

---

## 线上游戏

**👉 https://liguanheng.github.io/SEAPP1/** （部署完成后启用，见下方"部署"）

> 若链接暂时 404，说明 GitHub Pages 尚未在仓库 Settings 中开启，见 [部署](#部署)。

## 玩法概览

| 系统 | 说明 |
|---|---|
| **多日战役** | 每日「议事厅建设 → 一次攻城 → 战报 → 人类发展 → 灯塔充能」。战果跨天保留。 |
| **双资源** | 尸骸（建造/招兵）、变异精华（精锐/祭坛）。所有收支进账本。 |
| **尸巢繁殖** | I/II/III 级每日 +12 / +22 / +35 食尸鬼，建设次日生效。 |
| **精锐改造** | 用**现有**食尸鬼 + 精华改造疾行者 / 重装感染者 / 蛛行者。 |
| **实时攻城** | 卡片批量投放（30/12/4/8），自动索敌，右键集火/移动，镜头平移缩放，1×/2× 倍速。 |
| **可破坏城防** | 外墙分段 HP → 轻损 → 重损 → 缺口，缺口跨日永久存在。 |
| **前线争夺** | 清除守军并驻守 8 秒占领，次日解锁更靠前的部署区。 |
| **人类 AI** | 预算约束下补兵、修墙、建塔；军营/兵工厂/能源站被毁会真实削弱其后劲。 |
| **终局** | 「万骸归一」献祭全部建筑与资源，君主化身登场，全军分批冲锋。 |
| **存档** | localStorage + schemaVersion + 结构校验，刷新不丢战役。 |

## 操作

| 按键 | 功能 |
|---|---|
| `1`–`5` | 选择兵种卡（进入部署模式） |
| 左键 | 部署模式下投放一批 / 空手时选择或框选单位 |
| 右键 | 命令移动或集火 / 部署模式下取消 |
| `WASD` · 滚轮 · 空格 | 平移镜头 · 缩放 · 回到主军 |
| `P` | 暂停 |
| `Q` `E` `R` | 君主技能（亡灵号令 / 尸体复苏 / 死亡迷雾） |
| `F` | 终局：全军冲锋 |
| `Esc` | 取消部署 / 取消选择 |

## 技术栈

- **Phaser 3.90**：战场渲染、Tilemap、相机、动画
- **TypeScript 5.9**：严格模式，战役逻辑与渲染分离
- **Vite 7**：开发与构建
- **Vitest 3**：核心规则与战斗模拟测试
- **GitHub Actions + Pages**：CI 与静态部署

## 本地运行

```bash
git clone https://github.com/LiGuanheng/SEAPP1.git
cd SEAPP1
npm ci
npm run dev        # http://localhost:5173
```

构建与测试：

```bash
npm run test       # Vitest：经济/战役/存档/战斗模拟
npm run build      # tsc --noEmit && vite build → dist/
npm run preview    # 预览生产构建
```

## 部署

1. 推送到 `main` 后，`.github/workflows/deploy.yml` 会自动执行 `npm ci → npm run test → npm run build → deploy-pages`。
2. 首次需在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 构建基路径已设为 `base: '/SEAPP1/'`，产物可直接在 `https://liguanheng.github.io/SEAPP1/` 访问。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/SRS.md](docs/SRS.md) | 需求规格（FR/NFR、验收条件） |
| [docs/SDD.md](docs/SDD.md) | 概要设计（架构、状态机、数据结构、系统设计） |
| [docs/TRACEABILITY.md](docs/TRACEABILITY.md) | 需求 → 代码 → 测试追溯矩阵 |
| [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | 测试结果与已知缺陷 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 技术取舍与待学生验收项 |
| [docs/DEV_LOG.md](docs/DEV_LOG.md) | 分阶段开发日志与 commit |
| [docs/AI_COLLABORATION.md](docs/AI_COLLABORATION.md) | 人机协作真实记录 |
| [docs/ASSET_LICENSES.md](docs/ASSET_LICENSES.md) | 素材来源与许可 |
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | 玩家手册与 FAQ |
| [docs/BALANCE_NOTES.md](docs/BALANCE_NOTES.md) | 数值与调参记录 |

## 项目结构

```text
src/
  config/     数值、地图、版本
  core/       战役状态、经济、日结算、存档（纯 TS，可测试）
  battle/     流场寻路、实时战斗模拟（可 headless）
  art/        程序化像素素材（地形/单位/建筑/特效）
  game/       Phaser 场景与输入
  ui/         DOM 界面（菜单/议事厅/HUD/战报/结局）
docs/         课程文档
tests/        Vitest 测试
```

## V1 范围说明

已实现：4 种亡灵兵种（食尸鬼/疾行者/重装/蛛行者）+ 斧头巨汉 Boss、3 条攻城路线与 3 个前线、2 座能源站、军营/兵工厂/研究所/医疗中心、多日战役、人类预算 AI、灯塔倒计时、终局献祭、君主化身、3 难度、存档、双结局。

**未实现（留给 Codex 扩展）**：亡灵法师、腐鸦、蜘蛛女皇/亡灵骑士/腐羽巨鸟、完整 6 建筑科技树、人类预备队复杂调防、450–500 同屏高精度 AI、多地图与剧情分支。详见 [docs/SRS.md §1.3](docs/SRS.md)。

## 声明

本项目为原创作品，角色、城邦与剧情均为原创，未使用任何商业 IP 的角色、名称或素材；灵感仅来自暗黑奇幻与攻城策略品类。素材许可见 [docs/ASSET_LICENSES.md](docs/ASSET_LICENSES.md)。
