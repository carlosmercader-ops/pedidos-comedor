// Servicio sin datos persistentes. Los secretos se configuran en Cloudflare.
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
const concat=(...a)=>{const out=new Uint8Array(a.reduce((n,b)=>n+b.length,0));let offset=0;for(const b of a){out.set(b,offset);offset+=b.length;}return out;};
export function endpointPermitido(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)$/.test(u.hostname)||/^[a-z0-9.-]+\.notify\.windows\.com$/.test(u.hostname));}catch{return false;}}
async function hmac(key,data){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,data));}
async function expand(key,info,length){return (await hmac(key,concat(info,new Uint8Array([1])))).slice(0,length);}
export async function cifrar(subscription,payload){
 const ua=un64(subscription.keys.p256dh),auth=un64(subscription.keys.auth);if(ua.length!==65||auth.length!==16)throw Error('Claves de suscripción no válidas');
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const server=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
 const client=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const secret=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:client},pair.privateKey,256));
 const ikm=await expand(await hmac(auth,secret),concat(enc.encode('WebPush: info\0'),ua,server),32);
 const salt=crypto.getRandomValues(new Uint8Array(16)),prk=await hmac(salt,ikm);
 const key=await expand(prk,enc.encode('Content-Encoding: aes128gcm\0'),16),nonce=await expand(prk,enc.encode('Content-Encoding: nonce\0'),12);
 const aes=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},aes,concat(enc.encode(JSON.stringify(payload)),new Uint8Array([2]))));
 const header=new Uint8Array(21);header.set(salt);new DataView(header.buffer).setUint32(16,4096);header[20]=65;
 return concat(header,server,cipher);
}
async function vapid(endpoint,env){const header=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'}))),body=b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:'mailto:carlosmercader@svpaulcar.es'})));const text=header+'.'+body;const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE_JWK),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(text));return text+'.'+b64(signature);}
async function equal(a,b){const aa=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(a))),bb=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(b)));let n=0;for(let i=0;i<aa.length;i++)n|=aa[i]^bb[i];return n===0;}
export default {async fetch(request,env){
 if(request.method==='GET')return Response.json({service:'Comedor SVP · push',ok:true});
 if(request.method!=='POST'||new URL(request.url).pathname!=='/notify')return new Response('No encontrado',{status:404});
 if(!env.PUSH_SECRET||!env.VAPID_PRIVATE_JWK||!env.VAPID_PUBLIC_KEY)return new Response('Servicio sin configurar',{status:503});
 const auth=request.headers.get('Authorization')||'';if(!await equal(auth,'Bearer '+env.PUSH_SECRET))return new Response('No autorizado',{status:401});
 const text=await request.text();if(text.length>100000)return new Response('Solicitud demasiado grande',{status:413});let data;try{data=JSON.parse(text);}catch{return new Response('JSON no válido',{status:400});}
 if(!/^[0-9a-f-]{36}$/i.test(data.id||'')||!Array.isArray(data.subscriptions)||data.subscriptions.length>40)return new Response('Solicitud no válida',{status:400});
 const results=await Promise.all(data.subscriptions.map(async s=>{if(!endpointPermitido(s.endpoint))return {endpoint:s.endpoint,failed:true};try{const body=await cifrar(s,{id:data.id,additional:data.additional===true});const token=await vapid(s.endpoint,env);const res=await fetch(s.endpoint,{method:'POST',redirect:'error',headers:{TTL:'86400',Urgency:'high','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',Authorization:'vapid t='+token+', k='+env.VAPID_PUBLIC_KEY},body});return {endpoint:s.endpoint,expired:[404,410].includes(res.status),sent:res.ok,failed:!res.ok&&![404,410].includes(res.status)};}catch{return {endpoint:s.endpoint,failed:true};}}));
 return Response.json({ok:!results.some(r=>r.failed),sent:results.filter(r=>r.sent).length,expired:results.filter(r=>r.expired).map(r=>r.endpoint)});
}};
