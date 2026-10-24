# V3 需求追溯与验收矩阵

2026-10-24。V2旧矩阵原样归档archive/v2，旧测试未冒充V3测试。模型测试为tests/v3.test.ts，真实结果位于v3目录；浏览器操作脚本从当前生产构建启动。

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
