# 构建与GitHub Pages部署

## 本机

要求Node.js 22+、npm。首次检出：

```sh
npm ci
npm run typecheck
npm run format:check
npm run test
npm run build
```

开发：`npm run dev`，默认根路径。生产验证：`npm run preview -- --host 127.0.0.1 --port 4173`，访问 `http://127.0.0.1:4173/SEAPP1/`。Vite的build和preview均明确使用 `/SEAPP1/`，避免JS资源误返回HTML。

Windows执行npm ci之前先停止本项目的dev/preview服务，否则正在运行的esbuild.exe可能被系统锁定。发生锁定时停止服务再重试，不需要删除仓库外文件。

## 浏览器与仿真

安装Chrome或Edge后，在预览服务运行时执行：

```sh
npm run test:e2e -- http://127.0.0.1:4173/SEAPP1/
npm run sim
```

浏览器脚本接受 `CHROME_PATH` 指向实际Chrome/Edge程序；默认检测Windows常见路径。它们生成真实截图和JSON，长战斗通过同一仿真快进。脚本不自动下载浏览器。另可逐一运行scripts/v2-browser、v2-input、v2-tour、v2-performance、v2-acceptance.mjs。

`npm run assets:pack`从art-source原始PNG重新编码公开WebP，需要本机Chrome。正式构建直接使用已经提交的WebP，不依赖重新生成美术。

## Pages

仓库：`https://github.com/LiGuanheng/SEAPP1`。

公开目标：`https://liguanheng.github.io/SEAPP1/`。

`.github/workflows/deploy.yml`在main的运行代码、配置、测试或发布资源变更后执行干净安装、单元测试、格式检查、生产构建，再上传dist并通过GitHub Pages Action发布。docs、art-source、README的单独变更不重新部署相同游戏，也可手动workflow_dispatch。

最终验收核对Actions的head_sha与success，再用实际Chrome访问公开URL、操作游戏并比较JS/CSS构建指纹。具体发布提交、Actions链接与公开试玩结果以V2_REPORT及V2_RELEASE_RESULTS为准，不能仅凭git push成功推断上线。
