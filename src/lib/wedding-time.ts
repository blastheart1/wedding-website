import type {CountdownValues} from '@/types'
// The ceremony venue is in Antipolo, Philippines. A guest's browser timezone
// must not change the wedding instant. Philippine Standard Time is UTC+08:00.
export const weddingTimeZone='Asia/Manila'
export function weddingInstant(date:string,time:string):number|null{
 const d=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date),t=/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(time.trim())
 if(!d||!t)return null
 const year=Number(d[1]),month=Number(d[2]),day=Number(d[3]),minute=Number(t[2]),period=t[3]?.toUpperCase();let hour=Number(t[1])
 const check=new Date(Date.UTC(year,month-1,day))
 if(month<1||month>12||check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day||minute>59||hour>(period?12:23)||hour<(period?1:0))return null
 if(period){hour%=12;if(period==='PM')hour+=12}
 return Date.UTC(year,month-1,day,hour-8,minute)
}
export function weddingTimeLeft(date:string,time:string,now=Date.now()):CountdownValues{
 const target=weddingInstant(date,time),diff=target===null?0:Math.max(target-now,0)
 return{days:Math.floor(diff/86400000),hours:Math.floor(diff%86400000/3600000),minutes:Math.floor(diff%3600000/60000),seconds:Math.floor(diff%60000/1000)}
}
