/** Scene layout and blend targets, kept pure so geometry tests use the same camera. */
export type SceneName='night'|'church'|'walk'|'peek'
export type NightMode='stargaze'|'dance'
export type ClipName='Idle'|'Walk'|'Run'|'Wave'|'Dance'|'Sit'|'Invite'
export const clipNames:ClipName[]=['Idle','Walk','Run','Wave','Dance','Sit','Invite']
export const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v))
export const damp=(from:number,to:number,rate:number,dt:number)=>from+(to-from)*(1-Math.exp(-rate*Math.max(0,dt)))
export const smooth=(a:number,b:number,t:number)=>{const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x)}
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t
export function sceneProgress(top:number,height:number,viewport:number){return clamp((viewport-top)/(viewport+height),0,1)}
export function storyProgress(top:number,height:number,viewport:number){return clamp(-top/Math.max(1,height-viewport),0,1)}
export function boundedSpeed(delta:number,dt:number){return clamp(Math.abs(delta)/Math.max(dt,.008)/1200,0,2.2)}
export const storyBreaks=[.28,.56] as const
export function storyStage(progress:number){return progress<storyBreaks[0]?0:progress<storyBreaks[1]?1:2}
export function characterState(kind:SceneName,progress:number,speed:number,still:boolean,aspect=1.6,nightMode:NightMode='stargaze'){
 const p=still?.88:clamp(progress,0,1),s=still?0:clamp(speed,0,2.2),narrow=aspect<1.25
 const weights:Record<ClipName,number>={Idle:0,Walk:0,Run:0,Wave:0,Dance:0,Sit:0,Invite:0}
 if(kind==='night')weights[nightMode==='dance'?'Dance':'Sit']=1
 else if(still)weights[kind==='walk'?'Invite':'Idle']=1
 else if(kind==='church'||kind==='peek')weights.Idle=1
 else{
  const runIn=smooth(.22,.34,p),waveIn=smooth(.50,.60,p)
  weights.Run=runIn*(1-waveIn)
  weights.Wave=waveIn
  // The scene clock, not wheel velocity, drives the happy walk and run loops.
  weights.Walk=(1-runIn)*(1-waveIn)
 }
 return {
  weights,rate:still?0:clamp(1+s*.08,1,1.15),
  x:kind==='walk'?(narrow?0:1.8):kind==='church'?2.3:kind==='night'?nightLayout(aspect).bench.x:0,
  y:kind==='church'?.14:kind==='night'?nightLayout(aspect).pairY:0,
  z:kind==='church'?3.15:kind==='night'?.35:0,
  rotation:kind==='night'?(nightMode==='dance'?.15:nightLayout(aspect).bench.rotation):kind==='walk'?lerp(.25,0,smooth(.48,.60,p)):0,
  scale:kind==='church'?.68:kind==='night'?nightLayout(aspect).bench.scale*(nightMode==='dance'?.85:1):1
 }
}
export function shot(kind:SceneName,aspect:number,progress:number,reduced:boolean){
 const narrow=aspect<.85,p=reduced?.88:progress
 if(kind==='church')return{height:narrow?14/aspect:11.5,position:[6-12*p,7,18] as const,target:[0,2.7,0] as const}
 if(kind==='night'){const h=nightCameraHeight(aspect),y=h*.30;return{height:h,position:[0,y+3.84,39.5] as const,target:[0,y,-.5] as const}}
 if(kind==='peek')return{height:3.4,position:[0,2.2,10] as const,target:[0,1.5,0] as const}
 return {height:aspect<1.25?Math.max(9,4.6/aspect):Math.max(8.8/aspect,5.0),position:[0,3.15,10] as const,target:[0,aspect<1.25?2.4:1.65,0] as const}
}
export function nightCameraHeight(aspect:number){return Math.max(aspect<1.25?9.2:7.4,5.6/aspect)}
export function nightLayout(aspect:number){
 const height=nightCameraHeight(aspect),width=height*aspect,narrow=aspect<1.25
 const scale=narrow?.94:1.12
 const bench={x:-width*.22,z:.35,rotation:0,scale}
 // The whole section is the scene. Leave upper-left desktop sky and the top
 // 38% on portrait screens clear for the HTML heading, numerals and labels.
 const moon={x:width*.27,y:height*.30+(narrow?.02:.38)*height/2-.34+(narrow?0:.95),z:-4,scale:narrow?.82:1.05}
 // +Z is the characters' forward direction. Both the scene and the contact rig
 // turn together toward the actual moon, so the rear view is truthful at every size.
 bench.rotation=Math.atan2(moon.x-bench.x,moon.z-bench.z)
 return {bench,pairY:0,moon}
}
