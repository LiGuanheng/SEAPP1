import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=process.argv[2]??'http://127.0.0.1:4186/SEAPP1/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--mute-audio'],defaultViewport:{width:1600,height:1000}});
const page=await browser.newPage(),checks=[],errors=[],shots='docs/screenshots/v3.2/';mkdirSync(shots,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const check=(name,ok,evidence)=>{checks.push({name,ok,evidence});console.log(ok?'PASS':'FAIL',name,JSON.stringify(evidence??''));};
const point=(x,y)=>page.evaluate((x,y)=>window.__SIEGE__.worldToScreen(x,y),x,y);
const stock=k=>page.evaluate(k=>window.__SIEGE__.battle.loadout.inventory[k],k);
async function clickWorld(x,y){const p=await point(x,y);await page.mouse.click(p.x,p.y);}
async function setup(preset=false){
 await page.goto(url,{waitUntil:'networkidle0'});await page.click('[data-action="new"]');await page.click('[data-action="next"]');await page.click('[data-action="next"]');await page.click('[data-action="commander"][data-key="titan"]');await page.click('[data-action="next"]');
 if(preset)await page.click('[data-action="preset"][data-key="breach"]');else{
  for(let i=0;i<4;i++)await page.click('[data-action="buy-pre"][data-key="goblin"][data-count="3"]');
  for(const k of ['slime','elf','raider'])await page.click(`[data-action="buy-pre"][data-key="${k}"][data-count="3"]`);
 }
 await page.click('[data-action="launch"]');await page.click('[data-action="skip-intro"]');await page.click('[data-action="overview"]');
}
let assault;
try{
 await setup();
 check('default is exactly one batch and continuous deployment is opt-in',await page.$eval('#deploy-batch',e=>e.value==='1')&&await page.$eval('#continuous-deploy',e=>!e.checked));
 let before=await stock('goblin');await page.click('[data-action="deploy"][data-key="goblin"]');
 let p=await point(1050,3430);await page.mouse.move(p.x,p.y);await page.mouse.down();await wait(1200);await page.mouse.up();
 check('ordinary 1.2 second held press deploys only 20 goblins',before-(await stock('goblin'))===20,{before,after:await stock('goblin')});
 await page.keyboard.press('Escape');before=await stock('goblin');
 await page.keyboard.down('Shift');await page.click('[data-action="deploy"][data-key="goblin"]');await clickWorld(1080,3420);await page.keyboard.up('Shift');await page.keyboard.press('Escape');
 check('Shift on card and map cannot silently spend all inventory',before-(await stock('goblin'))===20);
 before=await stock('goblin');await page.keyboard.down('Shift');await page.click('[data-action="quick-deploy"][data-key="goblin"]');await page.keyboard.up('Shift');
 check('Shift quick deployment still respects one configured batch',before-(await stock('goblin'))===20);
 await page.select('#deploy-batch','3');before=await stock('goblin');await page.click('[data-action="quick-deploy"][data-key="goblin"]');
 check('three-batch quick button deploys exactly 60',before-(await stock('goblin'))===60);
 await page.select('#deploy-batch','1');before=await stock('goblin');
 const card=await page.$('[data-action="deploy"][data-key="goblin"]'),rect=await card.boundingBox();
 await page.setDragInterception(true);await page.mouse.dragAndDrop({x:rect.x+rect.width/2,y:rect.y+rect.height/2},await point(1100,3420),{delay:100});await page.setDragInterception(false);
 check('native drag deploys exactly one batch and keeps reserves',before-(await stock('goblin'))===20&&(await stock('goblin'))>0);
 await page.click('#continuous-deploy');await page.click('[data-action="deploy"][data-key="goblin"]');before=await stock('goblin');
 p=await point(1120,3430);await page.mouse.move(p.x,p.y);await page.mouse.down();await wait(850);await page.mouse.up();const afterHold=await stock('goblin');await wait(650);
 check('explicit long-press mode adds one batch at 600ms then stops on release',before-afterHold===40&&(await stock('goblin'))===afterHold,{before,afterHold,afterRelease:await stock('goblin')});
 await page.keyboard.press('Escape');await page.click('#continuous-deploy');await page.select('#deploy-batch','Infinity');await page.click('[data-action="quick-deploy"][data-key="goblin"]');
 check('all stock requires explicitly selecting all stock',await stock('goblin')===0);
 await page.select('#deploy-batch','1');before=await stock('slime');await page.click('[data-action="deploy"][data-key="slime"]');await clickWorld(2000,1800);await page.keyboard.press('Escape');
 check('invalid location consumes no inventory',await stock('slime')===before);
 await page.setViewport({width:1280,height:720});await wait(150);await page.screenshot({path:shots+'01-exact-batches-720p.png'});
 check('batch controls and new toggle fit 720p',await page.$eval('.resource-row',e=>[...e.children].every(c=>{const r=c.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;})));
 await page.setViewport({width:1600,height:1000});await setup(true);
 await page.click('[data-action="all-deploy"]');await clickWorld(250,1250);await page.evaluate(()=>window.__SIEGE__.battle.advance(2.5));await page.keyboard.press('a');
 // A real drawn direction deliberately misses the civilian building at 950,1110 by ~300px.
 p=await point(650,1450);await page.mouse.move(p.x,p.y);await page.mouse.down({button:'right'});
 for(const q of [[900,1450],[1200,1500]]){p=await point(...q);await page.mouse.move(p.x,p.y,{steps:8});}
 await page.screenshot({path:shots+'02-broad-assault-route.png'});await page.mouse.up({button:'right'});
 const trace=[];let sawThreat=false,sawSquad=false;
 for(let i=0;i<120;i++){
  await page.evaluate(()=>window.__SIEGE__.battle.advance(.5));
  const state=await page.evaluate(()=>{const b=window.__SIEGE__.battle,s=b.structures.find(s=>s.kind==='cityblock'&&s.x===950&&s.y===1110);return {time:b.time,civilHp:s.hp,maxHp:s.maxHp,threats:b.units.filter(u=>u.side===0&&u.hp>0&&u.threat).length,attackingCivil:b.units.filter(u=>u.side===0&&u.target===s.id).length,snapshot:b.snapshot()};});
  trace.push(state);sawThreat||=state.threats>0;sawSquad||=state.threats>1;
  if(state.civilHp<state.maxHp){await page.screenshot({path:shots+'03-autonomous-city-clearing.png'});assault=state;break;}
 }
 assault??=trace.at(-1);assault={...assault,trace};
 check('directional route autonomously damages an off-line civilian building',assault.civilHp<assault.maxHp,{time:assault.time,civilHp:assault.civilHp,maxHp:assault.maxHp});
 check('real battle attacks alert the victim and nearby squad',sawThreat&&sawSquad,{sawThreat,sawSquad});
 check('no browser errors',!errors.length,errors);
}catch(e){errors.push(String(e));console.error(e);}
finally{writeFileSync('docs/v3.2/SMART_ORDERS_BROWSER_RESULTS.json',JSON.stringify({date:new Date().toISOString(),url,checks,errors,assault,pass:checks.length===13&&checks.every(c=>c.ok)&&!errors.length},null,2));await browser.close();}
if(checks.length!==13||checks.some(c=>!c.ok)||errors.length)process.exitCode=1;
