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
- **实际完成**：待填
- **测试**：待填
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
