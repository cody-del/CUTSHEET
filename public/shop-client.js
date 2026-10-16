export async function shopRequest(action,data) {
  let response;
  try{response=await fetch('/api/shop/'+action,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(20000)});}
  catch{throw new Error('Could not confirm the update. Reconnect and refresh to check the saved progress before trying again.');}
  const result=await response.json();if(!response.ok){const error=new Error(result.error||'Could not connect to the shop.');error.status=response.status;throw error;}return result;
}
