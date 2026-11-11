'use client'
import {useEffect,useRef,type ReactNode} from 'react'
import {SiteMotionProvider,useWorldMotion} from '../lib/site-motion'
export {useWorldMotion} from '../lib/site-motion'
import * as T from 'three'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import {makeEnvironmentWorld,makeBench,disposeWorld} from './models'
import {loadRiggedCouple,type RiggedCouple} from './RiggedCouple'
import {applyLunarMaterial} from './lunar-material'
import type {NightMode} from './night-scene'
import {boundedSpeed,sceneProgress,shot,clamp,storyProgress,nightLayout,type SceneName} from './character-motion'
export {boundedSpeed,sceneProgress,shot} from './character-motion'

export default function WorldEngine(){
 const {paused,reduced}=useWorldMotion()
 const pausedRef=useRef(paused),reducedRef=useRef(reduced)
 pausedRef.current=paused;reducedRef.current=reduced
 useEffect(()=>{
  let renderer:T.WebGLRenderer
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'})}
  catch{document.documentElement.classList.add('world-unavailable');window.dispatchEvent(new Event('wedding-world-unavailable'));return}
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.AgXToneMapping;renderer.toneMappingExposure=1.05
  // Reading back each shader's compile log makes the browser wait for the compile to finish.
  // That check is for development; in production it only costs time.
  renderer.debug.checkShaderErrors=process.env.NODE_ENV!=='production'
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.info.autoReset=false
  renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.className='world-canvas';renderer.domElement.tabIndex=-1
  const world=makeEnvironmentWorld(),bench=makeBench();world.night.add(bench)
  const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.04);studio.dispose();pmrem.dispose();world.scene.environment=environment.texture
  world.moon.name='NASA Lunar Moon';world.moon.geometry.dispose();world.moon.geometry=new T.SphereGeometry(.86,64,48)
  const moonLight=new T.DirectionalLight('#fff1d5',3.2);moonLight.position.set(10,10,2);moonLight.layers.set(1);world.moon.layers.set(1);world.scene.add(moonLight)
  const camera=new T.OrthographicCamera(-8,8,5,-5,.1,100);moonLight.target=world.moon
  const slots=[...document.querySelectorAll<HTMLElement>('[data-wedding-scene]')]
  const retainedFrames=new Map<HTMLElement,HTMLCanvasElement>()
  function drawWorld(){
   renderer.info.reset();camera.layers.set(0);renderer.autoClear=true;renderer.render(world.scene,camera)
   if(world.night.visible){const background=world.scene.background;world.scene.background=null;renderer.autoClear=false;camera.layers.set(1);renderer.render(world.scene,camera);camera.layers.set(0);renderer.autoClear=true;world.scene.background=background}
  }
  function retainLastFrame(el:HTMLElement){
   if(!couple||!lastWidth||!lastHeight)return
   // Re-render immediately before the copy: preserveDrawingBuffer stays disabled.
   // Only one WebGL context runs. A departing section keeps its last real 3D frame
   // rather than going blank while a neighboring section is still entering.
   drawWorld()
   let frame=retainedFrames.get(el)
   if(!frame){frame=document.createElement('canvas');frame.className='world-last-frame';frame.setAttribute('aria-hidden','true');el.querySelector('.world-canvas-slot')?.prepend(frame);retainedFrames.set(el,frame)}
   frame.width=Math.round(lastWidth);frame.height=Math.round(lastHeight)
   frame.getContext('2d')?.drawImage(renderer.domElement,0,0,frame.width,frame.height)
  }
  // One set of colours and fog, reused every frame instead of being rebuilt 60 times a second.
  const backgrounds={night:new T.Color('#101b2c'),church:new T.Color('#f5e9df'),walk:new T.Color('#f7eee4')}
  const nightFog=new T.Fog('#101b2c',52.6,92.6),dayFog=new T.Fog('#f5e9df',25,65)
  /** Shows the right part of the world and its lighting for one kind of scene. */
  function applyKind(kind:SceneName){
   world.church.visible=kind==='church';world.night.visible=kind==='night';world.walk.visible=kind==='walk'
   const color=kind==='night'?'#101b2c':kind==='church'?'#f5e9df':'#f7eee4'
   world.scene.background=kind==='peek'?null:kind==='night'?backgrounds.night:kind==='church'?backgrounds.church:backgrounds.walk;renderer.setClearColor(color,kind==='peek'?0:1)
   // The night orthographic camera retreats along its original sight line so
   // its near plane never cuts the foreground. Shift fog by the same distance.
   world.scene.fog=kind==='peek'?null:kind==='night'?nightFog:dayFog
   world.scene.environmentIntensity=kind==='night'?.18:.55;world.hemisphere.intensity=kind==='night'?.85:1.55;world.key.intensity=kind==='night'?1.2:2.1;world.key.color.set(kind==='night'?'#c6d5ff':'#ffe8cb');world.fill.intensity=kind==='night'?.65:1
  }
  /**
   * Prepares every scene on the page before the guest scrolls to it: compiles
   * the shaders, uploads the textures and draws one small hidden frame of each.
   * Without this the first sight of a scene stalls the scroll for a moment.
   */
  function warmUp(){
   if(failed||disposed)return
   try{
    renderer.setPixelRatio(1);renderer.setSize(96,96,false)
    for(const kind of new Set(slots.map(el=>el.dataset.weddingScene as SceneName))){
     applyKind(kind)
     const view=shot(kind,1,.5,reducedRef.current)
     camera.left=-view.height/2;camera.right=view.height/2;camera.top=view.height/2;camera.bottom=-view.height/2
     camera.position.set(view.position[0],view.position[1],view.position[2]);camera.lookAt(view.target[0],view.target[1],view.target[2]);camera.updateProjectionMatrix()
     // Pose the scene the way a real frame would, so the same shader variants get built.
     if(kind==='night')world.nightScene.update(1,view.height,0,true,reducedRef.current)
     couple?.update(kind,.5,0,0,reducedRef.current,0,1,1,'stargaze')
     renderer.compile(world.scene,camera)
     world.scene.traverseVisible(object=>{
      const material=(object as T.Mesh).material
      for(const item of Array.isArray(material)?material:material?[material]:[])for(const value of Object.values(item))if(value instanceof T.Texture&&value.image)renderer.initTexture(value)
     })
     drawWorld()
    }
   }catch(error){console.warn('Wedding scenes could not be prepared ahead of time',error)}
   // The next real frame sets its own size again.
   lastWidth=0;lastHeight=0;dirty=true
   document.documentElement.dataset.worldReady='true';window.dispatchEvent(new Event('wedding-world-ready'))
  }
  const releaseMoon=applyLunarMaterial(world.moon,()=>{if(couple)warmUp();dirty=true;start()})
  let couple:RiggedCouple|null=null,disposed=false,active:HTMLElement|null=null,lastRender=0
  let previousY=window.scrollY,previousScroll=performance.now(),speed=0,pointer=0,direction=1,dirty=true,running=false,failed=false,lastWidth=0,lastHeight=0
  function measure(){
   dirty=true;const now=performance.now(),dt=(now-previousScroll)/1000
   if(Math.abs(window.scrollY-previousY)>1)direction=Math.sign(window.scrollY-previousY)
   speed=Math.max(speed,boundedSpeed(window.scrollY-previousY,dt));previousY=window.scrollY;previousScroll=now;start()
  }
  function choose(){
   let best:HTMLElement|null=null,max=0
   for(const el of slots){const r=el.getBoundingClientRect(),visible=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));if(visible>max&&r.width>0){max=visible;best=el}}
   if(max<30)best=null
   if(active!==best){if(active)retainLastFrame(active);active?.removeAttribute('data-world-active');active=best;if(active){active.querySelector('.world-canvas-slot')?.append(renderer.domElement);active.setAttribute('data-world-active','true')}else renderer.domElement.remove();dirty=true}
   return active
  }
  function render(now:number){
   if(failed||document.hidden){stop();return}
   const el=choose();if(!el){stop();return}
   // Delta comes from the last rendered frame, not an extra throttled RAF callback.
   if(now-lastRender<1000/60-1&&!dirty)return
   const dt=lastRender?Math.min((now-lastRender)/1000,.05):1/60;lastRender=now
   const rect=el.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height)
   const kind=el.dataset.weddingScene as SceneName,nightMode:NightMode=el.dataset.nightMode==='dance'?'dance':'stargaze',still=pausedRef.current||reducedRef.current,aspect=width/height,progress=el.closest('[data-scroll-story]')?(()=>{const outer=el.closest('[data-scroll-story]')!.getBoundingClientRect();return storyProgress(outer.top,outer.height,innerHeight)})():sceneProgress(rect.top,height,innerHeight)
   if(width!==lastWidth||height!==lastHeight){renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<600?1.25:1.5));renderer.setSize(width,height,false);lastWidth=width;lastHeight=height;dirty=true}
   const view=shot(kind,aspect,progress,reducedRef.current)
   camera.left=-view.height*aspect/2;camera.right=view.height*aspect/2;camera.top=view.height/2;camera.bottom=-view.height/2
   camera.position.set(view.position[0],view.position[1],view.position[2]);camera.lookAt(view.target[0],view.target[1],view.target[2]);camera.updateProjectionMatrix()
   applyKind(kind)
   if(pausedRef.current)speed=0;else if(now-previousScroll>80)speed*=Math.exp(-dt*4)
   if(kind==='night'){world.nightScene.update(aspect,view.height,dt,still,reducedRef.current);bench.visible=nightMode==='stargaze';const n=nightLayout(aspect);bench.position.set(n.bench.x,0,n.bench.z);bench.rotation.y=n.bench.rotation;bench.scale.setScalar(n.bench.scale);world.moon.position.set(n.moon.x,n.moon.y,n.moon.z);world.moon.scale.setScalar(n.moon.scale);world.moon.rotation.y=.4}
   // Pause preserves the current clip frame; reduced motion uses a deliberate static pose.
   couple?.update(kind,progress,clamp(speed,0,2.2),pausedRef.current&&!reducedRef.current?0:dt,reducedRef.current,pointer,direction,aspect,nightMode)
   if(couple&&kind==='walk')world.setWalkTravel(couple.groundTravel,couple.root.rotation.y,couple.root.position.x)
   drawWorld()
   el.dataset.characterReady=String(!!couple);el.dataset.renderTriangles=String(renderer.info.render.triangles)
   dirty=false;if(still)stop()
  }
  function start(){if(!running&&!failed&&!disposed&&!document.hidden){running=true;lastRender=0;renderer.setAnimationLoop(render)}}
  function stop(){renderer.setAnimationLoop(null);running=false}
  loadRiggedCouple().then(loaded=>{
   if(disposed){loaded.dispose();const temporary=new T.Scene();temporary.add(loaded.root);disposeWorld(temporary);return}
   couple=loaded;world.scene.add(loaded.root);warmUp();dirty=true;start()
  }).catch(error=>{document.documentElement.classList.add('characters-unavailable');window.dispatchEvent(new Event('wedding-world-unavailable'));console.warn('Wedding characters could not load',error)})
  const lost=(e:Event)=>{e.preventDefault();failed=true;stop();active?.removeAttribute('data-world-active');renderer.domElement.remove();document.documentElement.classList.add('world-unavailable');window.dispatchEvent(new Event('wedding-world-unavailable'))}
  const visibility=()=>{if(document.hidden)stop();else{dirty=true;start()}}
  const control=()=>{dirty=true;start()}
  const wave=()=>{if(!pausedRef.current&&!reducedRef.current){couple?.requestWave();dirty=true;start()}}
  const pointerMove=(e:PointerEvent)=>{if(e.pointerType==='mouse')pointer=clamp(e.clientX/innerWidth*2-1,-1,1)}
  renderer.domElement.addEventListener('webglcontextlost',lost)
  window.addEventListener('scroll',measure,{passive:true});window.addEventListener('resize',measure)
  window.addEventListener('wedding-couple-wave',wave);window.addEventListener('pointermove',pointerMove,{passive:true});window.addEventListener('wedding-world-control',control)
  document.addEventListener('visibilitychange',visibility)
  const observer=new IntersectionObserver(()=>{dirty=true;start()},{rootMargin:'150px'});slots.forEach(el=>observer.observe(el))
  const resize=new ResizeObserver(measure);slots.forEach(el=>resize.observe(el));start()
  return()=>{
   disposed=true;stop();observer.disconnect();resize.disconnect()
   window.removeEventListener('scroll',measure);window.removeEventListener('resize',measure);window.removeEventListener('pointermove',pointerMove)
   window.removeEventListener('wedding-couple-wave',wave);window.removeEventListener('wedding-world-control',control);document.removeEventListener('visibilitychange',visibility)
   renderer.domElement.removeEventListener('webglcontextlost',lost);slots.forEach(el=>el.removeAttribute('data-world-active'))
   renderer.domElement.remove();retainedFrames.forEach(frame=>frame.remove());couple?.dispose();releaseMoon();world.nightScene.dispose();environment.dispose();disposeWorld(world.scene);renderer.dispose()
  }
 },[])
 useEffect(()=>{window.dispatchEvent(new Event('wedding-world-control'))},[paused,reduced]);return null
}
