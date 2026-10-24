# V3.1 部署与复现

[公开游戏](https://liguanheng.github.io/SEAPP1/)｜[源码](https://github.com/LiGuanheng/SEAPP1)｜最新发布的精确提交与核验见v3.1/REPORT和v3.1/RELEASE_RESULTS.json。

```sh
npm ci
npm run test
npm run format:check
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

本地生产预览为http://127.0.0.1:4173/SEAPP1/，开发npm run dev为根路径。浏览器验收：`npm run test:e2e -- http://127.0.0.1:4173/SEAPP1/`；策略样本：`npm run sim`。Chrome/Edge路径可通过CHROME_PATH覆盖。

GitHub Actions对main正常推送运行干净安装、67项模型测试、格式检查、类型与构建，然后上传并发布GitHub Pages。不强推、不重写历史。docs/**、art-source/**及README.md属于文档/源素材更新，不重复发布相同游戏代码；因此最终文档提交可以晚于已核验的游戏构建源SHA。

正式构建生成build-manifest.json，记录版本3、源SHA、dirtyWorkingTree和每个静态文件的SHA-256。线上验收命令：

```sh
node scripts/verify-release.mjs https://liguanheng.github.io/SEAPP1/ EXPECTED_GAME_COMMIT
```

脚本真实打开公开URL、加载远端清单、逐文件核验、通过菜单进入战场并一键出兵，保存RELEASE_RESULTS和20-live-pages.png。只有实际success及核验通过才记录发布成功。

Windows若npm ci遇esbuild.exe占用，先停止本项目自己启动的开发/预览服务；不要删除仓库外文件或结束无关进程。Node 22+，静态站点无需服务端或任何大模型密钥。
