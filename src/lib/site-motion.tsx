'use client'
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {useReducedMotion} from 'framer-motion'

type SiteMotion={paused:boolean;reduced:boolean;systemReduced:boolean;setReducedMotion:(value:boolean)=>void}
const MotionContext=createContext<SiteMotion|null>(null)
const motionPreferenceKey='wedding-reduced-motion'
export function useWorldMotion():SiteMotion{
 const context=useContext(MotionContext),systemReduced=!!useReducedMotion()
 // Standalone section previews still honor the operating-system setting.
 return context??{paused:false,reduced:systemReduced,systemReduced,setReducedMotion:()=>{}}
}
export function SiteMotionProvider({children}:{children:ReactNode}){
 const[paused,setPaused]=useState(false)
 const[systemReduced,setSystemReduced]=useState(false)
 useEffect(()=>{try{setPaused(window.localStorage.getItem(motionPreferenceKey)==='true')}catch{}},[])
 const reduced=paused||systemReduced
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setSystemReduced(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update)},[])
 useEffect(()=>{document.documentElement.dataset.siteMotion=reduced?'reduced':'full';return()=>{delete document.documentElement.dataset.siteMotion}},[reduced])
 const setReducedMotion=(value:boolean)=>{setPaused(value);try{window.localStorage.setItem(motionPreferenceKey,String(value))}catch{/* The setting still works when storage is unavailable. */}}
 return <MotionContext.Provider value={{paused,reduced,systemReduced,setReducedMotion}}>{children}</MotionContext.Provider>
}
