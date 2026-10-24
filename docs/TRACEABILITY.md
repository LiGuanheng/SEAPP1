# V4.0 需求追溯与验收矩阵

2026-10-24。当前增量与回归见本页V4表及v4.0/REPORT。以下V3、V3.1、V3.2表保留历史证据；V2旧矩阵原样归档archive/v2。当前模型测试包含tests/legion.test.ts及原100项回归，真实浏览器结果单独保存v4.0；浏览器脚本从实际生产构建启动。

| 需求 | 实现 | 实际验证/证据 |
|---|---|---|
| V3-FR01 | app / economy | TOUR_RESULTS：三难度完整菜单配兵、胜利、重试、失败重配 |
| V3-FR02 | world / data | UNIT_RESULTS：核心几何中心与5600HP；01/04全景截图 |
| V3-FR03 | world / app / navigation | 四向模型穿三环路径；INPUT_RESULTS四面真实部署；普通西/北路线胜例 |
| V3-FR04 | world / navigation | 四角闭合、完整墙阻挡、破门后连通；真实巨王Q与内城/核心截图 |
| V3-FR05 | simulation / navigation | 双向隔墙攻击、精灵隔墙、陨星遮挡、矩形表面射程；核心首次受击坐标/破墙数 |
| V3-FR06 | updateTowers | 初始四区不受内城/核心火力；TOUR记录inner/core实际开火次数 |
| V3-FR07 | createDefenders / directReserves | 单个佯攻不调队、初始实体数量守恒、100秒不产生新敌人；真实增援事件 |
| V3-FR08 | data / hit / cast | 精灵前摇及簇伤害、掠夺者真实击毁奖励、六统帅与三个F技能回归 |
| V3-FR09 | economy / damage | 预算守恒、重复购买/奖励、真实战中扣款；四向资源分布 |
| V3-FR10 | capture / canDeploy | 连通与争夺判定，TOUR实际占领后购买并在前线快速部署 |
| V3-FR11 | deployment / app | INPUT：默认3批、真实长按、多次点放、集结点快捷/Shift全部；单位库存守恒 |
| V3-FR12 | deployment / native drag | 输入释放停止、原生英雄拖放、非法点击；模型暂停/禁用/耗尽停止、300队列守恒 |
| V3-FR13 | command / app / renderer | 真实鼠标框选、编队保存/调用、右键移动、可见炮塔集火、720p布局 |
| V3-FR14 | spellInfo / castSpell / zones | 四法术消耗/CD/渐疗/护盾/加速/延迟遮挡；浏览器Z/X/C与原生陨星拖放、魔力不足提示 |
| V3-FR15 | checkResult | 真实圣晶战斗胜利、保留库存的真实超时、1722单位纯基础阵容自然力竭、失败重配 |
| V3-FR16 | simulate / browser tour | 简单西线、普通西/北、困难西线真实胜例；纯史莱姆正门真实败例 |
| NFR性能/销毁 | fixed step / renderer caches | PERFORMANCE_RESULTS：1920×1080、300驻留、真实进攻两段10秒RAF采样及退休模拟停止 |
| NFR发布 | build-manifest / Actions | RELEASE_RESULTS：公开URL、源SHA、全部文件SHA-256、实际购买整备/四向按钮/部署 |

验收通过仅指记录所覆盖的明确操作与样本，不代表统计胜率、所有硬件或真人主观乐趣；最终数量和环境见v3/REPORT。

## V3.1 当前验收

| 需求 | 实现 | 证据 |
|---|---|---|
| V31-FR01 | spawn/charge/halt | orders.test待命/后续部署；ORDERS_BROWSER实际停留 |
| V31-FR02 | app字段模式、selectKind/friendlyAt | 底栏同类卡、S/A、720p，TACTICAL_BROWSER编队/框选 |
| V31-FR03 | orders/followRoute/progressRoute/chooseTarget | 路点、交战恢复/不远追、追加保留终点；浏览器绘线、追加、真实到达 |
| V31-FR04 | towerRange/towerCovers/nav/directReserves/captain | 范围边界、无刷兵侧援、护盾/震荡单元；核心战斗截图 |
| V31-FR05 | reward/preset/capture/buy | 一次性奖励/合法预算模型；真实掠夺购兵/前线继续投放 |
| V31-FR06 | tactical-simulate/tactical-browser | 两种普通阵容胜例、困难直推/掠夺比较；真实通关/超时/重开 |
| 性能与发布回归 | tactical-performance/verify-release | 当前报告与生产19文件指纹；旧3.0记录不冒充3.1 |

## V3.2 历史增量证据

| 需求 | 代码 | 当前实测 |
|---|---|---|
| V32-FR01 | chooseTarget/progressRoute | smart-assault侧向城区/资源、终点处理；SMART_ORDERS_BROWSER真实未指定民居攻击 |
| V32-FR02 | damage/projectiles/threatTarget/move | 实际箭手/塔弹触发、邻队支援、反击归位、路线/集火恢复及局部边界 |
| V32-FR03 | DeploymentStream/app | 实际长按1.2秒只下20、3批60、原生拖放20、Shift不全下、勾选连下/松开停止 |
| V32-FR04 | smart-*.mjs | v3.2独立JSON、截图、生产战役/性能与公开发布哈希核验 |

## V4 最新增量

| 需求 | 实现 | 证据 |
|---|---|---|
| V4-F01 | spawn/admit/legion/update/chooseLegionTarget | UNIT_RESULTS默认自动；ORDERS_BROWSER无命令部署即前进与资源收入 |
| V4-F02 | 角色目标、可达组件、airUnsafe、精灵/树人 | 资源、巨人破墙与已有缺口、狼/精灵/树人/飞行风险用例及真实战役 |
| V4-F03 | issueLegion/commands/安全模式导航 | 四按钮/全军/所选UI；四向48狼实汇合，零破墙；总攻与完整通关 |
| V4-F04 | control/manual ownership | 手动路线跨全军命令不变、模式切换/显式交回/所选只改所选 |
| V4-F05 | committedBreaches/保留资源目标/walkIndex | 首轮37/48失败→修复48/48；已开缺口替换无关墙 |
| V4-F06 | 经济/技能独立接口 | 零自动施法/无自动扣款/有限批数/300队列；性能期间skills/spells=0 |
| V4-F07 | 每秒规划/局部索引/共享连通和路径 | 连续召唤不重启全图规划用例；300扫荡/掠夺/总攻真实采样 |
| V4-F08 | legion-* scripts / verify-release | v4.0独立原始结果与截图，旧3.x只作历史 |
