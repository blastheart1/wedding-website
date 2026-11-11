import * as T from 'three'

/** A stylized night study, not a measured reconstruction or an astronomical map. */
export type NightMode='stargaze'|'dance'
export const NIGHT_COLOR='#101b2c'
const fract=(x:number)=>x-Math.floor(x)
const seed=(n:number)=>fract(Math.sin(n*127.1+31.7)*43758.5453)
/** The original shallow hill becomes a paved terrace, with a level contact area.
 * Only its distant shoulder curves down. Bench legs, feet and the gown stay on
 * the same floor in both modes; the far silhouette comes from real geometry. */
export function nightGroundHeight(x:number,z:number,aspect:number,height:number){
 const depth=Math.max(0,-z-1.5),t=Math.min(1,depth/2),shoulder=t*t*(3-2*t)
 const across=x/(height*aspect*.5)
 return -.018-depth*depth*.012-height*.025*across*across*shoulder
}
/** One quiet meteor approximately every 19 seconds; no timer advances while paused. */
export function meteorPhase(seconds:number){
 const cycle=Math.floor(seconds/19),elapsed=seconds-cycle*19-6
 return {cycle,progress:Math.max(0,Math.min(1,elapsed/1.35)),visible:elapsed>=0&&elapsed<=1.35,opacity:elapsed>=0&&elapsed<=1.35?Math.sin(elapsed/1.35*Math.PI)*.65:0}
}
function pavingTexture(){
 const size=128,data=new Uint8Array(size*size*4)
 // Terracotta rectangular pavers with staggered joints, as in the reference forecourt.
 // Brick variation is seeded, so frames and screenshots do not flicker.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const row=Math.floor(y/16),offset=(row%2)*16,bx=(x+offset)%32,by=y%16,id=row*4+Math.floor((x+offset)/32)
  const joint=bx<1.5||by<1.5||bx>30.8||by>14.8,grain=(seed(y*size+x)-.5)*5,v=(seed(id+121)-.5)*22
  const rgb=joint?[55,49,48]:[128+v+grain,87+v*.65+grain,74+v*.5+grain]
  const i=(y*size+x)*4;data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=255
 }
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(8,4.5);texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true
 return texture
}
export function makeNightScene(){
 const root=new T.Group();root.name='Together under the stars'
 const texture=pavingTexture(),pavingMaterial=new T.MeshStandardMaterial({map:texture,color:'#c4ad9f',roughness:1,emissive:'#55403a',emissiveIntensity:.12})
 // A subdivided continuous surface restores the previous hill's shallow arc.
 // It extends beyond the bottom camera ray, without a wall, rim or dark underside.
 // Opaque depth is intentional: the curved shoulder occludes its own far slope.
 const geometry=new T.PlaneGeometry(32,72,96,144)
 geometry.rotateX(-Math.PI/2);geometry.translate(0,0,25.5)
 const paving=new T.Mesh(geometry,pavingMaterial)
 paving.name='Curved terracotta brick ground';paving.receiveShadow=true;root.add(paving)
 function shapeGround(aspect:number,height:number){
  const width=Math.max(32,height*aspect*1.5),positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv')
  for(let i=0;i<positions.count;i++){
   const x=(uv.getX(i)-.5)*width,z=(.5-uv.getY(i))*72+25.5
   positions.setXYZ(i,x,nightGroundHeight(x,z,aspect,height),z)
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere()
  texture.repeat.x=width/4
 }
 shapeGround(1.65,7.4)
 const starsGeometry=new T.BufferGeometry(),starPositions=[],starColors=[]
 for(let i=0;i<440;i++){starPositions.push(seed(i+9)-.5,seed(i+522)-.5,-.4-seed(i+941)*.5);const c=new T.Color().setHSL(.09+seed(i)*.08,.12,.50+seed(i+331)*.4);starColors.push(c.r,c.g,c.b)}
 starsGeometry.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));starsGeometry.setAttribute('color',new T.Float32BufferAttribute(starColors,3))
 const starMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{pointSize:{value:3.4},portrait:{value:0}},vertexShader:'varying vec3 vColor; varying vec2 vScreen; uniform float pointSize; void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);vScreen=gl_Position.xy/gl_Position.w;gl_PointSize=pointSize;}',fragmentShader:'varying vec3 vColor; varying vec2 vScreen; uniform float portrait; void main(){float r=length(gl_PointCoord-.5)*2.;float quiet=portrait>.5?smoothstep(.17,.32,vScreen.y):(1.-smoothstep(.15,.35,vScreen.x))*smoothstep(-.06,.14,vScreen.y);gl_FragColor=vec4(vColor,pow(max(0.,1.-r),1.35)*(.95-quiet*.68));}'})
 const stars=new T.Points(starsGeometry,starMaterial);stars.name='Restrained star field';stars.frustumCulled=false;root.add(stars)
 const milkyWayMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{portrait:{value:0}},vertexShader:'varying vec2 vUv; varying vec2 vScreen; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);vScreen=gl_Position.xy/gl_Position.w;}',fragmentShader:`varying vec2 vUv; varying vec2 vScreen; uniform float portrait;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  void main(){vec2 p=vUv;float spine=.08+p.x*.92+.025*sin(p.x*9.);float d=abs(p.y-spine);float haze=exp(-d*d*82.);float clouds=noise(p*12.)*.55+noise(p*31.)*.3+noise(p*80.)*.15;float dust=1.-exp(-pow((p.y-spine+.014*sin(p.x*32.))*32.,2.))*.45;float quiet=portrait>.5?smoothstep(.17,.32,vScreen.y):(1.-smoothstep(.15,.35,vScreen.x))*smoothstep(-.06,.14,vScreen.y);float alpha=haze*(.035+.22*clouds)*dust*(1.-quiet*.85);gl_FragColor=vec4(vec3(.62,.65,.76),alpha);}`})
 const milkyWay=new T.Mesh(new T.PlaneGeometry(1,1),milkyWayMaterial);milkyWay.name='Faint Milky Way';milkyWay.renderOrder=-2;root.add(milkyWay)
 const meteorGeometry=new T.BufferGeometry();meteorGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(18),3));meteorGeometry.setAttribute('color',new T.Float32BufferAttribute([.03,.03,.04,.15,.16,.19,.28,.30,.34,.48,.50,.53,.7,.72,.74,1,.96,.85],3))
 const meteorMaterial=new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending})
 const meteor=new T.Line(meteorGeometry,meteorMaterial);meteor.name='Occasional shooting star';meteor.frustumCulled=false;meteor.visible=false;root.add(meteor)
 let time=0,lastAspect=0,lastHeight=0
 function update(aspect:number,height:number,dt:number,still:boolean,reduced=false){
  const width=height*aspect
  if(aspect!==lastAspect||height!==lastHeight){
   shapeGround(aspect,height)
   stars.position.set(0,height*.57,-15);stars.scale.set(width*1.5,height*1.25,1);milkyWay.position.set(0,height*.30-1.488,-16);milkyWay.scale.set(width*1.1,height*1.05,1);starMaterial.uniforms.portrait.value=aspect<1.25?1:0;milkyWayMaterial.uniforms.portrait.value=aspect<1.25?1:0
   lastAspect=aspect;lastHeight=height
  }
  if(!still)time+=Math.min(Math.max(0,dt),.05)
  const phase=meteorPhase(time);meteor.visible=phase.visible&&!reduced;meteorMaterial.opacity=phase.opacity
  if(meteor.visible){
   // Camera looks slightly down. Compensate for the distant sky plane so
   // portrait streaks stay below the reserved top 38% countdown-copy area.
   const startX=width*(.43-seed(phase.cycle+98)*.035),startY=height*(aspect<1.25?.39:.67)-1.2
   const positions=meteorGeometry.getAttribute('position') as T.BufferAttribute
   for(let i=0;i<6;i++){const t=phase.progress-(5-i)*.035;positions.setXYZ(i,startX-t*width*.12,startY-t*height*.10,-13)}
   positions.needsUpdate=true
  }
 }
 return {root,stars,paving,milkyWay,meteor,update,dispose:()=>texture.dispose()}
}
