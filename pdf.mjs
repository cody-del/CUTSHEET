import {drawing} from './public/layouts.js';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {calculate,combinedParts,FRAMES,VERSION,ValidationError,configuration} from './calculations.mjs';
const COLORS={W:'White',OW:'Off-white',SC:'Swiss coffee'};
const ascii=s=>String(s??'').normalize('NFKD').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—·]/g,'-').replace(/[^\x20-\x7e\n]/g,'');
export async function createPDF(job,{combined=false,units='mm'}={}){
  if(!job||!Array.isArray(job.openings)||job.openings.length<1||job.openings.length>100)throw new ValidationError('Add between 1 and 100 openings.');
  const results=job.openings.map(o=>({o,result:calculate(o)}));
  for(const {o,result}of results)if(result.warnings.length)throw new ValidationError(`${o.name}: ${result.warnings.join('; ')}`);
  const pdf=await PDFDocument.create();const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`${job.number||'Job'} - ${combined?'Combined cutting list':'Cut sheets'}`);pdf.setAuthor('Cut sheet');
  const ink=rgb(.08,.08,.08),muted=rgb(.4,.4,.4),green=rgb(.08,.08,.08),pale=rgb(.97,.97,.97),line=rgb(.8,.8,.8);
  let page,y,openingLabel='';
  function text(s,x,yy,size=10,font=regular,color=ink){page.drawText(ascii(s),{x,y:yy,size,font,color});}
  function wrap(s,width,size=9,font=regular){const lines=[];for(const paragraph of ascii(s).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){if(font.widthOfTextAtSize(word,size)>width){if(current){lines.push(current);current='';}let part='';for(const ch of word){if(font.widthOfTextAtSize(part+ch,size)>width){lines.push(part);part='';}part+=ch;}current=part;continue;}if(current&&font.widthOfTextAtSize(current+' '+word,size)>width){lines.push(current);current=word;}else current+=(current?' ':'')+word;}lines.push(current);}return lines;}
  function rect(x,yy,w,h,color){page.drawRectangle({x,y:yy,width:w,height:h,color});}
  function newPage(title){page=pdf.addPage([612,792]);rect(0,782,612,10,green);text('CUT SHEET',36,750,10,bold,green);text(title,36,719,24,bold);const headerLines=wrap(`${job.number||'Unnumbered job'}  /  ${job.customer||'Customer not entered'}`,540,9);headerLines.forEach((line,i)=>text(line,36,700-i*10,9));const headerExtra=Math.max(0,headerLines.length-1)*10;text(`PRINTED ${new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date())}`,430,750,8,regular,muted);rect(36,659-headerExtra,540,23,rgb(.94,.94,.94));text('VALIDATION DRAFT - Compare with a trusted cut sheet before cutting.',45,667-headerExtra,9,bold);y=642-headerExtra;if(openingLabel&&title.includes('continued')){for(const labelLine of wrap(openingLabel,540,10,bold)){text(labelLine,36,y,10,bold);y-=14;}y-=8;}}
  function rule(){page.drawLine({start:{x:36,y},end:{x:576,y},thickness:.6,color:line});}
  const length=n=>units==='in'?(n/25.4).toFixed(4):n.toFixed(2);
  function tableHeader(isCombined){rect(36,y-22,540,24,green);text('PART / PROFILE',45,y-14,8,bold,rgb(1,1,1));text('QTY',330,y-14,8,bold,rgb(1,1,1));text(`CUT (${units})`,390,y-14,8,bold,rgb(1,1,1));text(isCombined?'OPENINGS':'CHECK',478,y-14,8,bold,rgb(1,1,1));y-=24;}
  function partRow(part,isCombined,referenceLines=null){const sub=wrap(part.profile,267,8),refs=referenceLines??(isCombined?wrap(part.openings.map(x=>`${x.name} (${x.quantity})`).join(', '),87,7):[]);if(refs.length>18){for(let i=0;i<refs.length;i+=18)partRow({...part,name:part.name+(i?' (continued)':''),quantity:i?'':part.quantity},isCombined,refs.slice(i,i+18));return;}const height=Math.max(31,22+sub.length*8,14+refs.length*10);if(y-height<68){newPage('Cutting list / continued');tableHeader(isCombined);}if(Math.round(y)%2===0)rect(36,y-height,540,height,pale);text(part.name+(part.section?` / section ${part.section}`:''),45,y-12,10,bold);sub.forEach((s,i)=>text(s,45,y-24-i*8,8,regular,muted));text(part.quantity,335,y-16,11,bold);text(length(part.length),390,y-16,11,bold);if(isCombined)refs.forEach((s,i)=>text(s,478,y-16-i*10,7));else page.drawRectangle({x:490,y:y-21,width:11,height:11,borderWidth:.7,borderColor:line});y-=height;rule();}
  if(combined){newPage('Combined cutting list');text(`${job.openings.length} openings  |  Parts grouped by exact size, profile and finish`,36,y,9,regular,muted);y-=22;tableHeader(true);for(const part of combinedParts(job.openings))partRow({...part,profile:`${COLORS[part.color]} / ${part.profile}`},true);}
  else for(let index=0;index<results.length;index++){
    const {o,result}=results[index];openingLabel=`${String(index+1).padStart(2,'0')} ${o.name||'Untitled opening'}`;newPage('Opening cut sheet');
    const nameLines=wrap(`${String(index+1).padStart(2,'0')}  ${o.name||'Untitled opening'}`,350,16,bold);nameLines.forEach((s,i)=>text(s,36,y-i*19,16,bold));y-=nameLines.length*19+2;
    text(`${o.width}" W x ${o.height}" H   /   ${o.quantity} unit${o.quantity===1?'':'s'}${o.tposts?'':`   /   ${configuration(o)}`}`,36,y,10);y-=17;
    text(`${COLORS[o.color]}  /  ${o.louver}" louvers  /  ${o.tilt} tilt`,36,y,10);y-=17;
    text(`${FRAMES[o.frame]}  /  ${o.mount==='I'?'Inside':'Outside'} mount  /  ${o.sides}`,36,y,10);y-=17;
    text(`Input: ${o.sizeMethod==='W'?'opening measurements':o.sizeMethod==='S'?'shutter measurements':'outside frame measurements'}`,36,y,9,regular,muted);y-=24;
    const sx=459,sy=y+22,h=77,w=107,scene=drawing(o),scale=Math.min(w/scene.width,h/scene.height),dx=sx+(w-scene.width*scale)/2,dy=sy+h;
    const tone=hex=>{const v=parseInt(hex.slice(1),16);return hex.length===4?rgb(((v>>8)&15)/15,((v>>4)&15)/15,(v&15)/15):rgb((v>>16)/255,((v>>8)&255)/255,(v&255)/255);};
    for(const shape of scene.shapes){
      if(shape.kind==='line')page.drawLine({start:{x:dx+shape.a[0]*scale,y:dy-shape.a[1]*scale},end:{x:dx+shape.b[0]*scale,y:dy-shape.b[1]*scale},thickness:shape.weight*scale,color:tone(shape.tone)});
      else page.drawSvgPath(shape.points.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ')+' Z',{x:dx,y:dy,scale,color:tone(shape.fill),borderColor:tone(shape.tone),borderWidth:shape.weight});
    }
    text('SCHEMATIC ONLY',462,sy-10,7,regular,muted);
    if(o.tposts){
      for(const line of wrap(`${o.tposts.construction==='two-piece'?'Two-piece standard-frame posts':'One-piece T-posts'} / ${configuration(o)}`,540,9)){text(line,36,y,9,bold);y-=13;}
      for(const line of wrap(`Post centerlines from left (${units}): ${o.tposts.positions.map(v=>length(v*25.4)).join(' / ')}`,540,9)){text(line,36,y,9);y-=13;}
      y-=8;
    }
    tableHeader(false);for(const part of result.parts)partRow(part,false);
    const details=[`Hinges from stile end (${units}): ${result.hinges.map(length).join(' / ')}`,...result.machining.map(m=>`${m.label} (${units}): ${length(m.value)}`),...result.reviewNotes,o.notes?`Notes: ${o.notes}`:''].filter(Boolean);
    y-=18;
    for(const detail of details){for(const l of wrap(detail,540,9)){if(y<78){newPage('Machining / continued');}text(l,36,y,9);y-=13;}y-=4;}
    if(y<78)newPage('Shop sign-off');y-=10;
    for(const [i,label]of ['Cut','Machined','Assembled','Inspected'].entries()){const x=36+i*135;page.drawRectangle({x,y:y-1,width:9,height:9,borderWidth:.7,borderColor:muted});text(label,x+15,y,9);}
  }
  if(combined){
    const notes=results.flatMap(({o,result})=>[
      ...(o.tposts?[`${o.name}: ${configuration(o)}. ${o.tposts.construction} posts. Centerlines from left (${units}): ${o.tposts.positions.map(v=>length(v*25.4)).join(' / ')}.`]:[]),
      ...result.reviewNotes.map(note=>`${o.name}: ${note}`)
    ]);
    if(notes.length){y-=22;for(const note of notes){for(const line of wrap(note,540,9)){if(y<78)newPage('Fabrication notes / continued');text(line,36,y,9);y-=13;}y-=7;}}
  }
  const pages=pdf.getPages();pages.forEach((p,i)=>{page=p;page.drawLine({start:{x:36,y:46},end:{x:576,y:46},thickness:.5,color:line});text(`Validation draft / ${VERSION} / lengths ${units} / no kerf allowance`,36,31,7,regular,muted);text(`${i+1} / ${pages.length}`,542,31,8,regular,muted);});
  return pdf.save();
}
