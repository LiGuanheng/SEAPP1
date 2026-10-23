export type Army = 'slime' | 'goblin' | 'wolf' | 'lizard' | 'wyvern' | 'golem' | 'rider' | 'spider' | 'treant' | 'split';
export type Commander = 'dragon' | 'titan' | 'moon' | 'web' | 'forest' | 'emperor';
export type Specialization = 'summon' | 'evolve' | 'element';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Kind = Army | Commander | 'king' | 'soldier' | 'archer' | 'knight' | 'mage' | 'paladin' | 'captain' | 'wall' | 'gate' | 'arrow' | 'cannon' | 'antiAir' | 'holy' | 'barracks' | 'crystal';
export interface Stats { name: string; hp: number; damage: number; speed: number; range: number; period: number; size: number; sprite: number; flying?: boolean; splash?: number; wallBonus?: number; color: string }
export interface ArmyData extends Stats { batch: number; price: number; description: string; commander?: Commander }
export const ARMIES: Record<Army, ArmyData> = {
 slime:{name:'史莱姆',batch:40,price:80,hp:42,damage:3,speed:70,range:25,period:1,size:22,sprite:0,color:'#63ddb9',description:'数量牵制 · 畏惧重炮'},
 goblin:{name:'哥布林战士',batch:20,price:95,hp:105,damage:9,speed:85,range:30,period:1,size:30,sprite:1,color:'#96b276',description:'盾剑主力 · 稳健推进'},
 wolf:{name:'魔狼',batch:12,price:100,hp:72,damage:11,speed:125,range:32,period:1,size:34,sprite:2,color:'#adc5c9',description:'迅捷突击 · 猎杀射手'},
 lizard:{name:'蜥蜴射手',batch:12,price:105,hp:65,damage:9,speed:82,range:190,period:1.2,size:32,sprite:3,color:'#b7cb83',description:'远程支援 · 可对空'},
 wyvern:{name:'风暴飞龙',batch:3,price:150,hp:320,damage:25,speed:115,range:130,period:1.4,size:76,sprite:4,flying:true,splash:42,color:'#64c2ee',description:'越墙空袭 · 畏惧防空',commander:'dragon'},
 golem:{name:'岩甲巨人',batch:4,price:140,hp:550,damage:18,speed:52,range:46,period:1.6,size:64,sprite:5,wallBonus:4,color:'#d4b075',description:'城墙伤害 ×4 · 重甲',commander:'titan'},
 rider:{name:'月影狼骑',batch:8,price:125,hp:140,damage:18,speed:150,range:38,period:1.1,size:45,sprite:6,color:'#cfdaef',description:'冲锋侧翼 · 克制轻甲',commander:'moon'},
 spider:{name:'潜行毒蛛',batch:10,price:110,hp:90,damage:11,speed:110,range:38,period:1.2,size:37,sprite:7,color:'#ba88d9',description:'翻越薄弱墙 · 剧毒',commander:'web'},
 treant:{name:'树人守卫',batch:6,price:130,hp:430,damage:9,speed:48,range:50,period:1.6,size:65,sprite:8,color:'#a8c782',description:'重装护卫 · 邻近治疗',commander:'forest'},
 split:{name:'分裂史莱姆',batch:25,price:100,hp:65,damage:6,speed:76,range:27,period:1,size:28,sprite:9,color:'#80e5bd',description:'阵亡分裂一次 · 数量战',commander:'emperor'},
};
export const ARMY_KEYS = Object.keys(ARMIES) as Army[];
export const COMMANDERS: Record<Commander, {name:string; title:string; price:number; army:Army; skill:string; cooldown:number; radius:number; castRange:number; description:string; color:string; portrait:number; stats:Stats}> = {
 dragon:{name:'风暴龙王',title:'苍穹的裁决者',price:220,army:'wyvern',skill:'风暴吐息',cooldown:60,radius:270,castRange:420,description:'扇形雷霆吐息，对前方敌人造成170伤害。飞行越墙，防空塔是主要威胁。',color:'#73caed',portrait:0,stats:{...ARMIES.wyvern,name:'风暴龙王',hp:1900,damage:48,size:150,range:170,speed:92}},
 titan:{name:'岩铠巨王',title:'群山的破城锤',price:200,army:'golem',skill:'山崩破阵',cooldown:70,radius:145,castRange:300,description:'粉碎指定墙段或城门，造成750攻城伤害，震慑附近守军。',color:'#d2ac6b',portrait:1,stats:{...ARMIES.golem,name:'岩铠巨王',hp:2600,damage:38,size:124,wallBonus:4,speed:48}},
 moon:{name:'苍月狼王',title:'银月下的猎手',price:155,army:'rider',skill:'狩猎号令',cooldown:65,radius:200,castRange:450,description:'区域内高速盟军移速+35%、伤害+15%，持续9秒。',color:'#bed5f1',portrait:2,stats:{...ARMIES.rider,name:'苍月狼王',hp:1300,damage:40,size:84}},
 web:{name:'蛛影女皇',title:'夜幕的织命者',price:165,army:'spider',skill:'蛛网禁锢',cooldown:75,radius:150,castRange:430,description:'禁锢区域内地面守军5秒，为军团创造突破窗口。',color:'#c397e9',portrait:3,stats:{...ARMIES.spider,name:'蛛影女皇',hp:1250,damage:31,size:94,range:160}},
 forest:{name:'森灵女王',title:'古林的守望者',price:170,army:'treant',skill:'生命共鸣',cooldown:80,radius:170,castRange:450,description:'恢复区域盟军最大生命的20%，保存大型精锐的战力。',color:'#99c78b',portrait:4,stats:{...ARMIES.treant,name:'森灵女王',hp:1500,damage:28,size:90,range:180,speed:70}},
 emperor:{name:'史莱姆帝王',title:'千凝的统御者',price:160,army:'split',skill:'千凝之潮',cooldown:90,radius:180,castRange:430,description:'至多25只史莱姆产生弱小分身，每场限2次，受活动上限约束。',color:'#70dfbb',portrait:5,stats:{...ARMIES.split,name:'史莱姆帝王',hp:1700,damage:27,size:86,range:100}},
};
export const COMMANDER_KEYS = Object.keys(COMMANDERS) as Commander[];
export const SPECS: Record<Specialization,{name:string; title:string; description:string; skill:string; cooldown:number}> = {
 summon:{name:'召唤魔王',title:'万军自虚空而来',description:'四种通用兵价格 −15%。异界召唤：合法区域召唤30只史莱姆，每场2次。',skill:'异界召唤',cooldown:15},
 evolve:{name:'进化魔王',title:'超越血脉的极限',description:'专属兵生命和伤害 +10%。进化祝福：范围内友军伤害 +20%，持续10秒。',skill:'进化祝福',cooldown:65},
 element:{name:'元素魔王',title:'群星为我而陨落',description:'远程与法术伤害 +10%。陨星术：范围140伤害，对圣晶仅35。',skill:'陨星术',cooldown:75},
};
export const DIFFICULTIES: Record<Difficulty,{name:string; money:number; seconds:number; density:number; response:number}> = {
 easy:{name:'简单',money:3400,seconds:720,density:.75,response:18},normal:{name:'普通',money:2800,seconds:600,density:1,response:12},hard:{name:'困难',money:2500,seconds:480,density:1.2,response:8},
};
export const ENEMIES: Partial<Record<Kind,Stats>> = {
 soldier:{name:'帝国步兵',hp:145,damage:14,speed:66,range:32,period:1.2,size:32,sprite:10,color:'#cfcbad'},
 archer:{name:'城防弓手',hp:85,damage:13,speed:58,range:235,period:1.4,size:31,sprite:11,color:'#9ec5dc'},
 knight:{name:'帝国骑士',hp:390,damage:28,speed:108,range:42,period:1.4,size:49,sprite:12,color:'#dfd9bc'},
 mage:{name:'圣曜法师',hp:110,damage:24,speed:55,range:230,period:2.6,size:36,sprite:13,splash:60,color:'#8acdf6'},
 paladin:{name:'圣殿骑士',hp:620,damage:32,speed:68,range:45,period:1.5,size:42,sprite:14,color:'#f5db8a'},
 captain:{name:'圣剑骑士长',hp:2200,damage:62,speed:72,range:70,period:2,size:75,sprite:14,splash:90,color:'#ffe2a0'},
};
export const KING:Stats={name:'魔物之王',hp:1800,damage:32,speed:75,range:180,period:1.3,size:76,sprite:15,color:'#8be2c1'};
export const WORLD={width:3200,height:2400,crystal:{x:1600,y:1000},cap:300};
export const isCommander=(k:Kind):k is Commander=> k in COMMANDERS;
export const isArmy=(k:Kind):k is Army=> k in ARMIES;
