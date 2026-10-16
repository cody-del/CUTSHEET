// Shared presentation helpers. Quantities and elapsed time are authoritative on the server.
export function elapsed(job, now=Date.now()) {
  return (job.elapsedMs||0)+(job.startedAt?Math.max(0,now-job.startedAt):0);
}
export function progress(job) {
  const lines=job.openings.flatMap(o=>o.lines),total=lines.reduce((n,l)=>n+l.quantity,0);
  const done=lines.reduce((n,l)=>n+l.completed,0);
  return {total,done,percent:total?(done===total?100:Math.min(99,Math.round(done/total*100))):0,lines:lines.length,
    cutLines:lines.filter(l=>l.completed===l.quantity).length,
    complete:total>0&&done===total,
    alerts:lines.filter(l=>l.shortage&&l.shortage.status!=='resolved')};
}
export function schedule(job,now=Date.now()) {
  const p=progress(job),minutes=elapsed(job,now)/60000;
  if(p.alerts.length)return {label:'Needs material',tone:'attention'};
  if(p.complete)return {label:job.targetMinutes&&minutes>job.targetMinutes?'Complete · over estimate':'Fully cut',tone:'complete'};
  // A date-only deadline stays on schedule through the end of that shop day.
  const today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
  if(job.due&&job.due<today)return {label:'Past target date',tone:'attention'};
  if(job.targetMinutes&&minutes>job.targetMinutes)return {label:'Over estimate',tone:'attention'};
  if(!job.targetMinutes)return {label:'No time estimate',tone:'quiet'};
  if(!minutes)return {label:'Ready to cut',tone:'quiet'};
  return {label:'Within estimate',tone:'normal'};
}
export function duration(ms) {
  if(ms<60000)return `${Math.floor(Math.max(0,ms)/1000)}s`;
  const minutes=Math.floor(Math.max(0,ms)/60000),hours=Math.floor(minutes/60);
  return hours?`${hours}h ${minutes%60}m`:`${minutes}m`;
}
