# V3.2 当前测试

本轮100项模型测试，真实交互与战役/性能结果见[v3.2/REPORT.md](v3.2/REPORT.md)。增加自主清场、真实受袭和塔弹来源、队友反击/归位、精确批数及显式连投。旧路径测试曾无意依赖附近不攻击的资源和部署点不反击，现为纯路点/队列测试隔离敌军及无关建筑；完整战役保持真实地图、资金和伤害。

当前npm run test:e2e运行smart-orders-browser、smart-campaign-browser、smart-performance；npm run sim结果写v3.2，verify-release核对3.2版本与所有发布文件。旧3.1/3.0报告留存为历史，不能冒充当前结果。

---

# V3.1 测试报告

当前汇总见[v3.1/REPORT.md](v3.1/REPORT.md)，原始数据与本次截图均单独保存。

新增orders.test与原有v3.test合并回归；orders-browser验证真实选兵/绘线，tactical-browser验证掠夺/购买/前线/决战/重开，tactical-performance记录300驻留与真实战斗各10秒。浏览器战役通过按钮和鼠标执行命令，长战斗采用同一模型advance快进；不修改HP/钱包/结果。局部单元测试可隔离敌人，不能作为完整通关证据。

实际发现与修复：明确出兵模式后，浏览器脚本需先切回库存才能再下兵；Shift追加应验证剩余路线与新终点，不能假定保留已完成路点。真实回归发现高建筑图像点击范围吞掉守军，已优先检测守军身体并加用例。结算有1.6秒演出，脚本应等待结算按钮出现；战役中止、超时和阵容失败均保留，未计作通过。

```sh
npm test -- --reporter=json --outputFile=docs/v3.1/UNIT_RESULTS.json
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run test:e2e -- http://127.0.0.1:4173/SEAPP1/
npx tsx scripts/tactical-simulate.ts
npx tsx scripts/tactical-simulate.ts --sweep
npx tsx scripts/tactical-simulate.ts --sky
node scripts/verify-release.mjs https://liguanheng.github.io/SEAPP1/ EXPECTED_SHA
```

未覆盖的V3旧交互与初次验证详情仍见[v3/REPORT.md](v3/REPORT.md)及Git历史。下列保留3.0原测试报告，不能冒充本次新结果。

---

# V3 测试报告

2026-10-24。最终汇总与公开版本状态见[v3/REPORT.md](v3/REPORT.md)。原始机器数据分别保留，没有把编译成功或直接修改胜利状态冒充通关。

## 方法

模型：tests/v3.test.ts覆盖账本、快速部署、四向通路、矩形视线、有限预备队、资源、咏唱/范围伤害、魔力、六统帅/专精、胜败和固定步长。部分单元测试刻意隔离守军/设施，以只验证几何或局部机制；它们不作为完整战役胜例。

独立Chrome对生产/SEAPP1/路径运行：

- v3-input.mjs：25条真实交互断言，含长按/点放/一键/Shift、四面、原生英雄与法术拖放、魔力不足、框选/右键/编队、720p和返回菜单。
- v3-tour.mjs：11条战役与胜败断言，四条实际配兵/购买/部署/施法胜例、自然基础阵容力竭和真实超时。
- v3-performance.mjs：固定300友军驻留10秒；有真实击杀/战损的进攻10秒；记录RAF帧间隔、活动数变化、JS堆与销毁后旧模型是否停止。

浏览器战役从菜单经过整备启动；控制计划只读取模型，再通过DOM按钮和真实鼠标执行购买/部署/施法。长战斗调用同一Battle.advance进行快进，不改HP/钱包、不调用胜利函数，不冒充人类全程实时盲测。

独立固定种子预算样本由v3-simulate.ts产生，真实账本与模型机制一致，但它属于仿真，和浏览器UI验收分开报告。

## 实际发现与修复

1. 源码审查确认旧版无墙体视线、南向集中防御、单侧集结和墙角缝隙；通过闭合城池、防区/射程/遮挡及四向导航修复。
2. 首轮新版空袭仍38.58秒结束。保留BALANCE_FIRST_PASS，补足南向/核心防空齐射并降低飞行普攻对建筑系数，未提高圣晶HP。新样本详见BALANCE_RESULTS。
3. 资源建筑本体曾被视野判定当作遮挡物，直接点建筑施法不合理；改为只排除目标本体，前方其他墙仍遮挡，有回归测试。
4. 守军近距离追击曾可能超出归属警戒范围；现有明确归位限制，预备队按真实路线移动。
5. 首轮tour脚本误点结算弹层背后的同名菜单按钮，在两条战役后超时；修复为明确选择结算层按钮。TOUR_FIRST_PASS保留实际中断及未执行部分，未计为整体通过。
6. 首轮性能脚本在军队尚未与守军交火时采样“进攻”，且在菜单点击前过早记录旧模拟时间；这些结果不作为最终战斗性能或泄漏结论。修复为预热到真实战损/击杀，并在离开战场后记录退休时间。
7. 缩远全选时大量满血条遮住军团，侧向镜头出现大块界外空白；修复健康条显示条件与镜头边界。随后真实交互回归通过。
8. 城墙和小地图每帧重复绘制成本较高；加入按破坏阶段缓存的城墙图像、小地图底图缓存，保持旗帜/HP和深度顺序动态，保存缓存前后实测。

## 数据与复现

```sh
npm test -- --reporter=json --outputFile=docs/v3/UNIT_RESULTS.json
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run test:e2e -- http://127.0.0.1:4173/SEAPP1/
npm run sim
node scripts/verify-release.mjs https://liguanheng.github.io/SEAPP1/ EXPECTED_SHA
```

UNIT_RESULTS、INPUT_RESULTS、TOUR_RESULTS、PERFORMANCE_RESULTS、BALANCE_RESULTS和RELEASE_RESULTS位于docs/v3。截图在screenshots/v3。性能JSON中的JS heap不含图像、离屏Canvas、GPU和进程总内存。数据来自本机HeadlessChrome，其他设备未覆盖；没有使用统计总体胜率。
