export async function onRequest({request,env}){
 if(!env.BACKEND)return Response.json({error:'Cloudflare Worker 服務尚未綁定。'},{status:503,headers:{'Cache-Control':'no-store'}});
 // A service binding, not a public Worker URL. Access JWT validation stays in the Worker.
 return env.BACKEND.fetch(request);
}
