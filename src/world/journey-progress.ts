import {clamp,storyStage} from './character-motion'
export const journeyStageLabels=['Every step together','Running into forever','Our invitation'] as const
export function journeyFeedback(progress:number){
 const p=clamp(progress,0,1),stage=storyStage(p)
 return {progress:p,percent:Math.round(p*100),stage,label:journeyStageLabels[stage]}
}
/** Native document-scroll destinations, including a way out of the sticky story. */
export function journeyAdvanceOffset(progress:number,sectionHeight:number,viewportHeight:number){
 const {stage}=journeyFeedback(progress),travel=Math.max(0,sectionHeight-viewportHeight)
 // Stop near the start of the final wave, leaving the native scroll runway
 // available for watching. Finish is always a deliberate, immediate way out.
 return stage===0?travel*.42:stage===1?travel*.64:sectionHeight
}
