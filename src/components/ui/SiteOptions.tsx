import {churchImages} from '@/church-assets'
import {useWorldMotion} from '@/lib/site-motion'

/** A keyboard shortcut keeps the global setting reachable before the hero. */
export function SiteOptionsShortcut(){
  return <a className="skip-link" href="#site-options" onClick={event=>{
    const options=document.getElementById('site-options') as HTMLDetailsElement|null
    if(!options)return
    event.preventDefault()
    options.open=true
    options.querySelector('summary')?.focus({preventScroll:true})
    options.scrollIntoView({behavior:'instant' as ScrollBehavior,block:'center'})
  }}>Motion and site options</a>
}

export function SiteOptions(){
  const {reduced,systemReduced,setReducedMotion}=useWorldMotion()
  return <details id="site-options" className="site-options">
    <summary>Site options</summary>
    <div className="site-options-panel">
      <label className="site-motion-option">
        <input type="checkbox" checked={reduced} disabled={systemReduced} onChange={event=>setReducedMotion(event.target.checked)} aria-describedby="site-motion-description"/>
        <span>Reduce motion</span>
      </label>
      <p id="site-motion-description">{systemReduced?'Your device’s reduced-motion setting is on.':'Stops the background video and animated scenes. You can still open photos and videos.'}</p>
      <details className="asset-licenses">
        <summary>Asset licenses</summary>
        <p>Shoe upper and sole adapted from <a href="https://studio.blender.org/characters/snow/v4/" target="_blank" rel="noopener noreferrer">Snow</a> by Blender Foundation | studio.blender.org, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Shoe parts resized, simplified and recolored; ornaments omitted. No endorsement implied.</p>
        <p>Church photographs:</p>
        <ul>{churchImages.map(photo=><li key={photo.source}><a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.label}</a> by {photo.author}. <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a>. Resized; displayed with a responsive crop. Image adaptations retain the source license.</li>)}</ul>
        <p>Moon color and elevation maps: <a href="https://svs.gsfc.nasa.gov/4720" target="_blank" rel="noopener noreferrer">NASA Scientific Visualization Studio, CGI Moon Kit</a>. Stylized rendering; no NASA endorsement.</p>
      </details>
    </div>
  </details>
}
