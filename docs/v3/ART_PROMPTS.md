# V3 原创美术提示词与落盘

使用内置image_gen工具，未使用CLI/API密钥后备模式。2026-10-24。最终源PNG已复制到项目art-source，正式WebP在public/art，保留透明alpha。图集只是运行资源；screenshots/v3是独立Chrome真实游戏截图。

## art-source/v3-units.png

Use case: stylized-concept. Asset type: transparent production sprite atlas for a dark epic 2D fantasy RTS. Create ONE square 2 by 2 equal cell sprite sheet, actual transparent background, no text/no borders, consistent 3/4 top-down camera and hand-painted detailed fantasy style. Top-left: full-body lean green goblin RAIDER in dark leather hood, short curved dagger, backpack overflowing blue magic crystals, no shield. Top-right: SAME goblin in running pose with raised dagger. Bottom-left: full-body elegant adult EXILED ELF battle mage, long pale hair, pointed ears, dark teal and burgundy robes with golden trim, tall staff, vivid orange flame held above hand, serious noble face. Bottom-right: SAME elf in active casting pose, staff and orange flame stretched forward. Every entire figure isolated within their own cell, feet bottom of cell, generous padding and similar height, no shared shadows or other art. Fine painterly texture, readable silhouettes at 48px, mature atmosphere, original designs, no borrowed IP. Transparent background.

## art-source/v3-city.png

Use case: stylized-concept. Asset: original fantasy RTS building atlas, transparent background. ONE wide 4 columns x 2 rows equal cell atlas, eight detailed isolated buildings, entire silhouettes fit each cell with 12% empty margins, no labels/grid/borders/text, 3/4 top-down camera identical for all, mature hand-painted blue-and-gold limestone imperial architecture matching epic high fantasy. TOP ROW left to right: 1 imperial magic crystal warehouse with iron banded timber, blue tile roof, stacked glowing cyan crystal crates; 2 field supply camp with blue-white canvas pavilions and wooden provisions racks; 3 rocky magic crystal mine entrance with luminous cyan ore, wooden crane and ore cart; 4 covered imperial supply wagon with blue fabric roof and gold eagle crest, crates. BOTTOM ROW left to right: 5 immense knight chapterhouse with blue slate twin towers and stone courtyard; 6 elegant royal magic college with slender blue domes and blue magical orrery; 7 crowded medieval civic market hall and canvas stalls attached; 8 ornate multi-roof mansion and small lush garden on raised stone terrace. Nuanced realistic stone/wood/copper, warm sunlight from upper left, no ground rectangle/background scenery, no IP copying. Production game sprites, transparent alpha.

## 编码与整合

新兵图集按2×2采样，资源/市政图集按4×2采样。未整合参考游戏角色。PNG作为可审计源，WebP按0.92质量编码；pack-art.mjs记录每项尺寸与体积。SVG小图标沿用原UI代码体系，不使用生成图替代代码图标。
