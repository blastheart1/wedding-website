import * as T from 'three'
const colorUrl='/wedding/moon-color-nasa.jpg'
const heightUrl='/wedding/moon-height-nasa.jpg'
// NASA SVS CGI Moon Kit, LROC/LOLA maps. Public-domain reuse, credited in the source notes.
export function applyLunarMaterial(moon:T.Mesh,onLoad:()=>void){
 const loader=new T.TextureLoader(),color=loader.load(colorUrl,onLoad),height=loader.load(heightUrl,onLoad)
 color.colorSpace=T.SRGBColorSpace;color.anisotropy=2;height.colorSpace=T.NoColorSpace
 const material=new T.MeshStandardMaterial({color:'#f0e5d1',map:color,bumpMap:height,bumpScale:.09,roughness:.94,metalness:0,emissive:'#161b26',emissiveIntensity:.12})
 const previous=moon.material;moon.material=material
 if(Array.isArray(previous))previous.forEach(m=>m.dispose());else previous.dispose()
 return()=>{color.dispose();height.dispose()}
}
