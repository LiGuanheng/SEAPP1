# 开发日志（Development Log）

> 记录真实开发顺序、修改内容、测试命令与结果、已知缺陷、关联 commit。
> **不伪造**："AI 实施"与"学生验收"分开记录；未运行的测试不写"通过"。

---

## M0｜需求与工程初始化

- **时间**：2026-10-24
- **目标**：建立可运行的工程骨架、课程文档基线、主菜单。
- **实际完成**：
  - `git init`（main 分支），创建 `src/ config core battle art game ui persistence`、`public/assets`、`docs/`、`tests/`、`.github/workflows/`。
  - `package.json` + `package-lock.json`：phaser 3.90.0、vite 7.3.7、typescript 5.9.3、vitest 3.2.7。
  - `vite.config.ts`：生产 `base=/SEAPP1/`，开发 `/`。
  - `index.html` + `src/main.ts` + `src/style.css`（暗黑骨金视觉系统）+ `src/ui/shell.ts`（屏幕路由、模态、Toast）+ 主菜单。
  - 文档：`docs/SRS.md`、`docs/SDD.md`、`docs/DECISIONS.md`、`docs/AI_COLLABORATION.md`、`docs/ASSET_LICENSES.md`、`docs/TRACEABILITY.md`、`README.md`。
- **测试命令与结果**：
  - `npm install` → 54 包，成功（phaser 3.90.0 / vite 7.3.7 / typescript 5.9.3 / vitest 3.2.7）。
  - `npm run build` → 成功：`dist/index.html 1.27 kB`、`index.css 22.36 kB (gzip 5.87)`、`index.js 9.85 kB (gzip 4.56)`，`✓ built in 521ms`。
  - 无头 Chrome 加载 `http://localhost:4175/SEAPP1/`：标题正确、无 console 错误、无资源 404，截图 `docs/screenshots/m0-menu.png`。
  - 生产子路径验证：`vite preview --base=/SEAPP1/` 下 JS/CSS 返回 200（此前根路径预览出现 SPA fallback，已记录为部署注意事项）。
- **已知缺陷**：
  - 主菜单「开始新战役」「继续战役」在本阶段仅为占位提示（M1/M3 接入）。
  - 依赖审计有 3 个 dev-only 漏洞（vitest 传递依赖），不影响构建产物，见 DECISIONS D-13。
- **commit**：`docs: establish requirements and project skeleton`（本地）
- **验收状态**：AI 实施完成，等待学生检查。

---

## M1｜攻城画面样板

- **时间**：2026-10-24
- **实际完成**：
  - 程序化像素美术管线：`art/pixel.ts`（逐像素绘制、描边、轮廓光、噪点）、`art/units.ts`（10 类单位 × 5 组动画帧，48×60 / 58×62 / 104×116 等多规格）、`art/tiles.ts`（8 种地形 × 4 变体 + 8 类装饰 + 地表细节）、`art/buildings.ts`（16 种建筑/塔/城墙贴图）、`art/fx.ts`（辉光、炮口焰、爆炸、尘土、光束、选中环）。
  - 160×112 大地图：外城墙 10 段、内城墙 6 段、城门 2 座、8 处人类设施、8 座防御塔、3 个前线节点、6 个建造点，道路/广场/瓦砾/血泥按函数生成。
  - 战场场景：Tilemap 地形、墙段 TileSprite、设施与亡灵建筑、光源呼吸、灰烬粒子、镜头平移/缩放/暗角后处理、单位精灵与动画同步、伤害染色、破墙碎块与震屏。
  - 开场演出：4 段分层叙事 + 主视觉缓慢推镜 + 进度条 + 可跳过。
  - 流场寻路（Dijkstra + 障碍高代价）：单位自然绕行、遇墙集火拆墙，墙倒后重算流场。
  - 视觉样板：菜单 → 开场 → 战场，自动投放 60 食尸鬼验证行军、攻城、破墙、塔防与镜头。
- **测试命令与结果**：
  - `npx tsc --noEmit` 通过。
  - 无头 Chrome（1440×900）走完 菜单→开场→战场，无 console 错误；`?nopause=1` + `advanceFor()` 快进 30/40 秒验证推进与破墙。
  - 截图：`docs/screenshots/m1-intro.png`（开场）、`docs/screenshots/m1-siege.png`（尸潮攻墙）。
  - 开发中发现并修复：单位可直接穿墙（改为墙体/建筑为实体阻挡）、南侧黑幕遮挡王座、覆盖层拦截点击、Phaser 失焦暂停导致无头截图冻结。
- **已知缺陷**：
  - 大量单位聚集时仍会重叠，视觉上略拥挤（M2 调整分离与编队）。
  - 城墙贴图与站在墙前的单位存在视觉重叠，M2 调整绘制层级。
  - 战场帧率数据来自无头软件渲染，不代表真机；M5 在真实浏览器补测。
- **commit**：`feat: build siege visual vertical slice`

---

## M2｜战斗与策略

- **时间**：2026-10-24
- **实际完成**：待填
- **测试**：待填
- **commit**：`feat: implement tactical deployment and destructible walls`

---

## M3｜多日成长与人类建设

- **时间**：2026-10-24
- **实际完成**：待填
- **测试**：待填
- **commit**：`feat: add campaign progression and economy`

---

## M4｜最终献祭与结局

- **时间**：2026-10-24
- **实际完成**：待填
- **测试**：待填
- **commit**：`feat: complete final assault and endings`

---

## M5｜测试与部署

- **时间**：2026-10-24
- **实际完成**：待填
- **测试**：待填
- **commit**：`test: verify campaign and deploy web build`
