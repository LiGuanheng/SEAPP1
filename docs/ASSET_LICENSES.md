# V3 资源与依赖登记

新增原创图集：

| 文件 | 用途与来源 |
|---|---|
| art-source/v3-units.png | 内置image_gen生成，2×2掠夺者/流亡精灵静态与动作姿态，透明alpha |
| art-source/v3-city.png | 内置image_gen生成，4×2仓库/营地/矿场/运输车/骑士团/魔法学院/市集/庭院，透明alpha |
| public/art/v3-units.webp、v3-city.webp | 上述原图通过浏览器Canvas编码为WebP，用于正式游戏 |
| src/v2/app.ts、render.ts | 统一SVG法术小图标、程序化特效、真实实体与材质渲染 |

完整生成提示词见[v3/ART_PROMPTS.md](v3/ART_PROMPTS.md)。所有项目引用资源均复制到本仓库，运行不依赖会话生成目录。原有原创PNG、独立六统帅、美术生成记录和旧清单保留于art-source、V2_ASSETS及V2_ART_MANIFEST；本轮完整运行资源清单为v3/ART_MANIFEST.json。

未引入未经授权的商业游戏角色、贴图或音轨。音效是WebAudio合成；系统字体不加载外部CDN。图像生成是开发期工具，不是游戏运行依赖。未对第三方依赖重新授予许可。

| 开发依赖 | 许可 |
|---|---|
| TypeScript、Puppeteer Core | Apache-2.0 |
| Vite、Vitest、Prettier、tsx | MIT |

精确版本、传递依赖与原许可见package-lock.json和各包许可证。旧V1/V2材料按原样归档，不冒充本轮新增成果。
