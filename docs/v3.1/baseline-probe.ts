import {Battle} from '../../src/v2/simulation';
import {preset} from '../../src/v2/economy';
import {FRONTS,type Front} from '../../src/v2/world';
import type {Difficulty} from '../../src/v2/data';
import {writeFileSync} from 'node:fs';
const results=[];
for(const [difficulty,strategy,front] of [['normal','breach','west'],['hard','breach','west'],['hard','breach','south'],['hard','sky','south'],['hard','sky','west']] as [Difficulty,'breach'|'sky',Front][]){
 const b=new Battle(preset(difficulty,'evolve',strategy),20261024),p=FRONTS[front];b.deployAll(p.x,p.y);b.charge();
 while(b.status==='battle'&&b.time<900){b.advance(.5);b.events.length=0;if(b.active===0&&b.queued===0)break;}
 const r={difficulty,strategy,front,...b.snapshot(),armyLost:b.active===0&&b.queued===0};results.push(r);console.log(JSON.stringify({difficulty,strategy,front,status:r.status,time:r.time,core:r.crystalHp,walls:r.stats.walls,armyLost:r.armyLost}));
}
writeFileSync('docs/v3.1/BASELINE_3_0.json',JSON.stringify({sourceCommit:'ba58d66 (game a64c48f)',method:'same legal preset, full army deploy and auto assault; no active skills or further purchases',results},null,2));
