import {journeyFeedback} from './journey-progress'
export function JourneyFeedback({progress,onAdvance}:{progress:number,onAdvance:()=>void}){
 const feedback=journeyFeedback(progress),shown=feedback.stage
 return <div className="journey-feedback">
  <div className="journey-feedback-line"><p><span className="journey-step">{String(shown+1).padStart(2,'0')} / 03</span><span className="journey-stage-label">{feedback.label}</span></p><button type="button" className="journey-continue" onClick={onAdvance} aria-label={shown===2?'Finish story and continue to the next section':`Continue to ${shown===0?'running into forever':'our invitation'}`}><span className="scroll-cue">{shown===2?'Finish story':'Scroll to continue'}</span><span className="swipe-cue">{shown===2?'Finish story':'Swipe up to continue'}</span><span aria-hidden="true"> ↓</span></button></div>
  <div className="journey-progress-track" role="progressbar" aria-label="Wedding story progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={feedback.percent} aria-valuetext={`Step ${shown+1} of 3: ${feedback.label}`}><span style={{transform:`scaleX(${feedback.progress})`}}/><i/><i/></div>
 </div>
}
