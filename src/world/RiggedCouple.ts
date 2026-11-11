import * as T from 'three'
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {characterState,clipNames,damp,type SceneName,type ClipName,type NightMode} from './character-motion'

/** One mixer owns the paired clips: their hands and feet stay on the same clock. */
export class RiggedCouple {
 readonly root=new T.Group()
 readonly mixer:T.AnimationMixer
 readonly actions=new Map<ClipName,T.AnimationAction[]>()
 private wasStill=false
 private scene:SceneName|null=null
 private nightMode:NightMode='stargaze'
 private rate=1
 private turn=0
 private manualWaveSeconds=0
 private wasWaving=false
 private travel=0
 constructor(readonly model:T.Group,clips:T.AnimationClip[]){
  this.root.name='Luis and Bee, animated clay couple';this.root.add(model)
  this.mixer=new T.AnimationMixer(model)
  model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}})
  for(const name of clipNames){
   const matched=clips.filter(c=>c.name===name||c.name.startsWith(name+'.')||c.name.endsWith('_'+name)||c.name.endsWith('|'+name))
   const actions=matched.map(clip=>{const a=this.mixer.clipAction(clip);a.setLoop(T.LoopRepeat,Infinity);a.play();a.setEffectiveWeight(0);return a})
   this.actions.set(name,actions)
   if(!actions.length)throw new Error(`Missing skeletal animation: ${name}`)
  }
 }
 requestWave(){if(this.manualWaveSeconds>0)return;this.manualWaveSeconds=this.waveDuration;this.restart('Wave')}
 private get waveDuration(){return Math.max(...(this.actions.get('Wave')??[]).map(a=>a.getClip().duration))}
 private restart(name:ClipName){for(const a of this.actions.get(name)??[])a.time=0}
 get groundTravel(){return this.travel}
 update(kind:SceneName,progress:number,speed:number,dt:number,still:boolean,_pointer:number,_direction=1,aspect=1.6,nightMode:NightMode='stargaze'){
  const state=characterState(kind,progress,speed,still,aspect,nightMode),changed=this.scene!==kind||(kind==='night'&&this.nightMode!==nightMode)
  const elapsed=still?0:Math.min(Math.max(dt,0),.05)
  if(changed){this.scene=kind;this.nightMode=nightMode;this.turn=state.rotation;this.wasWaving=false;this.manualWaveSeconds=0;this.travel=0}
  this.root.position.set(state.x,state.y,state.z);this.root.scale.setScalar(state.scale)
  // Do not reverse the people when the user scrolls backwards. The story can rewind,
  // but a sudden 180-degree character turn breaks hand contact and feels like a teleport.
  this.turn=still||changed?state.rotation:damp(this.turn,state.rotation,5,elapsed)
  this.root.rotation.y=this.turn
  this.rate=still?0:damp(this.rate,state.rate,5,elapsed)
  // Continuous final greeting, including its gentle recovery within every loop.
  // Do not restart on tiny scroll changes or when scrolling backwards.
  const waving=kind==='walk'&&state.weights.Wave>.5
  if(waving&&!this.wasWaving&&this.manualWaveSeconds===0)this.restart('Wave')
  this.wasWaving=waving
  if(this.manualWaveSeconds>0&&!still){this.manualWaveSeconds=Math.max(0,this.manualWaveSeconds-elapsed);for(const name of clipNames)state.weights[name]=name==='Wave'?1:0}
  for(const name of clipNames)for(const action of this.actions.get(name)??[]){
   const target=state.weights[name],weight=still||changed?target:damp(action.getEffectiveWeight(),target,6,elapsed)
   action.enabled=true;action.setEffectiveWeight(weight)
   action.setEffectiveTimeScale(name==='Walk'||name==='Run'?this.rate:1)
   if(still&&(!this.wasStill||changed))action.time=name==='Sit'?0:Math.min(.5,action.getClip().duration*.15)
  }
  this.mixer.update(elapsed)
  const stride=(name:ClipName,distance:number)=>distance*(this.actions.get(name)?.[0]?.getEffectiveWeight()??0)/(this.actions.get(name)?.[0]?.getClip().duration??1)
  this.travel+=elapsed*this.rate*(stride('Walk',.52)+stride('Run',.84))
  this.wasStill=still
 }
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model)}
}
export async function loadRiggedCouple(){
 const gltf=await new GLTFLoader().loadAsync('/wedding/wedding-couple-storyboard.glb')
 return new RiggedCouple(gltf.scene,gltf.animations)
}
