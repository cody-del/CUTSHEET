import {ShopError} from './shop-service.mjs';
import {ValidationError} from './calculations.mjs';

const json=(status,data,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const cookieNames={owner:'cutsheet_owner',shop:'cutsheet_shop'};
export function shopHandler(service) {
  return async request=>{
    const url=new URL(request.url),operation=url.pathname.split('/').pop();
    if(!['session','jobs','dashboard','login','logout','pair','publish','plan','pairing','revoke','timer','line','resolve'].includes(operation))return json(404,{error:'Unknown shop endpoint.'});
    const read=['session','jobs','dashboard'].includes(operation);
    if(request.method!==(read?'GET':'POST'))return json(405,{error:read?'GET required.':'POST required.'});
    if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json(403,{error:'Invalid origin.'});
    if(!read&&!request.headers.get('content-type')?.startsWith('application/json'))return json(415,{error:'Expected JSON.'});
    try{
      let data={};if(!read){
        if(Number(request.headers.get('content-length'))>512000)return json(413,{error:'Job is too large.'});
        const reader=request.body?.getReader(),chunks=[];let size=0;
        if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000){await reader.cancel();return json(413,{error:'Job is too large.'});}chunks.push(Buffer.from(value));}
        try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{return json(400,{error:'Invalid JSON.'});}
        if(!data||Array.isArray(data)||typeof data!=='object')return json(400,{error:'Expected an object.'});
      }
      const cookies=Object.fromEntries((request.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=')));
      const secure=url.protocol==='https:'?'; Secure':'';
      const setCookie=(kind,token,age)=>`${cookieNames[kind]}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
      if(operation==='logout'){
        const response=json(200,{ok:true});for(const kind of ['owner','shop'])response.headers.append('Set-Cookie',setCookie(kind,'',0));return response;
      }
      // Only trust Netlify's overwritten client-IP header in hosted functions.
      data.client=request.headers.get('x-nf-client-connection-ip')||'local';
      const result=await service.run(operation,data,{owner:cookies.cutsheet_owner,shop:cookies.cutsheet_shop});
      if(result.error)return json(result.status||400,{error:result.error});
      if(result.cookie)return json(200,{ok:true},{'Set-Cookie':setCookie(result.cookie,result.token,result.maxAge)});
      return json(200,result);
    }catch(error){
      if(error instanceof ShopError)return json(error.status,{error:error.message});
      if(error instanceof ValidationError)return json(422,{error:error.message});
      return json(503,{error:'Shop updates could not be saved. Check the connection and try again.'});
    }
  };
}
