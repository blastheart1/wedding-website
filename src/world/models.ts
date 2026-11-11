import * as T from 'three'
import {makeNightScene} from './night-scene'
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js'
const materials=new Map<string,T.MeshStandardMaterial>()
export function mat(color:string,roughness=.85){const key=color+roughness;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness}));return materials.get(key)!}
function mesh(g:T.BufferGeometry,m:T.Material,p:T.Object3D,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
function ball(p:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const o=mesh(new T.SphereGeometry(1,20,14),m,p,x,y,z);o.scale.set(sx,sy,sz);return o}
function box(p:T.Object3D,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){return mesh(new T.BoxGeometry(w,h,d),m,p,x,y,z)}
function rod(p:T.Object3D,m:T.Material,a:T.Vector3,b:T.Vector3,r:number){const delta=b.clone().sub(a),o=mesh(new T.CapsuleGeometry(r,Math.max(0,delta.length()-2*r),4,12),m,p);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o}
export function mergeStatic(g:T.Group){g.updateMatrixWorld(true);const inv=g.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>(),old:T.Mesh[]=[];g.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!Array.isArray(o.material)){const ge=o.geometry.clone();ge.applyMatrix4(inv.clone().multiply(o.matrixWorld));if(ge.index)ge.setIndex(ge.index);for(const k of Object.keys(ge.attributes))if(!['position','normal','uv'].includes(k))ge.deleteAttribute(k);if(!ge.getAttribute('uv'))ge.setAttribute('uv',new T.BufferAttribute(new Float32Array(ge.getAttribute('position').count*2),2));if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material)!.push(ge);old.push(o)}});for(const o of old)o.removeFromParent();for(const[m,geos]of batches){const merged=mergeGeometries(geos.map(v=>v.index?v.toNonIndexed():v));if(merged)mesh(merged,m,g);geos.forEach(v=>v.dispose())}}
export type Person={root:T.Group,body:T.Group,leftArm:T.Group,rightArm:T.Group,leftHip:T.Group,rightHip:T.Group,leftKnee:T.Group,rightKnee:T.Group,skirt?:T.Mesh}
export function makePerson(bride=false):Person{
 const root=new T.Group(),body=new T.Group();root.add(body)
 const skin=mat(bride?'#d9a587':'#c99478'),hair=mat('#282124'),eyes=mat('#252530'),cloth=mat(bride?'#fff7e9':'#60798b'),shirt=mat('#fff9ec'),shoe=mat(bride?'#e4c9a7':'#35404b')
 const headY=2.12
 ball(body,skin,0,headY,0,.38,.43,.36);ball(body,skin,-.365,headY-.02,0,.07,.10,.07);ball(body,skin,.365,headY-.02,0,.07,.10,.07)
 ball(body,eyes,-.13,headY+.01,.326,.025,.035,.017);ball(body,eyes,.13,headY+.01,.326,.025,.035,.017);ball(body,skin,0,headY-.06,.365,.045,.04,.045)
 const smile=new T.QuadraticBezierCurve3(new T.Vector3(-.075,headY-.15,.335),new T.Vector3(0,headY-.19,.355),new T.Vector3(.075,headY-.15,.335));mesh(new T.TubeGeometry(smile,10,.009,5,false),mat('#8e5a53'),body)
 const cap=mesh(new T.SphereGeometry(.397,24,16,0,Math.PI*2,0,Math.PI*.52),hair,body,0,headY+.055,-.025);cap.rotation.z=bride?.08:-.14
 ball(body,hair,-.28,headY+.16,-.02,.14,.29,.29)
 if(bride){ball(body,hair,.22,headY+.22,-.25,.22);ball(body,hair,0,headY-.16,-.20,.33,.39,.22);const veilG=new T.PlaneGeometry(.88,1.28,10,16);const pa=veilG.attributes.position;for(let i=0;i<pa.count;i++){const y=pa.getY(i);pa.setZ(i,Math.cos(pa.getX(i)*17)*.035-(.64-y)*.23)}veilG.computeVertexNormals();const veil=mesh(veilG,new T.MeshStandardMaterial({color:'#fffaf0',transparent:true,opacity:.65,side:T.DoubleSide,roughness:1,depthWrite:false}),body,0,1.65,-.40);veil.rotation.x=.15;veil.castShadow=false}
 mesh(new T.LatheGeometry([new T.Vector2(.27,.82),new T.Vector2(.30,1.08),new T.Vector2(.24,1.40),new T.Vector2(.34,1.65),new T.Vector2(.29,1.76),new T.Vector2(.14,1.82)],32),cloth,body)
 let skirt:T.Mesh|undefined
 if(bride){skirt=mesh(new T.LatheGeometry([new T.Vector2(.61,.12),new T.Vector2(.67,.18),new T.Vector2(.58,.42),new T.Vector2(.43,.86),new T.Vector2(.24,1.39)],40),cloth,root);for(let i=0;i<7;i++){const a=(i/6-.5)*1.4;rod(body,mat('#f1e6d9'),new T.Vector3(Math.sin(a)*.32,1.11,Math.cos(a)*.31),new T.Vector3(Math.sin(a)*.57,.25,Math.cos(a)*.57),.012)}}else{const bib=new T.Shape();bib.moveTo(-.17,0);bib.lineTo(.17,0);bib.lineTo(0,-.45);bib.closePath();mesh(new T.ShapeGeometry(bib),shirt,body,0,1.74,.30);ball(body,mat('#334753'),-.065,1.70,.335,.07,.045,.025);ball(body,mat('#334753'),.065,1.70,.335,.07,.045,.025);for(let i=0;i<3;i++)ball(body,mat('#314451'),0,1.35-i*.13,.28,.023)}
 function arm(side:number){const g=new T.Group();g.position.set(side*.33,1.65,0);root.add(g);rod(g,bride?skin:cloth,new T.Vector3(0,0,0),new T.Vector3(side*.08,-.33,.02),.105);rod(g,skin,new T.Vector3(side*.08,-.32,.02),new T.Vector3(side*.10,-.59,.06),.078);ball(g,skin,side*.10,-.64,.06,.09,.105,.08);mergeStatic(g);return g}
 const leftArm=arm(-1),rightArm=arm(1)
 function leg(side:number){const hip=new T.Group();hip.position.set(side*.15,.93,0);root.add(hip);rod(hip,cloth,new T.Vector3(0,-.03,0),new T.Vector3(0,-.40,0),.12);const knee=new T.Group();knee.position.y=-.43;hip.add(knee);rod(knee,cloth,new T.Vector3(0,0,0),new T.Vector3(0,-.36,0),.105);ball(knee,shoe,0,-.39,.075,.12,.085,.21);mergeStatic(knee);return{hip,knee}}
 const a=leg(-1),b=leg(1);mergeStatic(body)
 return{root,body,leftArm,rightArm,leftHip:a.hip,rightHip:b.hip,leftKnee:a.knee,rightKnee:b.knee,skirt}
}
export function posePerson(p:Person,phase:number,amount:number,sitting=false){p.leftHip.rotation.x=sitting?-Math.PI/2:Math.sin(phase)*.52*amount;p.rightHip.rotation.x=sitting?-Math.PI/2:-Math.sin(phase)*.52*amount;p.leftKnee.rotation.x=sitting?Math.PI/2:Math.max(0,-Math.sin(phase))*.32*amount;p.rightKnee.rotation.x=sitting?Math.PI/2:Math.max(0,Math.sin(phase))*.32*amount;p.leftArm.rotation.x=sitting?-.35:-Math.sin(phase)*.32*amount;p.rightArm.rotation.x=sitting?-.35:Math.sin(phase)*.32*amount;p.leftArm.rotation.z=sitting?-.12:.08;p.rightArm.rotation.z=sitting?.12:-.08;p.body.rotation.z=Math.sin(phase)*.018*amount;if(p.skirt){p.skirt.scale.y=sitting?.67:1;p.skirt.position.y=sitting?.44:0;p.skirt.rotation.z=Math.sin(phase)*.025*amount}}
function archShape(w:number,h:number){const s=new T.Shape(),r=w/2;s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h-r);s.absarc(0,h-r,r,0,Math.PI,false);s.lineTo(-r,0);return s}
function arch(p:T.Object3D,x:number,y:number,z:number,w:number,h:number){mesh(new T.ExtrudeGeometry(archShape(w,h),{depth:.1,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,curveSegments:14}),mat('#323837'),p,x,y,z);const rim=new T.Shape();const r=w/2+.10;rim.moveTo(-r,0);rim.lineTo(-r,h-w/2);rim.absarc(0,h-w/2,r,Math.PI,0,true);rim.lineTo(r,0);rim.lineTo(r-.10,0);rim.lineTo(r-.10,h-w/2);rim.absarc(0,h-w/2,r-.10,0,Math.PI,false);rim.lineTo(-r+.10,0);rim.closePath();mesh(new T.ExtrudeGeometry(rim,{depth:.13,bevelEnabled:false,curveSegments:14}),mat('#bdaba1'),p,x,y,z+.03)}
function tree(parent:T.Group,x:number,z:number,scale=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);rod(g,mat('#786951'),new T.Vector3(0,0,0),new T.Vector3(.06,2.9,0),.14);for(const[vx,vy,vz,r]of [[-.45,2.5,0,.75],[.42,2.9,.2,.8],[0,3.4,-.1,.85],[.1,2.7,-.55,.7]])ball(g,mat(vx<0?'#7d946f':'#98aa85'),vx,vy,vz,r,r*1.15,r*.9);mergeStatic(g)}
export function makeChurch(withSetting=true){const root=new T.Group(),building=new T.Group();root.add(building);const stone=mat('#aaa296'),roof=mat('#986d64'),trim=mat('#c2b5a3')
 box(building,stone,0,2.1,0,8.2,4.2,3.6);box(building,stone,0,2.15,-3,5.8,4.3,4)
 const ped=new T.Shape();ped.moveTo(-4.1,0);ped.lineTo(4.1,0);ped.lineTo(0,2.5);ped.closePath();mesh(new T.ExtrudeGeometry(ped,{depth:3.6,bevelEnabled:false}),stone,building,0,4.2,-1.8)
 for(const sign of [-1,1]){const roofpiece=box(building,roof,sign*2.1,5.46,0,4.95,.18,4.2);roofpiece.rotation.z=-sign*Math.atan2(2.5,4.1)}
 box(building,trim,0,4.25,1.90,8.5,.18,.28);box(building,trim,0,.18,1.86,8.5,.32,.26)
 // Bell tower sits to the viewer's left, with an arched opening and low hip roof.
 box(building,stone,-3.05,5.15,-.92,1.8,2.75,1.8);arch(building,-3.05,4.55,.02,.88,1.43);box(building,trim,-3.05,6.55,-.92,2,.16,2)
 const towerRoof=mesh(new T.ConeGeometry(1.65,.72,4),roof,building,-3.05,6.98,-.92);towerRoof.rotation.y=Math.PI/4;box(building,trim,-3.05,7.40,-.92,.09,.44,.09)
 arch(building,0,.30,1.84,1.55,2.47);for(let i=0;i<7;i++)box(building,mat('#735342'),-.62+i*.205,1.29,1.98,.17,1.80,.06)
 for(const x of [-2.65,2.65]){arch(building,x,1.80,1.84,.72,1.43);for(const dx of [-.2,0,.2])box(building,mat('#77716b'),x+dx,2.4,1.99,.025,1.04,.04)}
 const rose=mesh(new T.CircleGeometry(.31,28),mat('#3c3d38'),building,0,5.32,1.87);const ring=mesh(new T.TorusGeometry(.35,.065,8,32),trim,building,0,5.32,1.94)
 box(building,trim,0,7.12,.03,.16,.9,.18);box(building,trim,0,7.25,.03,.64,.16,.18)
 // Low-relief masonry: deterministic, instanced blocks rather than a flat noise texture.
 const stones=new T.InstancedMesh(new T.BoxGeometry(1,1,1),stone,230);const d=new T.Object3D();let n=0;for(let row=0;row<13;row++){for(let col=0;col<18;col++){const x=-3.9+col*.46+(row%2)*.18,y=.40+row*.29;if(Math.abs(x)<.88&&y<2.8)continue;if(Math.abs(Math.abs(x)-2.65)<.45&&y>1.7&&y<3.35)continue;if(x>4)continue;d.position.set(x,y,1.825);d.scale.set(.40+(Math.sin(col*6+row)*.025),.24,.045);d.updateMatrix();stones.setMatrixAt(n,d.matrix);stones.setColorAt(n,new T.Color().setHSL(.10,.06,.53+((row*7+col*11)%9)*.015));n++}}stones.count=n;stones.receiveShadow=true;building.add(stones)
 if(withSetting){
 // Welcome path, low lawn and trees from the church reference's setting.
 box(root,mat('#d1c6b2'),0,-.16,0,13,.25,10);box(root,mat('#b4bd97'),0,-.01,-.3,12.5,.09,9.5);box(root,mat('#c9a698'),0,.045,3.45,1.9,.09,3.4);for(let i=0;i<7;i++)box(root,mat('#e3c4b6'),0,.1,2+i*.45,1.84,.025,.035)
 tree(root,-5,1,.98);tree(root,4.9,-.5,1.18);tree(root,-4.8,-3.2,1.32);tree(root,4.5,-3.5,1.05)
 }
 mergeStatic(building);mergeStatic(root);return root
}
export function makeBench(seatHeight=.50){
 const g=new T.Group(),wood=mat('#a48570'),metal=mat('#535557')
 // The compact seated rig has a floor-root, not a lifted standing pose.
 for(let i=0;i<4;i++)box(g,wood,0,seatHeight-.04,-.215+i*.09,2.40,.08,.08)
 for(let i=0;i<3;i++)box(g,wood,0,seatHeight+.24+i*.15,-.40,2.4,.11,.09)
 for(const x of [-1.03,1.03]){box(g,metal,x,seatHeight/2,0,.075,seatHeight,.075);box(g,metal,x,(seatHeight+.65)/2,-.40,.07,seatHeight+.65,.07)}
 mergeStatic(g);return g
}
export function makeWorld(){const scene=new T.Scene();const hemisphere=new T.HemisphereLight('#fff3df','#6b6970',2.6);scene.add(hemisphere);const key=new T.DirectionalLight('#ffe8cb',3.3);key.position.set(-7,12,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.normalBias=.04;scene.add(key);const fill=new T.DirectionalLight('#cbd8fb',1.0);fill.position.set(6,5,-6);scene.add(fill)
 const church=makeChurch();scene.add(church)
 const night=new T.Group(),bench=makeBench();night.add(bench);const nightCouple=new T.Group();const nBride=makePerson(true),nGroom=makePerson();nBride.root.position.x=.48;nGroom.root.position.x=-.48;nBride.root.rotation.y=Math.PI;nGroom.root.rotation.y=Math.PI;nightCouple.add(nBride.root,nGroom.root);nightCouple.position.z=.12;night.add(nightCouple);bench.rotation.y=Math.PI;posePerson(nBride,0,0,true);posePerson(nGroom,0,0,true)
 const hill=ball(night,mat('#293c48'),0,-1.03,-1,9,1.2,6);const moon=ball(night,new T.MeshBasicMaterial({color:'#fff3ce'}),3.0,7.7,-8,.52);const starPositions=[];for(let i=0;i<230;i++){const r=(Math.sin(i*127.1+31.7)*43758.5453)%1;starPositions.push(Math.sin(i*2.399)*20,3.4+Math.abs(r)*14,-7-Math.abs(Math.sin(i*11.7))*10)}const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));const stars=new T.Points(starGeo,new T.PointsMaterial({color:'#fff1d2',size:.045,sizeAttenuation:true}));night.add(stars);scene.add(night)
 const walk=new T.Group();ball(walk,mat('#e7ddce'),0,-.22,0,7,.22,3.5);const path=box(walk,mat('#d4c1b0'),0,.005,.1,12,.025,1.4);const pair=new T.Group(),bride=makePerson(true),groom=makePerson();bride.root.position.x=.48;groom.root.position.x=-.48;pair.add(bride.root,groom.root);walk.add(pair);for(const[x,z,s]of [[-4.5,-1.2,.7],[4.4,-1.3,.8]] as const)tree(walk,x,z,s);scene.add(walk)
 return{scene,church,night,walk,hemisphere,key,fill,nightCouple,nBride,nGroom,pair,bride,groom,stars,moon}
}
export function disposeWorld(scene:T.Scene){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points||o instanceof T.Line){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m))}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());materials.clear()}

export function makeEnvironmentWorld(){
 const scene=new T.Scene()
 const hemisphere=new T.HemisphereLight('#fff3df','#6b6970',2.6);scene.add(hemisphere)
 const key=new T.DirectionalLight('#ffe8cb',3.3);key.position.set(-7,12,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024)
 Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12});key.shadow.normalBias=.025;scene.add(key)
 const fill=new T.DirectionalLight('#cbd8fb',1);fill.position.set(6,5,-6);scene.add(fill)
 const church=makeChurch();scene.add(church)
 const nightScene=makeNightScene(),night=nightScene.root,stars=nightScene.stars
 const moon=ball(night,new T.MeshBasicMaterial({color:'#fff3ce'}),3,7.7,-8,.52);scene.add(night)
 const walk=new T.Group()
 // Open shadow-only ground has no horizon edge, thickness or dark underside.
 const ground=mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:'#695340',opacity:.16,depthWrite:false}),walk,0,.001,0)
 ground.name='Runtime shadow ground';ground.rotation.x=-Math.PI/2;ground.castShadow=false;ground.receiveShadow=true
 const pathGroup=new T.Group();walk.add(pathGroup)
 const steps:T.Mesh[]=[]
 // Sparse tone-on-tone ground flecks, with no bordered path or platform plane.
 // Their travel provides a subtle camera-follow reference during the Walk clip.
 for(let i=0;i<24;i++){
  const r=.025+(i%5)*.009,o=mesh(new T.CircleGeometry(r,12),new T.MeshBasicMaterial({color:'#e8ded3',transparent:true,opacity:.20,depthWrite:false}),pathGroup,Math.sin(i*2.399)*4.8,.004,0)
  o.rotation.x=-Math.PI/2;o.scale.set(1.7,.7,1);o.castShadow=false;o.receiveShadow=false;steps.push(o)
 }
 tree(walk,-4.8,-4,.72);tree(walk,5.2,-5,.85);scene.add(walk)
 // A camera-following walk: the path moves by the same gait clock as the feet.
 // Repeated joins wrap beyond the near/far composition, never at the characters.
 function setWalkTravel(distance:number,heading:number,x:number){pathGroup.position.x=x;pathGroup.rotation.y=heading;for(let i=0;i<steps.length;i++)steps[i].position.z=((i*.9-distance)%21.6+21.6)%21.6-14}
 setWalkTravel(0,0,1.8)
 return{scene,church,night,walk,hemisphere,key,fill,stars,moon,setWalkTravel,nightScene}
}
