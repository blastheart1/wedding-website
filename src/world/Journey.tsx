'use client'
import type {PublicConfig} from '@/lib/config'
import {useEffect,useRef,useState} from 'react'
import {AnimatePresence,motion,useMotionValueEvent,useScroll} from 'framer-motion'
import {openWeddingRsvp} from '@/lib/rsvp-dialog'
import {journeyFeedback,journeyAdvanceOffset} from './journey-progress'
import {JourneyFeedback} from './JourneyFeedback'
import {useWorldMotion} from '../lib/site-motion'
export function WeddingJourney({config}:{config:PublicConfig}){
 const ref=useRef<HTMLElement>(null),{reduced}=useWorldMotion(),[progress,setProgress]=useState(0)
 const {scrollYProgress}=useScroll({target:ref,offset:['start start','end end']})
 useMotionValueEvent(scrollYProgress,'change',p=>setProgress(p))
 const feedback=journeyFeedback(progress),stage=feedback.stage
 const advance=()=>{const el=ref.current;if(!el)return;const rect=el.getBoundingClientRect();window.scrollTo({top:window.scrollY+rect.top+journeyAdvanceOffset(scrollYProgress.get(),rect.height,window.innerHeight),behavior:reduced?'auto':'smooth'})}
 const[unavailable,setUnavailable]=useState(false)
 useEffect(()=>{const update=()=>setUnavailable(document.documentElement.classList.contains('world-unavailable')||document.documentElement.classList.contains('characters-unavailable'));update();window.addEventListener('wedding-world-unavailable',update);return()=>window.removeEventListener('wedding-world-unavailable',update)},[])
 const shown=reduced||unavailable?2:stage
 return <section ref={ref} id="journey" className={`wedding-journey${reduced?' journey-reduced':''}${unavailable?' journey-unavailable':''}`} data-scroll-story="true" aria-label="Every step together, our invitation to you">
  <div className="scene-viewport journey-stage" data-wedding-scene="walk">
   <div className="world-canvas-slot" aria-hidden="true"/>
   <div className={`journey-copy journey-copy-${shown}`}>
    <AnimatePresence mode="wait" initial={false}>
     <motion.div key={shown} initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={reduced?{}:{opacity:0,y:-8}} transition={{duration:reduced?0:.4,ease:[.22,1,.36,1]}}>
      {shown===0?<><p className="detail-kicker">All the little moments</p><h2 className="font-display">Every step,<br/><em>together.</em></h2><p className="journey-subline">From the everyday<br/>to our forever.</p></>:shown===1?<><p className="detail-kicker">One beautiful day</p><h2 className="font-display">Side by side.<br/><em>Into forever.</em></h2></>:<div className="journey-invitation"><p className="detail-kicker">{config.sectionHeadings.rsvp.eyebrow}</p><h2 className="font-display">{config.sectionHeadings.rsvp.heading}<br/><em>{config.sectionHeadings.rsvp.italic}</em></h2><p className="rsvp-lead">Please RSVP by {config.rsvpDeadline}</p><button type="button" className="rsvp-link" onClick={openWeddingRsvp}>RSVP</button></div>}
     </motion.div>
    </AnimatePresence>
   </div>
   {!reduced&&!unavailable&&<JourneyFeedback progress={progress} onAdvance={advance}/>}
  </div>
 </section>
}
