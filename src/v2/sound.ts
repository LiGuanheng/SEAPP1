class Sound {
 muted=false;private ctx:AudioContext|null=null;private last=0;
 constructor(){try{this.muted=localStorage.getItem('monster-siege-v2-muted')==='true';}catch{/* Optional preference. */}}
 toggle(){this.muted=!this.muted;try{localStorage.setItem('monster-siege-v2-muted',String(this.muted));}catch{/* Optional preference. */}return this.muted;}
 play(type:string){if(this.muted)return;try{this.ctx??=new AudioContext();if(this.ctx.state==='suspended')void this.ctx.resume();const now=this.ctx.currentTime;if(now-this.last<.045)return;this.last=now;const heavy=['wall','cannon','destroy','titan'].includes(type),magic=['skill','capture','deploy','victory'].includes(type);const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=heavy?'sawtooth':magic?'sine':'triangle';o.frequency.setValueAtTime(heavy?95:magic?440:620,now);o.frequency.exponentialRampToValueAtTime(heavy?25:magic?880:270,now+.2);g.gain.setValueAtTime(heavy?.065:magic?.045:.015,now);g.gain.exponentialRampToValueAtTime(.001,now+.3);o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(now+.32);}catch{/* Sound failure must never interrupt play. */}}
}
export const sound=new Sound();
