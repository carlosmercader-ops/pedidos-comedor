// La interfaz y los datos siguen viviendo exclusivamente en Apps Script.
const SCRIPT_URL='https://script.google.com/a/macros/svpaulcar.es/s/AKfycbxm6lOf_bWTRGf_hx16lc2xtFu69KvtJKW3vJsIsKtwiASIogrtKHvqt0tYsakjg-mI/exec';
const nonce=crypto.randomUUID(),frame=document.querySelector('#app'),dialog=document.querySelector('#pushDialog'),confirm=document.querySelector('#pushConfirm'),error=document.querySelector('#pushError');
let appWindow=null,pending=null,registration=null,busy=false;
const start=new URLSearchParams(location.search).get('view')==='comedor'?'comedor':'';
const url=new URL(SCRIPT_URL);url.searchParams.set('pwaNonce',nonce);if(start)url.searchParams.set('start',start);frame.src=url.href;document.querySelector('#original').href=SCRIPT_URL;
setTimeout(()=>document.querySelector('#fallback').hidden=false,12000);
const ready= 'serviceWorker' in navigator?navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(r=>{registration=r;return navigator.serviceWorker.ready;}):Promise.reject(Error('Este navegador no admite notificaciones.'));
ready.catch(()=>{});
function bytes(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));}
function send(type,data={}){appWindow?.postMessage({source:'comedor-pwa',nonce,type,...data},'*');}
function supported(){if(!('Notification' in window)||!('PushManager' in window)||!('serviceWorker' in navigator))throw Error('Este navegador no admite avisos de la app.');const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(ios&&!matchMedia('(display-mode: standalone)').matches&&!navigator.standalone)throw Error('En iPhone/iPad, añade primero esta app a la pantalla de inicio y ábrela desde su icono.');}
window.addEventListener('message',async event=>{
 const m=event.data;if(!m||m.source!=='comedor-app'||m.nonce!==nonce||!/^https:\/\/(?:script|[a-z0-9-]+-script)\.googleusercontent\.com$/.test(event.origin))return;
 if(m.type==='ready'){appWindow=event.source;document.querySelector('#loading').hidden=true;document.querySelector('#loading').style.display='none';return;}
 if(event.source!==appWindow)return;
 if(m.type==='status'){try{supported();const r=await ready,sub=await r.pushManager.getSubscription();send('status-result',{active:!!sub,permission:Notification.permission});}catch(e){send('status-result',{active:false,message:e.message});}return;}
 if(m.type==='activate'||m.type==='deactivate'){
  if(busy||dialog.open)return;pending=m;error.textContent='';document.querySelector('#pushDescription').textContent=m.type==='activate'?'Recibirás un aviso cuando entre un pedido nuevo, también con la app cerrada. Los avisos no mostrarán nombres de alumnos.':'Dejarás de recibir avisos de Comedor en este dispositivo.';confirm.textContent=m.type==='activate'?'Activar en este dispositivo':'Desactivar en este dispositivo';confirm.disabled=false;dialog.showModal();return;
 }
 if(m.type==='saved'&&pending&&m.requestId===pending.requestId){
  if(!m.success){busy=false;confirm.disabled=false;error.textContent=m.error||'No se ha podido guardar la activación.';return;}
  if(pending.type==='deactivate'){const r=await ready;const s=await r.pushManager.getSubscription();if(s)await s.unsubscribe();}
  busy=false;dialog.close();pending=null;return;
 }
});
confirm.onclick=async()=>{if(!pending||busy)return;busy=true;confirm.disabled=true;error.textContent='';try{
 supported();let permission=Notification.permission;
 // Se solicita en el documento principal y como consecuencia directa de este clic.
 if(pending.type==='activate'&&permission==='default')permission=await Notification.requestPermission();
 if(pending.type==='activate'&&permission!=='granted')throw Error('Los avisos están bloqueados. Puedes permitirlos desde los ajustes de este sitio.');
 const r=await ready;let sub=await r.pushManager.getSubscription();if(pending.type==='activate'&&!sub)sub=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(pending.publicKey)});
 send('subscription',{requestId:pending.requestId,operation:pending.type,subscription:sub?.toJSON()||null});
 }catch(e){busy=false;confirm.disabled=false;error.textContent=e.message;}};
document.querySelector('#pushCancel').onclick=()=>{if(busy)return;dialog.close();pending=null;};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
