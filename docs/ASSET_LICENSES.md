# V2 资源与依赖登记

原创图片的用途与生成来源见 [V2_ASSETS.md](V2_ASSETS.md)。原始PNG位于art-source，正式WebP及尺寸/体积清单见V2_ART_MANIFEST.json。原图和发布图片都实际保存在项目内，运行时不依赖会话生成目录。

未整合第三方商业游戏图像、角色、商标或音轨。音效为Web Audio代码合成；字体使用系统字体，不加载外部字体服务。早期统帅图集heroes.png仅留作开发来源，不作为正式战斗素材。

| 代码依赖 | 许可 | 用途 |
|---|---|---|
| TypeScript | Apache-2.0 | 类型检查 |
| Puppeteer Core | Apache-2.0 | 本机浏览器验收与编码 |
| Vite | MIT | 开发与静态构建 |
| Vitest | MIT | 逻辑验证 |
| Prettier | MIT | 格式检查 |
| tsx | MIT | 策略仿真脚本 |

精确版本及其传递依赖以package-lock.json和各依赖自带许可证为准。项目不自行替第三方代码改授许可。V1资源另见archive/v1/ASSET_LICENSES.md，不进入V2正式运行包。
