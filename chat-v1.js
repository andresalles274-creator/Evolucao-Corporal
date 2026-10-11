import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {SUPABASE_URL,SUPABASE_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const escapeHTML=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let me=null,coach=false,selected=null,people=[],opened=false,busy=false;
let notificationBaseline=new Set(),notificationReady=false,unreadCount=0;
const style=document.createElement("style");style.textContent=`
#coach-chat-launch{position:relative;right:auto;top:auto;bottom:auto;z-index:1;display:block;margin:12px 16px 8px auto;border:1px solid #caff18;border-radius:50px;background:#caff18;color:#091009;font-weight:800;padding:13px 17px;box-shadow:0 8px 25px #000b;cursor:pointer}
#coach-chat-panel{position:fixed;z-index:9001;right:12px;bottom:84px;width:min(420px,calc(100vw - 24px));height:min(630px,calc(100dvh - 115px));background:#080d0a;color:#f4fff2;border:1px solid #b9ec23;border-radius:22px;box-shadow:0 18px 55px #000e;display:flex;flex-direction:column;overflow:hidden;font-family:inherit}
#coach-chat-panel[hidden],#coach-chat-launch[hidden]{display:none!important}
.chat-head{display:flex;justify-content:space-between;align-items:center;background:#111c12;padding:15px 18px;border-bottom:1px solid #354b25}.chat-head strong{color:#caff18}.chat-head button,.chat-students button{background:#1a291c;color:#fff;border:1px solid #435d31;border-radius:10px;padding:8px;cursor:pointer}
.chat-students{overflow:auto;max-height:155px;border-bottom:1px solid #34452a}.chat-students button{display:block;width:calc(100% - 20px);margin:7px 10px;text-align:left}.chat-students button.active{border-color:#caff18;color:#caff18}
.chat-messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:16px}.chat-bubble{max-width:85%;padding:11px 13px;border-radius:14px;background:#202b21;align-self:flex-start;overflow-wrap:anywhere;white-space:pre-wrap}.chat-bubble.mine{align-self:flex-end;background:#354b19}.chat-bubble small{display:block;opacity:.7;font-size:10px;margin-top:5px}.chat-compose{display:flex;gap:8px;padding:12px;border-top:1px solid #354b25}.chat-compose input{flex:1;min-width:0;background:#101b12;color:white;border:1px solid #4c603c;border-radius:12px;padding:12px}.chat-compose button{background:#caff18;color:#10160a;border:0;border-radius:12px;padding:0 15px;font-weight:800}.chat-empty{color:#abb8a8;text-align:center;margin:auto 12px}
`;document.head.append(style);
const launch=document.createElement("button");launch.id="coach-chat-launch";launch.textContent="✉ Chat";launch.hidden=false;
const panel=document.createElement("section");panel.id="coach-chat-panel";panel.hidden=true;panel.innerHTML='<div class="chat-head"><strong>Conversas · Evolução Corporal</strong><button type="button" id="chat-close">✕</button></div><div class="chat-students" id="chat-students"></div><div class="chat-messages" id="chat-messages" aria-live="polite"></div><form class="chat-compose" id="chat-form"><input id="chat-text" maxlength="4000" placeholder="Escreva sua mensagem..." required autocomplete="off"><button type="submit">Enviar</button></form>';
document.body.append(launch,panel);
const studentBox=panel.querySelector("#chat-students"),messages=panel.querySelector("#chat-messages"),input=panel.querySelector("#chat-text");
launch.onclick=()=>{opened=!opened;panel.hidden=!opened;if(opened){unreadCount=0;updateUnreadBadge();refresh()}};
panel.querySelector("#chat-close").onclick=()=>{opened=false;panel.hidden=true};
async function init(){const {data:{user}}=await db.auth.getUser();me=user?.id||null;launch.hidden=!me;addChatNavigation();if(!me){opened=false;panel.hidden=true;return}const r=await db.from("coach_users").select("user_id").eq("user_id",me).maybeSingle();coach=!!r.data;studentBox.hidden=!coach;if(!coach)selected=me;await refresh();checkNewMessages()}
async function refresh(){if(!me||!opened||busy)return;busy=true;try{
if(coach){const r=await db.from("profiles").select("user_id,full_name").order("full_name");if(r.error)throw r.error;people=(r.data||[]).filter(p=>p.user_id!==me);if(!selected||!people.some(p=>p.user_id===selected))selected=people[0]?.user_id||null;studentBox.innerHTML=people.map(p=>'<button type="button" data-id="'+escapeHTML(p.user_id)+'" class="'+(p.user_id===selected?'active':'')+'">'+escapeHTML(p.full_name||"Aluno")+'</button>').join("")||'<p class="chat-empty">Nenhum aluno encontrado</p>';studentBox.querySelectorAll("button").forEach(b=>b.onclick=()=>{selected=b.dataset.id;refresh()})}
if(!selected){messages.innerHTML='<p class="chat-empty">Selecione um aluno para conversar.</p>';return}
const r=await db.from("coach_student_messages").select("id,body,sender_id,created_at").eq("student_id",selected).order("created_at",{ascending:true}).limit(300);if(r.error)throw r.error;
const bottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<100;
messages.innerHTML=(r.data||[]).map(m=>'<div class="chat-bubble '+(m.sender_id===me?'mine':'')+'">'+escapeHTML(m.body)+'<small>'+new Date(m.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+'</small></div>').join("")||'<p class="chat-empty">Nenhuma mensagem ainda. Comece a conversa!</p>';if(bottom)messages.scrollTop=messages.scrollHeight;
}catch(e){messages.innerHTML='<p class="chat-empty">Não foi possível carregar o chat: '+escapeHTML(e.message)+'</p>'}finally{busy=false}}
panel.querySelector("#chat-form").onsubmit=async e=>{e.preventDefault();const body=input.value.trim();if(!body||!selected||!me)return;const btn=panel.querySelector(".chat-compose button");btn.disabled=true;try{const r=await db.from("coach_student_messages").insert({student_id:selected,sender_id:me,body});if(r.error)throw r.error;input.value="";await refresh()}catch(e){alert("Mensagem não enviada: "+e.message)}finally{btn.disabled=false}};
db.auth.onAuthStateChange(()=>setTimeout(init,100));init();setInterval(()=>{if(opened)refresh()},6000);

function addChatNavigation(){
 const nav=document.querySelector(".bottomnav");
 const main=document.querySelector("#content");
 if(!me||!main)return;
 const extra=nav?.querySelector('[data-chat-nav]');
 if(extra)extra.remove();
 const hero=main.querySelector('.ref-hero.ref-hero-approved')||main.querySelector('.premium-brand');
 const target=coach&&hero?hero:main;
 if(launch.parentElement!==target){if(target===main)main.prepend(launch);else target.appendChild(launch)}
 launch.classList.toggle('chat-in-hero',target!==main);
}
new MutationObserver(addChatNavigation).observe(document.getElementById("app")||document.body,{childList:true,subtree:true});
setInterval(addChatNavigation,1500);
const heroChatStyle=document.createElement('style');
heroChatStyle.textContent=`
.ref-hero.ref-hero-approved{position:relative!important}
.ref-hero.ref-hero-approved #coach-chat-launch.chat-in-hero{
 position:absolute!important;top:12px!important;right:12px!important;bottom:auto!important;left:auto!important;
 z-index:12!important;margin:0!important;padding:9px 13px!important;
 border-radius:24px!important;font-size:13px!important;line-height:1.2!important;
 box-shadow:0 4px 18px #0009!important;max-width:calc(100% - 24px)!important
}
`;
document.head.append(heroChatStyle);

const notificationStyle=document.createElement("style");
notificationStyle.textContent='#coach-chat-launch .chat-count,.chat-nav-count{display:inline-block;background:#e33;color:white;border-radius:50px;padding:2px 6px;font-size:11px;margin-left:5px}#chat-notice{position:fixed;top:75px;left:12px;right:12px;z-index:10020;background:#18291b;color:#fff;border:1px solid #caff18;padding:14px;border-radius:15px;box-shadow:0 12px 35px #0009;cursor:pointer}';
document.head.append(notificationStyle);
function updateUnreadBadge(){
 const count=unreadCount?'<span class="chat-count">'+unreadCount+'</span>':'';
 launch.innerHTML='✉ Chat'+count;
 const b=document.querySelector('[data-chat-nav]');if(b){const old=b.querySelector('.chat-nav-count');old?.remove();if(unreadCount){const span=document.createElement('span');span.className='chat-nav-count';span.textContent=unreadCount;b.append(span)}}
}
function showChatNotice(sender){
 const old=document.getElementById('chat-notice');old?.remove();
 const el=document.createElement('div');el.id='chat-notice';el.setAttribute('role','status');
 el.textContent='✉ Nova mensagem de '+sender+' · Toque para abrir';
 el.onclick=()=>{opened=true;panel.hidden=false;el.remove();refresh()};
 document.body.append(el);setTimeout(()=>el.remove(),9000);
 if(document.visibilityState==='visible'&&'Notification' in window&&Notification.permission==='granted'){
  try{new Notification('Evolução Corporal',{body:'Nova mensagem de '+sender,tag:'evolucao-chat'})}catch(_){}
 }
}
async function checkNewMessages(){
 if(!me)return;
 try{
  let q=db.from('coach_student_messages').select('id,sender_id,student_id,created_at').neq('sender_id',me).order('created_at',{ascending:false}).limit(100);
  if(!coach)q=q.eq('student_id',me);
  const {data,error}=await q;if(error)return;
  const incoming=data||[];
  if(notificationReady){
   const fresh=incoming.filter(m=>!notificationBaseline.has(m.id));
   if(fresh.length){
    unreadCount+=fresh.length;
    const sender=coach?(people.find(p=>p.user_id===fresh[0].student_id)?.full_name||'um aluno'):'seu coach';
    if(!opened)showChatNotice(sender);
   }
  }
  notificationBaseline=new Set(incoming.map(m=>m.id));
  notificationReady=true;
  if(opened){unreadCount=0}
  updateUnreadBadge();
 }catch(_){}
}
const oldChatInit=init;
db.auth.onAuthStateChange(()=>{notificationReady=false;notificationBaseline.clear();unreadCount=0});
setInterval(checkNewMessages,7000);
setTimeout(checkNewMessages,1600);
