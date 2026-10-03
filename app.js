
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const APP_VERSION="10.3";
const PHOTO_BUCKET="evolution-photos";
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v="")=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const today=()=>{const d=new Date(),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const fmt=d=>d?new Date(String(d).length===10?d+"T12:00:00":d).toLocaleDateString("pt-BR"):"—";
const n=v=>Number(v||0);

let session=null,user=null,profile=null,isCoach=false,route="home",accountInactive=false;
let selectedTrainingDayId=null;
let selectedStudentId=null,selectedStudentProfile=null;
let loadErrors={};
let data={measurements:[],meals:[],workouts:[],hormone_logs:[],students:[],skinfolds:[],progress_photos:[],
  exercise_library:[],training_plans:[],training_days:[],training_day_exercises:[],training_sessions:[],training_set_logs:[],diet_plans:[],diet_plan_meals:[]};

let photoDraft={
  front:null,
  side:null,
  back:null,
  photo_date:"",
  notes:""
};
function clearPhotoDraftType(type){
  const d=photoDraft[type];
  if(d?.url)try{URL.revokeObjectURL(d.url)}catch(_){}
  photoDraft[type]=null;
}
function clearPhotoDraft(){
  ["front","side","back"].forEach(clearPhotoDraftType);
  photoDraft.photo_date="";
  photoDraft.notes="";
}

const recordSchemas={
 measurements:[
  ["assessment_date","Data","date"],["weight","Peso","kg"],["waist","Cintura","cm"],
  ["hip","Quadril","cm"],["glute","Glúteo","cm"],["chest","Peitoral","cm"],
  ["arm_right","Braço direito","cm"],["arm_left","Braço esquerdo","cm"],
  ["forearm_right","Antebraço direito","cm"],["forearm_left","Antebraço esquerdo","cm"],
  ["thigh_right","Coxa direita","cm"],["thigh_left","Coxa esquerda","cm"],
  ["calf_right","Panturrilha direita","cm"],["calf_left","Panturrilha esquerda","cm"]
 ],
 meals:[
  ["meal_date","Data","date"],["meal_type","Refeição",""],["description","Descrição",""],
  ["calories","Calorias","kcal"],["protein","Proteína","g"],["carbs","Carboidratos","g"],["fat","Gorduras","g"]
 ],
 workouts:[
  ["workout_date","Data","date"],["workout_type","Tipo",""],["duration_minutes","Duração","min"],
  ["muscle_group","Grupo muscular",""],["intensity","Intensidade",""],
  ["calories","Calorias gastas","kcal"],["notes","Anotações",""]
 ],
 hormone_logs:[
  ["start_date","Data de início","date"],["hormone_name","Nome conforme prescrição",""],
  ["amount","Quantidade",""],["unit","Unidade",""],["frequency","Frequência",""],
  ["period","Dia/período",""],["notes","Observações",""]
 ],
 skinfolds:[
  ["assessment_date","Data","date"],["protocol","Protocolo",""],
  ["triceps","Tríceps","mm"],["subscapular","Subescapular","mm"],["chest","Peitoral","mm"],
  ["midaxillary","Axilar média","mm"],["suprailiac","Suprailíaca","mm"],
  ["abdominal","Abdominal","mm"],["thigh","Coxa","mm"]
 ]
};


if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});


function fatalScreen(message){
 const root=document.querySelector("#app");
 if(!root)return;
 root.innerHTML=`<section class="auth"><div class="authbox" style="text-align:center">
 <img src="./logo-brand.jpg" class="auth-logo" alt="Logo Evolução Corporal">
 <div class="eyebrow">Evolução Corporal · v${APP_VERSION}</div>
 <h1>Não foi possível iniciar</h1>
 <p class="sub">${esc(message||"Erro inesperado ao carregar o aplicativo.")}</p>
 <button class="btn btn-primary btn-full" onclick="location.reload()">Tentar novamente</button>
 </div></section>`;
}
window.addEventListener("error",e=>fatalScreen(e.message||"Erro de carregamento"));
window.addEventListener("unhandledrejection",e=>fatalScreen(e.reason?.message||String(e.reason||"Erro de conexão")));

function toast(msg,err=false){
 const x=document.createElement("div");
 x.textContent=msg;
 x.style.cssText=`position:fixed;z-index:9999;left:50%;bottom:95px;transform:translateX(-50%);max-width:88%;padding:12px 16px;border-radius:14px;color:white;font-weight:700;background:${err?"#b84040":"#087c69"};box-shadow:0 8px 25px #0004`;
 document.body.appendChild(x);setTimeout(()=>x.remove(),3000);
}
function loading(){return `<section class="auth"><div class="authbox" style="text-align:center"><h2>Carregando...</h2><p class="sub">Conectando ao banco de dados.</p></div></section>`}

async function init(){
 try{
 $("#app").innerHTML=loading();
 ({data:{session}}=await supabase.auth.getSession()); user=session?.user||null;
 if(user) await hydrate();
 supabase.auth.onAuthStateChange(async(ev,s)=>{
   session=s;user=s?.user||null;

   // Ao voltar da câmera/galeria o Supabase pode renovar o token.
   // Não redesenhar a página nesses eventos, pois isso apagava
   // as fotos ainda não enviadas do formulário.
   if(ev==="TOKEN_REFRESHED" || ev==="INITIAL_SESSION") return;

   if(!user){
     profile=null;isCoach=false;accountInactive=false;
     selectedStudentId=null;selectedStudentProfile=null;
     data={measurements:[],meals:[],workouts:[],hormone_logs:[],students:[],skinfolds:[],progress_photos:[],exercise_library:[],training_plans:[],training_days:[],training_day_exercises:[],training_sessions:[],training_set_logs:[],diet_plans:[],diet_plan_meals:[]};
     clearPhotoDraft();
     render();
     return;
   }

   await hydrate();
   render();
 });
 render();
 }catch(err){console.error(err);fatalScreen(err?.message||String(err));}
}
async function hydrate(){
 loadErrors={};
 const [p,c]=await Promise.all([
  supabase.from("profiles").select("*").eq("user_id",user.id).maybeSingle(),
  supabase.from("coach_users").select("user_id").eq("user_id",user.id).maybeSingle()
 ]);
 profile=p.data||{user_id:user.id,full_name:user.user_metadata?.full_name||user.email.split("@")[0],goal:user.user_metadata?.goal||"",age:"",height_cm:""};
 isCoach=!!c.data;
 accountInactive=!isCoach && profile?.is_active===false;
 if(accountInactive){selectedStudentId=null;selectedStudentProfile=null;return;}

 if(isCoach){
   const r=await supabase.from("profiles").select("*").order("full_name");
   if(r.error) loadErrors.students=r.error.message;
   data.students=(r.data||[]).filter(x=>x.user_id!==user.id && x.is_active!==false);

   const saved=sessionStorage.getItem("evolucao_selected_student");
   selectedStudentId=(saved&&data.students.some(s=>s.user_id===saved))?saved:(data.students[0]?.user_id||null);
   selectedStudentProfile=data.students.find(s=>s.user_id===selectedStudentId)||null;
   await loadStudentData();
   if(!selectedStudentId){ await loadTrainingData(user.id); await loadDietData(user.id); }
 }else{
   selectedStudentId=null; selectedStudentProfile=null;
   await Promise.all(["measurements","meals","workouts","hormone_logs","skinfolds"].map(t=>loadTable(t,user.id)));
   await loadPhotos(user.id);
   await loadTrainingData(user.id);
   await loadDietData(user.id);
 }
}
async function loadTable(table,targetId){
 const col={measurements:"assessment_date",meals:"meal_date",workouts:"workout_date",hormone_logs:"start_date",skinfolds:"assessment_date"}[table];
 const r=await supabase.from(table).select("*").eq("user_id",targetId).order(col,{ascending:false});
 if(r.error){
   loadErrors[table]=r.error.message;
   data[table]=[];
 }else{
   delete loadErrors[table];
   data[table]=r.data||[];
 }
}
async function loadStudentData(){
 if(!isCoach||!selectedStudentId){
   ["measurements","meals","workouts","hormone_logs","skinfolds","progress_photos"].forEach(t=>data[t]=[]);
   return;
 }
 await Promise.all(["measurements","meals","workouts","hormone_logs","skinfolds"].map(t=>loadTable(t,selectedStudentId)));
 await loadPhotos(selectedStudentId);
 await loadTrainingData(selectedStudentId);
 await loadDietData(selectedStudentId);
}


async function loadTrainingData(targetId){
  if(!targetId){
    ["training_plans","training_days","training_day_exercises","training_sessions","training_set_logs"].forEach(k=>data[k]=[]);
    return;
  }
  const lib=await supabase.from("exercise_library").select("*").order("name");
  if(lib.error){loadErrors.exercise_library=lib.error.message;data.exercise_library=[];}
  else {delete loadErrors.exercise_library;data.exercise_library=(lib.data||[]).filter(x=>x.is_active!==false);}

  const plans=await supabase.from("training_plans").select("*").eq("user_id",targetId).order("created_at",{ascending:false});
  if(plans.error){loadErrors.training_plans=plans.error.message;data.training_plans=[];}
  else {delete loadErrors.training_plans;data.training_plans=plans.data||[];}

  const planIds=data.training_plans.map(x=>x.id);
  if(planIds.length){
    const days=await supabase.from("training_days").select("*").in("plan_id",planIds).order("position").order("created_at");
    if(days.error){loadErrors.training_days=days.error.message;data.training_days=[];} else {delete loadErrors.training_days;data.training_days=days.data||[];}
  }else data.training_days=[];

  const dayIds=data.training_days.map(x=>x.id);
  if(dayIds.length){
    const ex=await supabase.from("training_day_exercises").select("*").in("training_day_id",dayIds).order("position").order("created_at");
    if(ex.error){loadErrors.training_day_exercises=ex.error.message;data.training_day_exercises=[];} else {delete loadErrors.training_day_exercises;data.training_day_exercises=ex.data||[];}
  }else data.training_day_exercises=[];

  const sessions=await supabase.from("training_sessions").select("*").eq("user_id",targetId).order("started_at",{ascending:false}).limit(100);
  if(sessions.error){loadErrors.training_sessions=sessions.error.message;data.training_sessions=[];} else {delete loadErrors.training_sessions;data.training_sessions=sessions.data||[];}
  const sessionIds=data.training_sessions.map(x=>x.id);
  if(sessionIds.length){
    const logs=await supabase.from("training_set_logs").select("*").in("session_id",sessionIds).order("set_number");
    if(logs.error){loadErrors.training_set_logs=logs.error.message;data.training_set_logs=[];} else {delete loadErrors.training_set_logs;data.training_set_logs=logs.data||[];}
  }else data.training_set_logs=[];
}

async function loadDietData(targetId){
 if(!targetId){data.diet_plans=[];data.diet_plan_meals=[];return;}
 const plans=await supabase.from("diet_plans").select("*").eq("user_id",targetId).order("created_at",{ascending:false});
 if(plans.error){loadErrors.diet_plans=plans.error.message;data.diet_plans=[];data.diet_plan_meals=[];return;}
 delete loadErrors.diet_plans; data.diet_plans=plans.data||[];
 const ids=data.diet_plans.map(x=>x.id);
 if(!ids.length){data.diet_plan_meals=[];return;}
 const meals=await supabase.from("diet_plan_meals").select("*").in("plan_id",ids).order("position");
 if(meals.error){loadErrors.diet_plan_meals=meals.error.message;data.diet_plan_meals=[];} else {delete loadErrors.diet_plan_meals;data.diet_plan_meals=meals.data||[];}
}

async function loadPhotos(targetId){
 const r=await supabase.from("progress_photos").select("*").eq("user_id",targetId)
   .order("photo_date",{ascending:false}).order("created_at",{ascending:false});
 if(r.error){
   loadErrors.progress_photos=r.error.message;
   data.progress_photos=[];
   return;
 }
 delete loadErrors.progress_photos;
 const rows=r.data||[];
 data.progress_photos=await Promise.all(rows.map(async row=>{
   const s=await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path,3600);
   return {...row,signed_url:s.data?.signedUrl||""};
 }));
}
function photoTargetId(){
 return isCoach?selectedStudentId:user.id;
}
function photoTypeLabel(type){
 return ({front:"Frente",side:"Lado",back:"Costas"})[type]||type;
}
function photoSetupWarning(){
 const msg=loadErrors.progress_photos||"";
 if(!msg)return "";
 const setup=/progress_photos|relation|does not exist|bucket|storage/i.test(msg);
 return `<div class="notice error-notice"><strong>Fotos ainda não estão configuradas.</strong><br><span class="small">${setup?"Execute o arquivo ATUALIZAR_V7_FOTOS.sql uma única vez no SQL Editor do Supabase.":esc(msg)}</span></div>`;
}
async function compressPhoto(file){
 if(!file)return null;
 if(file.size>25*1024*1024)throw new Error("A foto é muito grande. Use uma imagem de até 25 MB.");
 let bitmap=null;
 try{
   if("createImageBitmap" in window){
     bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});
   }
 }catch(_){}
 if(!bitmap){
   const url=URL.createObjectURL(file);
   const img=await new Promise((resolve,reject)=>{
     const x=new Image();
     x.onload=()=>resolve(x);
     x.onerror=()=>reject(new Error("Não foi possível ler a imagem."));
     x.src=url;
   });
   URL.revokeObjectURL(url);
   bitmap=img;
 }
 const maxW=1600,maxH=2200;
 const scale=Math.min(1,maxW/bitmap.width,maxH/bitmap.height);
 const w=Math.max(1,Math.round(bitmap.width*scale));
 const h=Math.max(1,Math.round(bitmap.height*scale));
 const cv=document.createElement("canvas");cv.width=w;cv.height=h;
 const ctx=cv.getContext("2d");
 ctx.drawImage(bitmap,0,0,w,h);
 if(bitmap.close)bitmap.close();
 return await new Promise((resolve,reject)=>cv.toBlob(b=>b?resolve(b):reject(new Error("Não foi possível preparar a foto.")),"image/jpeg",0.84));
}

function savedPhotoFor(type,date){
 return data.progress_photos.find(p=>p.photo_type===type&&p.photo_date===date)||null;
}

async function saveProgressPhotoRow(targetId,photoDate,type,path,notes){
  // Histórico fotográfico: uma nova foto nunca atualiza/apaga a anterior.
  // Cada envio cria um registro próprio para preservar o antes e depois.
  const inserted=await supabase.from("progress_photos")
    .insert({
      user_id:targetId,
      photo_date:photoDate,
      photo_type:type,
      storage_path:path,
      notes
    })
    .select()
    .single();

  if(inserted.error)throw inserted.error;
  return inserted.data;
}

async function autoSaveProgressPhoto(type,file,source){
 const form=document.querySelector("#photoForm");
 if(!form||!file)return;
 const fd=new FormData(form);
 const targetId=isCoach?String(fd.get("user_id")||""):user.id;
 if(!targetId)return toast("Selecione um aluno.",true);

 const photoDate=String(fd.get("photo_date")||today());
 const notes=String(fd.get("notes")||"").trim();
 photoDraft.photo_date=photoDate;
 photoDraft.notes=notes;

 const box=document.querySelector(`[data-preview="${type}"]`);
 const status=document.querySelector("#photoDraftStatus");

 try{
   if(box){
     box.classList.add("is-uploading");
     box.innerHTML=`<div class="photo-uploading"><span class="spinner-mini"></span><strong>Salvando...</strong><small>Enviando para a nuvem</small></div>`;
   }
   if(status){
     status.classList.add("has-files");
     status.innerHTML=`<strong>Salvando ${photoTypeLabel(type).toLowerCase()}...</strong><span>Não feche o aplicativo até concluir.</span>`;
   }

   const blob=await compressPhoto(file);
   const path=`${targetId}/${photoDate}/${type}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;

   const up=await supabase.storage.from(PHOTO_BUCKET).upload(path,blob,{
     upsert:true,contentType:"image/jpeg",cacheControl:"3600"
   });
   if(up.error)throw up.error;

   await saveProgressPhotoRow(targetId,photoDate,type,path,notes);

   await loadPhotos(targetId);
   clearPhotoDraftType(type);
   toast(`✓ ${photoTypeLabel(type)} salva na nuvem e registrada no histórico.`);
   render();
 }catch(err){
   console.error(err);
   if(box){
     const d=photoDraft[type];
     box.classList.remove("is-uploading");
     box.innerHTML=d?.url
       ? `<img src="${d.url}" alt="Prévia ${photoTypeLabel(type)}"><span>Falha ao salvar · tente novamente</span>`
       : `Falha ao salvar`;
   }
   if(status){
     status.classList.remove("has-files");
     status.classList.add("photo-error");
     status.innerHTML=`<strong>Não foi possível salvar.</strong><span>${esc(err?.message||String(err))}</span>`;
   }
   toast("Não foi possível salvar a foto: "+(err?.message||String(err)),true);
 }
}
async function savePhotoNotes(){
 const form=document.querySelector("#photoForm");
 if(!form)return;
 const fd=new FormData(form);
 const targetId=isCoach?String(fd.get("user_id")||""):user.id;
 const photoDate=String(fd.get("photo_date")||today());
 const notes=String(fd.get("notes")||"").trim();
 photoDraft.notes=notes;
 if(!targetId)return;
 const hasSaved=data.progress_photos.some(p=>p.user_id===targetId&&p.photo_date===photoDate);
 if(!hasSaved)return;
 const r=await supabase.from("progress_photos").update({notes,updated_at:new Date().toISOString()})
   .eq("user_id",targetId).eq("photo_date",photoDate);
 if(r.error)return toast("Não foi possível atualizar as observações.",true);
 await loadPhotos(targetId);
 toast("Observações salvas.");
}

async function uploadProgressPhotos(form){
 const fd=new FormData(form);
 const targetId=isCoach?String(fd.get("user_id")||""):user.id;
 if(!targetId)return toast("Selecione um aluno.",true);
 const photoDate=String(photoDraft.photo_date||fd.get("photo_date")||today());
 const notes=String(photoDraft.notes||fd.get("notes")||"").trim();
 // Usa o rascunho em memória para que as fotos não desapareçam
 // mesmo se o navegador renovar a sessão ao voltar da galeria.
 const picks=[
   ["front",photoDraft.front?.file],
   ["side",photoDraft.side?.file],
   ["back",photoDraft.back?.file]
 ].filter(x=>x[1]);
 if(!picks.length)return toast("Escolha pelo menos uma foto: frente, lado ou costas.",true);

 const btn=form.querySelector('button[type="submit"]');
 if(btn){btn.disabled=true;btn.dataset.originalText=btn.textContent;btn.textContent="Enviando fotos...";}
 try{
   for(const [type,file] of picks){
     const blob=await compressPhoto(file);
     const path=`${targetId}/${photoDate}/${type}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
     const up=await supabase.storage.from(PHOTO_BUCKET).upload(path,blob,{
       upsert:true,contentType:"image/jpeg",cacheControl:"3600"
     });
     if(up.error)throw up.error;

     await saveProgressPhotoRow(targetId,photoDate,type,path,notes);
   }
   await loadPhotos(targetId);
   clearPhotoDraft();
   toast("Fotos salvas online com sucesso.");
   render();
 }catch(err){
   console.error(err);
   toast("Não foi possível salvar as fotos: "+(err?.message||String(err)),true);
 }finally{
   if(btn){btn.disabled=false;btn.textContent=btn.dataset.originalText||"Salvar fotos";}
 }
}
async function deleteProgressPhoto(id,path){
 if(!confirm("Excluir esta foto de evolução? Esta ação remove a foto do histórico."))return;
 const r=await supabase.from("progress_photos").delete().eq("id",id);
 if(r.error)return toast("Erro ao excluir: "+r.error.message,true);
 await supabase.storage.from(PHOTO_BUCKET).remove([path]);
 await loadPhotos(photoTargetId());
 toast("Foto excluída.");
 render();
}
function photoGroups(){
 const map=new Map();
 for(const p of data.progress_photos){
   if(!map.has(p.photo_date))map.set(p.photo_date,[]);
   map.get(p.photo_date).push(p);
 }
 return [...map.entries()];
}

let photoViewerState={index:0,zoom:1};

function viewerPhotos(){
  return data.progress_photos
    .filter(p=>p.signed_url)
    .sort((a,b)=>{
      const d=String(a.photo_date||"").localeCompare(String(b.photo_date||""));
      if(d!==0)return d;
      const order={front:0,side:1,back:2};
      return (order[a.photo_type]??9)-(order[b.photo_type]??9);
    });
}

function openPhotoViewerById(id){
  const list=viewerPhotos();
  if(!list.length)return toast("Imagem indisponível.",true);

  let index=list.findIndex(p=>String(p.id)===String(id));
  if(index<0)index=0;

  photoViewerState={index,zoom:1};
  renderPhotoViewer();
}

function openPhotoViewerByUrl(url){
  const list=viewerPhotos();
  if(!list.length)return toast("Imagem indisponível.",true);

  let index=list.findIndex(p=>String(p.signed_url)===String(url));
  if(index<0)index=0;

  photoViewerState={index,zoom:1};
  renderPhotoViewer();
}

function renderPhotoViewer(){
  document.querySelector("#photoViewerOverlay")?.remove();

  const list=viewerPhotos();
  if(!list.length)return;
  const p=list[photoViewerState.index];
  if(!p)return;

  const overlay=document.createElement("div");
  overlay.id="photoViewerOverlay";
  overlay.className="photo-viewer-overlay";
  overlay.innerHTML=`
    <div class="photo-viewer" role="dialog" aria-modal="true">
      <header class="photo-viewer-head">
        <button type="button" class="viewer-close">← Voltar</button>
        <div class="viewer-title">
          <strong>${photoTypeLabel(p.photo_type)}</strong>
          <small>${fmt(p.photo_date)} · ${photoViewerState.index+1} de ${list.length}</small>
        </div>
        <button type="button" class="viewer-x" aria-label="Fechar">×</button>
      </header>

      <div class="photo-viewer-stage">
        <button type="button" class="viewer-nav viewer-prev" ${list.length<2?"hidden":""} aria-label="Foto anterior">‹</button>

        <div class="photo-viewer-scroll">
          <img
            class="photo-viewer-img"
            src="${esc(p.signed_url)}"
            alt="${photoTypeLabel(p.photo_type)} — ${fmt(p.photo_date)}"
            style="transform:scale(${photoViewerState.zoom})"
          >
        </div>

        <button type="button" class="viewer-nav viewer-next" ${list.length<2?"hidden":""} aria-label="Próxima foto">›</button>
      </div>

      <footer class="photo-viewer-foot">
        <div class="viewer-meta">
          <span>${isCoach?`Aluno: ${esc(selectedStudentName())}`:"Foto de evolução"}</span>
          ${p.notes?`<small>${esc(p.notes)}</small>`:""}
        </div>
        <div class="viewer-zoom">
          <button type="button" class="viewer-zoom-out" aria-label="Diminuir">−</button>
          <span>${Math.round(photoViewerState.zoom*100)}%</span>
          <button type="button" class="viewer-zoom-in" aria-label="Ampliar">+</button>
        </div>
      </footer>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add("photo-viewer-open");

  const close=()=>{
    overlay.remove();
    document.body.classList.remove("photo-viewer-open");
  };

  overlay.querySelector(".viewer-close").onclick=close;
  overlay.querySelector(".viewer-x").onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close()};

  overlay.querySelector(".viewer-prev").onclick=()=>{
    photoViewerState.index=(photoViewerState.index-1+list.length)%list.length;
    photoViewerState.zoom=1;
    renderPhotoViewer();
  };

  overlay.querySelector(".viewer-next").onclick=()=>{
    photoViewerState.index=(photoViewerState.index+1)%list.length;
    photoViewerState.zoom=1;
    renderPhotoViewer();
  };

  const setZoom=z=>{
    photoViewerState.zoom=Math.min(3,Math.max(1,z));
    const img=overlay.querySelector(".photo-viewer-img");
    const label=overlay.querySelector(".viewer-zoom span");
    if(img)img.style.transform=`scale(${photoViewerState.zoom})`;
    if(label)label.textContent=`${Math.round(photoViewerState.zoom*100)}%`;
  };

  overlay.querySelector(".viewer-zoom-in").onclick=()=>setZoom(photoViewerState.zoom+.5);
  overlay.querySelector(".viewer-zoom-out").onclick=()=>setZoom(photoViewerState.zoom-.5);

  const img=overlay.querySelector(".photo-viewer-img");
  if(img){
    img.ondblclick=()=>setZoom(photoViewerState.zoom>1?1:2);
  }

  let startX=null;
  const stage=overlay.querySelector(".photo-viewer-stage");
  stage.addEventListener("touchstart",e=>{
    if(photoViewerState.zoom!==1 || e.touches.length!==1)return;
    startX=e.touches[0].clientX;
  },{passive:true});
  stage.addEventListener("touchend",e=>{
    if(startX===null || photoViewerState.zoom!==1)return;
    const endX=e.changedTouches?.[0]?.clientX;
    if(endX===undefined)return;
    const dx=endX-startX;
    startX=null;
    if(Math.abs(dx)<55 || list.length<2)return;
    photoViewerState.index=dx<0
      ? (photoViewerState.index+1)%list.length
      : (photoViewerState.index-1+list.length)%list.length;
    photoViewerState.zoom=1;
    renderPhotoViewer();
  },{passive:true});
}

function photoThumb(p){
 return `<article class="photo-card">
   ${p.signed_url?`<button type="button" class="photo-frame photo-open" data-photo-id="${p.id}" aria-label="Abrir foto ${photoTypeLabel(p.photo_type)}">
     <img src="${esc(p.signed_url)}" alt="Foto ${photoTypeLabel(p.photo_type)}">
     <span class="photo-open-hint">⛶ Abrir</span>
   </button>`:`<div class="photo-frame"><div class="photo-missing">Imagem indisponível</div></div>`}
   <div class="photo-card-meta"><strong>${photoTypeLabel(p.photo_type)}</strong>
   <button type="button" class="photo-delete" data-photo-id="${p.id}" data-photo-path="${esc(p.storage_path)}">Excluir</button></div>
   ${p.notes?`<p class="small">${esc(p.notes)}</p>`:""}
 </article>`;
}
function comparisonFor(type){
 const arr=data.progress_photos.filter(p=>p.photo_type===type&&p.signed_url).sort((a,b)=>String(a.photo_date).localeCompare(String(b.photo_date)));
 if(arr.length<2)return "";
 const before=arr[0],after=arr[arr.length-1];
 return `<div class="compare-block"><h3>${photoTypeLabel(type)}</h3><div class="compare-grid">
   <div><span class="compare-label">ANTES · ${fmt(before.photo_date)}</span><button type="button" class="compare-photo-open photo-open" data-photo-id="${before.id}"><img src="${esc(before.signed_url)}" alt="Antes ${photoTypeLabel(type)}"><span>⛶ Abrir</span></button></div>
   <div><span class="compare-label">DEPOIS · ${fmt(after.photo_date)}</span><button type="button" class="compare-photo-open photo-open" data-photo-id="${after.id}"><img src="${esc(after.signed_url)}" alt="Depois ${photoTypeLabel(type)}"><span>⛶ Abrir</span></button></div>
 </div></div>`;
}
function photos(){
 const groups=photoGroups();
 const comparisons=["front","side","back"].map(comparisonFor).filter(Boolean).join("");
 return `${pageBack()}${coachStudentBanner()}
 <div class="section-head"><div><div class="eyebrow">Evolução visual</div><h1>Fotos de evolução</h1></div></div>
 ${photoSetupWarning()}
 <form id="photoForm" class="card">
   <div class="eyebrow">Registro fotográfico</div><h2>Frente, lado e costas</h2>
   <p class="sub">As fotos são armazenadas em área privada no Supabase e vinculadas somente à conta do aluno.</p>
   ${studentSelect()}
   <div class="field"><label>Data das fotos</label><input type="date" name="photo_date" value="${esc(photoDraft.photo_date||today())}" required></div><div class="notice photo-history-notice"><strong>Novo registro</strong><br><span class="small">As novas fotos serão adicionadas ao histórico. Fotos anteriores não serão substituídas.</span></div>
   <div class="photo-upload-grid">
     ${["front","side","back"].map(type=>`<div class="photo-picker">
       <span>${photoTypeLabel(type)}</span>
       <div class="photo-preview" data-preview="${type}">${(()=>{
         const date=photoDraft.photo_date||today();
         const saved=savedPhotoFor(type,date);
         if(saved?.signed_url)return `<button type="button" class="saved-preview-open photo-open" data-photo-id="${saved.id}"><img src="${esc(saved.signed_url)}" alt="Foto ${photoTypeLabel(type)} salva"><span class="saved-cloud">✓ Salva na nuvem · tocar para abrir</span></button>`;
         if(photoDraft[type]?.url)return `<img src="${photoDraft[type].url}" alt="Prévia ${photoTypeLabel(type)}"><span>${photoDraft[type].source==="gallery"?"Galeria":"Câmera"} · preparando</span>`;
         return "Nenhuma foto salva";
       })()}</div>
       <div class="photo-source-actions">
         <label class="photo-source-btn">📷 Câmera<input type="file" name="${type}_camera" accept="image/*" capture="environment" data-photo-input="${type}" data-source="camera"></label>
         <label class="photo-source-btn">🖼️ Galeria<input type="file" name="${type}_gallery" accept="image/*" data-photo-input="${type}" data-source="gallery"></label>
       </div>
     </div>`).join("")}
   </div>
   <div class="field"><label>Observações</label><textarea name="notes" placeholder="Ex.: avaliação mensal, início de fase, observações do acompanhamento...">${esc(photoDraft.notes||"")}</textarea></div>
   <div class="photo-draft-status auto-save-status" id="photoDraftStatus"><strong>Salvamento automático ativado</strong><span>Ao escolher uma foto, ela é enviada imediatamente para a nuvem.</span></div><button type="button" id="savePhotoNotes" class="btn btn-ghost btn-full">Salvar observações</button>
 </form>
 ${comparisons?`<div class="card"><div class="eyebrow">Comparação</div><h2>Antes e depois</h2>${comparisons}</div>`:""}
 <div class="card"><div class="eyebrow">Histórico</div><h2>${data.progress_photos.length} foto(s) salva(s)</h2>
   ${groups.length?groups.map(([date,items])=>`<section class="photo-date-group"><h3>${fmt(date)}</h3><div class="photo-history-grid">${items.map(photoThumb).join("")}</div></section>`).join(""):`<p class="sub">Nenhuma foto registrada ainda.</p>`}
 </div>`;
}
function bindPhotoPreviews(){
 function updateStatusIdle(){
   const el=document.querySelector("#photoDraftStatus");
   if(!el)return;
   el.classList.remove("photo-error");
   el.classList.add("auto-save-status");
   el.innerHTML=`<strong>Salvamento automático ativado</strong><span>Ao escolher uma foto, ela é enviada imediatamente para a nuvem.</span>`;
 }

 ["front","side","back"].forEach(type=>{
   const inputs=[...document.querySelectorAll(`#photoForm [data-photo-input="${type}"]`)];
   const box=document.querySelector(`[data-preview="${type}"]`);
   if(!inputs.length||!box)return;

   inputs.forEach(input=>{
     input.onchange=async()=>{
       const file=input.files?.[0];
       if(!file)return;

       inputs.filter(x=>x!==input).forEach(x=>x.value="");

       const previous=photoDraft[type];
       if(previous?.url)try{URL.revokeObjectURL(previous.url)}catch(_){}

       const url=URL.createObjectURL(file);
       photoDraft[type]={
         file,
         source:input.dataset.source||"gallery",
         url,
         name:file.name||"foto"
       };

       const dateInput=document.querySelector('#photoForm input[name="photo_date"]');
       const notesInput=document.querySelector('#photoForm textarea[name="notes"]');
       photoDraft.photo_date=dateInput?.value||today();
       photoDraft.notes=notesInput?.value||"";

       box.innerHTML=`<img src="${url}" alt="Prévia ${photoTypeLabel(type)}"><span>Preparando para salvar...</span>`;
       await autoSaveProgressPhoto(type,file,input.dataset.source||"gallery");
     };
   });
 });

 const dateInput=document.querySelector('#photoForm input[name="photo_date"]');
 const notesInput=document.querySelector('#photoForm textarea[name="notes"]');

 if(dateInput){
   if(photoDraft.photo_date)dateInput.value=photoDraft.photo_date;
   dateInput.onchange=()=>{
     photoDraft.photo_date=dateInput.value;
     render();
   };
 }
 if(notesInput){
   if(photoDraft.notes)notesInput.value=photoDraft.notes;
   notesInput.oninput=()=>photoDraft.notes=notesInput.value;
 }
 const noteBtn=document.querySelector("#savePhotoNotes");
 if(noteBtn)noteBtn.onclick=savePhotoNotes;

 updateStatusIdle();
}

async function chooseStudent(id,nextRoute=null){
 if(!isCoach||!id)return;
 if(selectedStudentId && selectedStudentId!==id) clearPhotoDraft();
 selectedStudentId=id;
 selectedTrainingDayId=null;
 selectedStudentProfile=data.students.find(s=>s.user_id===id)||null;
 sessionStorage.setItem("evolucao_selected_student",id);
 await loadStudentData();
 if(nextRoute)route=nextRoute;
 render();
}
function selectedStudentName(){return selectedStudentProfile?.full_name||"Aluno"}
function coachLoadWarning(){
 const errs=Object.entries(loadErrors).filter(([k])=>k!=="students");
 return errs.length?`<div class="notice error-notice"><strong>Não foi possível carregar alguns dados do aluno.</strong><br><span class="small">O acesso do Coach ao banco precisa ser liberado no Supabase. Arquivo incluído nesta versão: LIBERAR_ACESSO_COACH.sql</span></div>`:"";
}
function backTarget(){
 if(route==="student"||route==="coach") return "home";
 if(route==="trainingDay") return "training";
 if(["measures","food","workouts","hormones","photos","training"].includes(route)) return isCoach&&selectedStudentId?"student":"home";
 if(route==="profile") return "home";
 return null;
}
function goBack(){
 const t=backTarget();
 if(t){route=t;render();}
}
function pageBack(){
 return backTarget()?`<button type="button" class="page-back" data-back>← Voltar</button>`:"";
}
async function deleteStudent(id){
 if(!isCoach||!id)return;
 const student=data.students.find(s=>s.user_id===id);
 const name=student?.full_name||"este aluno";
 if(!confirm(`Excluir ${name} da consultoria?\n\nO acesso do aluno será desativado e ele deixará de aparecer no seu painel. O histórico será preservado para evitar perda acidental.`))return;

 const r=await supabase.rpc("archive_student",{target_user_id:id});
 if(r.error){
   const missing=/archive_student|function|schema cache/i.test(r.error.message||"");
   return toast(missing?"Para ativar a exclusão, execute uma vez o arquivo ATUALIZAR_V5.sql no SQL Editor do Supabase.":"Erro ao excluir aluno: "+r.error.message,true);
 }

 data.students=data.students.filter(s=>s.user_id!==id);
 if(selectedStudentId===id){
   selectedStudentId=data.students[0]?.user_id||null;
   selectedStudentProfile=data.students.find(s=>s.user_id===selectedStudentId)||null;
   if(selectedStudentId){sessionStorage.setItem("evolucao_selected_student",selectedStudentId);await loadStudentData();}
   else {sessionStorage.removeItem("evolucao_selected_student");selectedStudentProfile=null;await loadStudentData();}
 }
 route="home";
 toast("Aluno excluído da consultoria. Histórico preservado.");
 render();
}

function recordValue(rec,key,type,unit){
 let v=rec?.[key];
 if(type==="date") return fmt(v);
 if(v===null||v===undefined||v==="") return "Não informado";
 return `${esc(v)}${unit?` ${unit}`:""}`;
}
function recordTitle(table,rec){
 if(table==="measurements")return `Avaliação corporal — ${fmt(rec.assessment_date)}`;
 if(table==="meals")return `${esc(rec.meal_type||"Refeição")} — ${fmt(rec.meal_date)}`;
 if(table==="workouts")return `${esc(rec.workout_type||"Treino")} — ${fmt(rec.workout_date)}`;
 if(table==="hormone_logs")return `${esc(rec.hormone_name||"Registro hormonal")} — ${fmt(rec.start_date)}`;
 if(table==="skinfolds")return `Avaliação profissional — ${fmt(rec.assessment_date)}`;
 return "Detalhes do registro";
}
function openRecordDetail(table,index){
 const rec=data[table]?.[Number(index)];
 if(!rec)return toast("Registro não encontrado.",true);
 const schema=recordSchemas[table]||[];
 const overlay=document.createElement("div");
 overlay.className="record-overlay";
 overlay.innerHTML=`<div class="record-modal" role="dialog" aria-modal="true">
   <div class="record-modal-head">
     <button type="button" class="record-close" aria-label="Voltar">← Voltar</button>
     <button type="button" class="record-x" aria-label="Fechar">×</button>
   </div>
   <div class="eyebrow">${isCoach?`Aluno: ${esc(selectedStudentName())}`:"Registro salvo"}</div>
   <h2>${recordTitle(table,rec)}</h2>
   <p class="sub">Estes são os dados que estão salvos online neste registro.</p>
   <div class="record-detail-grid">
     ${schema.map(([key,label,unit])=>`<div class="record-field"><span>${label}</span><strong>${recordValue(rec,key,unit==="date"?"date":"",unit==="date"?"":unit)}</strong></div>`).join("")}
   </div>
 </div>`;
 document.body.appendChild(overlay);
 const close=()=>overlay.remove();
 overlay.querySelector(".record-close").onclick=close;
 overlay.querySelector(".record-x").onclick=close;
 overlay.onclick=e=>{if(e.target===overlay)close()};
}

function inactiveView(){
 return `<section class="auth"><div class="authbox" style="text-align:center">
 <img src="./logo-brand.jpg" class="auth-logo" alt="Logo Evolução Corporal">
 <div class="eyebrow">Consultoria online</div><h1>Conta desativada</h1>
 <p class="sub">Seu acesso à consultoria foi encerrado. Entre em contato com seu coach caso precise reativar a conta.</p>
 <button id="inactiveLogout" class="btn btn-ghost btn-full">Sair</button>
 </div></section>`;
}

function render(){
 const root=$("#app");
 if(!user){root.innerHTML=authView();bindAuth();return}
 if(accountInactive){root.innerHTML=inactiveView();$("#inactiveLogout").onclick=()=>supabase.auth.signOut();return}
 root.innerHTML=shell();bindShell();drawRoute();
}

function authView(){return `<section class="auth"><div class="authbox">
<img src="./logo-brand.jpg" class="auth-logo" alt="Logo Evolução Corporal">
<div class="eyebrow">Consultoria online · v${APP_VERSION}</div><h1>Evolução Corporal</h1>
<p class="sub">André Salles • Silvana Salles<br>Hipertrofia & emagrecimento</p>
<div class="tabs"><button class="active" data-tab="login">Entrar</button><button data-tab="signup">Criar conta</button></div>
<form id="loginForm">
<div class="field"><label>E-mail</label><input name="email" type="email" autocomplete="email" required></div>
<div class="field"><label>Senha</label><input name="password" type="password" autocomplete="current-password" required></div>
<button class="btn btn-primary btn-full">Entrar</button>
<button type="button" id="forgot" class="btn btn-ghost btn-full" style="margin-top:10px">Esqueci minha senha</button>
</form>
<form id="signupForm" hidden>
<div class="field"><label>Nome completo</label><input name="name" required></div>
<div class="field"><label>E-mail</label><input name="email" type="email" required></div>
<div class="field"><label>Senha</label><input name="password" type="password" minlength="6" required></div>
<div class="field"><label>Objetivo</label><select name="goal"><option>Hipertrofia</option><option>Emagrecimento</option><option>Condicionamento</option><option>Saúde</option></select></div>
<button class="btn btn-primary btn-full">Criar minha conta</button>
<p class="small">Confirme o e-mail antes do primeiro acesso, se solicitado.</p>
</form></div></section>`}
function bindAuth(){
 $$(".tabs button").forEach(b=>b.onclick=()=>{$$(".tabs button").forEach(x=>x.classList.toggle("active",x===b));$("#loginForm").hidden=b.dataset.tab!=="login";$("#signupForm").hidden=b.dataset.tab!=="signup"});
 $("#loginForm").onsubmit=async e=>{e.preventDefault();let f=new FormData(e.currentTarget);let r=await supabase.auth.signInWithPassword({email:String(f.get("email")).trim(),password:String(f.get("password"))});if(r.error)toast("Erro ao entrar: "+r.error.message,true)};
 $("#signupForm").onsubmit=async e=>{e.preventDefault();let f=new FormData(e.currentTarget);let r=await supabase.auth.signUp({email:String(f.get("email")).trim(),password:String(f.get("password")),options:{data:{full_name:String(f.get("name")).trim(),goal:String(f.get("goal"))},emailRedirectTo:location.origin+location.pathname}});if(r.error)return toast("Erro no cadastro: "+r.error.message,true);toast(r.data.session?"Conta criada com sucesso.":"Conta criada. Confira seu e-mail para confirmar.")};
 $("#forgot").onclick=async()=>{let email=prompt("Digite seu e-mail:");if(!email)return;let r=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});toast(r.error?r.error.message:"Link de recuperação enviado.",!!r.error)};
}

function shell(){
 const name=profile?.full_name||user.email;
 return `<div class="app"><header class="topbar">
 <div class="brand-wrap">${backTarget()?`<button type="button" class="top-back" data-back aria-label="Voltar">←</button>`:""}<img src="./logo-brand.jpg" class="brand-mark" alt="Logo"><div><div class="small">Evolução Corporal <span class="version-badge">v${APP_VERSION}</span></div><div class="brand">${isCoach?"Painel do Coach":"Olá, "+esc(name.split(" ")[0])}</div></div></div>
 <div class="top-actions">${isCoach&&selectedStudentId?`<div class="active-student-chip"><span>${studentInitials(selectedStudentName())}</span><div><small>Aluno ativo</small><strong>${esc(selectedStudentName().split(" ")[0])}</strong></div></div>`:""}<div class="user-chip"><span class="avatar">${esc(name[0])}</span><button id="logout" class="btn btn-ghost" style="padding:7px 10px">Sair</button></div></div></header>
 <main id="content"></main>
 <nav class="bottomnav">${nav("home","⌂","Visão geral")}${nav("measures","▥","Medidas")}${nav("food","◉","Alimentação")}${nav("training","✦","Meu treino")}${nav("hormones","⌁","Uso hormonal")}${nav(isCoach?"coach":"profile","♟",isCoach?"Alunos":"Meu perfil")}</nav></div>`;
}
function nav(r,i,l){return `<button class="navbtn ${route===r?"active":""}" data-route="${r}"><span class="ico">${i}</span>${l}</button>`}
function bindShell(){
 $("#logout").onclick=()=>supabase.auth.signOut();
 $$(".navbtn").forEach(b=>b.onclick=()=>{route=b.dataset.route;render()});
 $$("[data-back]").forEach(b=>b.onclick=goBack);
}
function drawRoute(){
 const c=$("#content");
 c.innerHTML=route==="home"?(isCoach?coachHome():home()):route==="student"&&isCoach?studentDashboard():route==="photos"?photos():route==="measures"?measures():route==="food"?food():route==="training"?trainingView():route==="trainingDay"?trainingDayView():route==="workouts"?workouts():route==="hormones"?hormones():route==="coach"&&isCoach?coach():profileView();
 bindRoute();drawChart();
}

function last(a){return a?.[0]}

function activityDate(x,kind){
 const key={
   measure:"assessment_date",
   meal:"meal_date",
   workout:"workout_date",
   hormone:"start_date",
   skinfold:"assessment_date",
   photo:"photo_date"
 }[kind];
 return x?.[key]||"";
}
function recentActivities(limit=6){
 const all=[];
 data.measurements.forEach((x,i)=>all.push({kind:"measure",date:activityDate(x,"measure"),title:"Avaliação corporal",detail:`${x.weight||0} kg · cintura ${x.waist||0} cm`,route:"measures",index:i}));
 data.meals.forEach((x,i)=>all.push({kind:"meal",date:activityDate(x,"meal"),title:x.meal_type||"Alimentação",detail:`${x.calories||0} kcal`,route:"food",index:i}));
 data.workouts.forEach((x,i)=>all.push({kind:"workout",date:activityDate(x,"workout"),title:x.workout_type||"Treino",detail:`${x.duration_minutes||0} min`,route:"workouts",index:i}));
 data.hormone_logs.forEach((x,i)=>all.push({kind:"hormone",date:activityDate(x,"hormone"),title:"Registro de acompanhamento",detail:x.hormone_name||"Uso hormonal",route:"hormones",index:i}));
 data.skinfolds.forEach((x,i)=>all.push({kind:"skinfold",date:activityDate(x,"skinfold"),title:"Avaliação profissional",detail:x.protocol||"Dobras cutâneas",route:"coach",index:i}));
 data.progress_photos.forEach((x,i)=>all.push({kind:"photo",date:activityDate(x,"photo"),title:"Foto de evolução",detail:photoTypeLabel(x.photo_type),route:"photos",index:i}));
 return all.filter(x=>x.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,limit);
}
function activityIcon(kind){
 return ({measure:"▥",meal:"◉",workout:"✦",hormone:"⌁",skinfold:"◇",photo:"▣"})[kind]||"•";
}
function activityTimeline(limit=6){
 const items=recentActivities(limit);
 if(!items.length)return `<div class="empty-state"><strong>Nenhum registro ainda</strong><span>Os últimos registros do acompanhamento aparecerão aqui.</span></div>`;
 return `<div class="activity-list">${items.map(x=>`<button type="button" class="activity-item" data-go="${x.route}">
   <span class="activity-icon">${activityIcon(x.kind)}</span>
   <span class="activity-copy"><strong>${esc(x.title)}</strong><small>${esc(x.detail)} · ${fmt(x.date)}</small></span>
   <span class="activity-arrow">›</span>
 </button>`).join("")}</div>`;
}
function latestActivityDate(){
 return recentActivities(50)[0]?.date||"";
}
function studentInitials(name=""){
 return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"A";
}
function coachQuickActions(){
 if(!selectedStudentId)return "";
 return `<div class="quick-actions">
   <button class="quick-action" data-go="measures"><span>▥</span><strong>Medidas</strong><small>${data.measurements.length} registro(s)</small></button>
   <button class="quick-action" data-go="food"><span>◉</span><strong>Alimentação</strong><small>${data.meals.length} registro(s)</small></button>
   <button class="quick-action" data-go="training"><span>✦</span><strong>Meu treino</strong><small>${data.training_plans.length} ficha(s)</small></button>
   <button class="quick-action" data-go="photos"><span>▣</span><strong>Fotos</strong><small>${data.progress_photos.length} foto(s)</small></button>
 </div>`;
}

function home(){
 const m=last(data.measurements), meals=data.meals.filter(x=>x.meal_date===today()), works=data.workouts.filter(x=>x.workout_date===today());
 const kcal=meals.reduce((a,x)=>a+n(x.calories),0), train=works.reduce((a,x)=>a+n(x.duration_minutes),0);
 const target=2300, pct=Math.max(0,Math.min(100,Math.round((kcal/target)*100)));
 const first=esc((profile.full_name||"Atleta").split(" ")[0]);
 const dateTxt=new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"});
 return `<section class="premium-brand"><div class="premium-brand-content">
 <img src="./logo-brand.jpg" class="premium-logo" alt="Logo da consultoria">
 <h1>Evolução Corporal</h1><div class="names">André Salles • Silvana Salles</div>
 <div class="tagline">Consultoria online · Hipertrofia & emagrecimento</div></div></section>
 <div class="welcome-row"><div><div class="eyebrow">Evolua todos os dias</div><h2>Olá, ${first}!</h2><p class="sub" style="margin:5px 0 0">Disciplina hoje. Uma versão mais forte de você amanhã.</p></div><div class="date-pill">${esc(dateTxt)}</div></div>
 <div class="metric-grid">
 <div class="metric"><div class="metric-icon">◎</div><span class="small">OBJETIVO</span><strong style="font-size:20px">${esc(profile.goal||"Definir meta")}</strong></div>
 <div class="metric"><div class="metric-icon">♙</div><span class="small">PESO ATUAL</span><strong>${m?.weight||0} kg</strong><div class="trend">Histórico online</div></div>
 <div class="metric"><div class="metric-icon">◯</div><span class="small">CINTURA</span><strong>${m?.waist||0} cm</strong><div class="trend">Acompanhe a evolução</div></div>
 <div class="metric"><div class="metric-icon">✦</div><span class="small">TREINO HOJE</span><strong>${train} min</strong><div class="trend">${works.length} treino(s)</div></div></div>
 <div class="card compact-card"><div class="eyebrow">Acesso rápido</div><h2>Registrar hoje</h2>
 <div class="quick-actions">
   <button class="quick-action" data-go="measures"><span>▥</span><strong>Medidas</strong><small>Nova avaliação</small></button>
   <button class="quick-action" data-go="food"><span>◉</span><strong>Refeição</strong><small>Registrar alimentação</small></button>
   <button class="quick-action" data-go="workouts"><span>✦</span><strong>Treino</strong><small>Registrar atividade</small></button>
   <button class="quick-action" data-go="photos"><span>▣</span><strong>Fotos</strong><small>Evolução visual</small></button>
 </div></div>
 <div class="card summary-card"><div class="ring" style="--pct:${pct}%"><div class="ring-content"><strong>${kcal}</strong><span>de ${target} kcal<br>${pct}%</span></div></div>
 <div><div class="eyebrow">Calorias de hoje</div><h2>Resumo diário</h2><div class="summary-lines">
 <div class="summary-line"><span>Consumidas</span><strong>${kcal} kcal</strong></div><div class="summary-line"><span>Restantes</span><strong>${Math.max(0,target-kcal)} kcal</strong></div><div class="summary-line"><span>Refeições</span><strong>${meals.length}</strong></div>
 </div></div></div>
 <div class="card"><div class="eyebrow">Seu progresso</div><h2>Evolução atualizada</h2><canvas id="chart"></canvas><p class="small">Gráfico baseado nas avaliações salvas no Supabase.</p></div>
 <div class="card photo-cta"><div class="eyebrow">Evolução visual</div><h2>Fotos de evolução</h2><p class="sub">Registre frente, lado e costas para acompanhar as mudanças ao longo do tempo.</p><button type="button" class="btn btn-ghost btn-full" data-go="photos">Abrir histórico de fotos</button></div>
 <div class="card quote-card"><div class="eyebrow">Consistência sempre</div><h2>Corpo forte, mente inabalável.</h2><p class="sub">Mais que treino: um estilo de vida.</p><button class="btn btn-primary" data-go="measures">+ Nova avaliação</button></div>`;
}
function coachHome(){
 const active=selectedStudentProfile;
 const lastDate=latestActivityDate();
 return `<section class="premium-brand premium-brand-compact"><div class="premium-brand-content">
 <img src="./logo-brand.jpg" class="premium-logo" alt="Logo da consultoria"><h1>Evolução Corporal</h1>
 <div class="names">André Salles • Silvana Salles</div><div class="tagline">Painel profissional</div></div></section>

 <div class="coach-welcome">
   <div><div class="eyebrow">Área profissional</div><h2>Painel do Coach</h2><p class="sub">Gerencie seus alunos e acompanhe a evolução em um só lugar.</p></div>
   <div class="coach-total"><span>${data.students.length}</span><small>aluno(s)</small></div>
 </div>

 ${active?`<div class="card active-student-card">
   <div class="active-student-head"><div class="student-avatar-lg">${studentInitials(active.full_name||"Aluno")}</div>
   <div><div class="eyebrow">Aluno selecionado</div><h2>${esc(active.full_name||"Aluno")}</h2><p class="sub">${esc(active.goal||"Objetivo não informado")}${active.age?` · ${esc(active.age)} anos`:""}${active.height_cm?` · ${esc(active.height_cm)} cm`:""}</p></div></div>
   <div class="student-status-line"><span>Última atividade</span><strong>${lastDate?fmt(lastDate):"Sem registros"}</strong></div>
   ${coachQuickActions()}
   <button class="btn btn-primary btn-full student-open" data-student="${active.user_id}" data-next="student">Abrir ficha completa</button>
 </div>`:`<div class="card"><div class="empty-state"><strong>Nenhum aluno cadastrado</strong><span>Quando um aluno criar a conta, ele aparecerá aqui.</span></div></div>`}

 <div class="card"><div class="section-mini-head"><div><div class="eyebrow">Acompanhamento</div><h2>Alunos</h2></div><span class="count-pill">${data.students.length}</span></div>${studentList()}</div>

 ${active?`<div class="card"><div class="eyebrow">Atividade recente</div><h2>Últimos registros</h2>${activityTimeline(6)}</div>`:""}`;
}
function studentDashboard(){
 if(!selectedStudentId)return `<div class="card"><div class="empty-state"><strong>Nenhum aluno selecionado</strong><span>Volte ao painel e escolha um aluno.</span></div></div>`;
 const m=last(data.measurements), meals=data.meals.filter(x=>x.meal_date===today()), works=data.workouts.filter(x=>x.workout_date===today());
 const kcal=meals.reduce((a,x)=>a+n(x.calories),0), train=works.reduce((a,x)=>a+n(x.duration_minutes),0);
 return `${pageBack()}
 <div class="student-profile-hero">
   <div class="student-avatar-xl">${studentInitials(selectedStudentName())}</div>
   <div><div class="eyebrow">Ficha do aluno</div><h1>${esc(selectedStudentName())}</h1>
   <p>${esc(selectedStudentProfile?.goal||"Objetivo não informado")}${selectedStudentProfile?.age?` · ${esc(selectedStudentProfile.age)} anos`:""}${selectedStudentProfile?.height_cm?` · ${esc(selectedStudentProfile.height_cm)} cm`:""}</p></div>
 </div>
 ${coachLoadWarning()}
 <div class="metric-grid">
   <div class="metric"><span class="small">ÚLTIMO PESO</span><strong>${m?.weight||0} kg</strong><div class="trend">${m?.assessment_date?fmt(m.assessment_date):"Sem avaliação"}</div></div>
   <div class="metric"><span class="small">CINTURA</span><strong>${m?.waist||0} cm</strong><div class="trend">${data.measurements.length} avaliação(ões)</div></div>
   <div class="metric"><span class="small">REFEIÇÕES HOJE</span><strong>${meals.length}</strong><div class="trend">${kcal} kcal</div></div>
   <div class="metric"><span class="small">TREINO HOJE</span><strong>${train} min</strong><div class="trend">${works.length} registro(s)</div></div>
 </div>

 <div class="card"><div class="eyebrow">Acesso rápido</div><h2>Acompanhamento</h2>${coachQuickActions()}
 <div class="quick-actions secondary-actions">
   <button class="quick-action" data-go="hormones"><span>⌁</span><strong>Uso hormonal</strong><small>${data.hormone_logs.length} registro(s)</small></button>
   <button class="quick-action" data-go="coach"><span>◇</span><strong>Avaliação profissional</strong><small>${data.skinfolds.length} registro(s)</small></button>
 </div></div>

 <div class="card"><div class="eyebrow">Atividade recente</div><h2>Histórico do aluno</h2>${activityTimeline(8)}</div>
 <div class="card"><div class="eyebrow">Evolução</div><h2>Gráfico de peso</h2><canvas id="chart"></canvas></div>
 <div class="danger-zone"><div><strong>Excluir aluno</strong><p class="small">Desativa o acesso e remove o aluno do painel. O histórico fica preservado.</p></div><button type="button" class="btn btn-danger student-delete" data-student="${selectedStudentId}">Excluir aluno</button></div>`;
}
function studentList(){
 return `<div class="student-tools">
   <div class="student-search-wrap"><span>⌕</span><input id="studentSearch" type="search" placeholder="Buscar aluno pelo nome..." autocomplete="off"></div>
 </div>
 <div class="list student-list" id="studentList">${data.students.map(s=>`<div class="item student-row ${s.user_id===selectedStudentId?"selected":""}" data-student-name="${esc((s.full_name||"Aluno").toLowerCase())}">
   <button type="button" class="student-main student-open" data-student="${s.user_id}" data-next="student">
     <span class="student-avatar-sm">${studentInitials(s.full_name||"Aluno")}</span>
     <span class="student-list-copy"><strong>${esc(s.full_name||"Aluno")}</strong><small>${esc(s.goal||"Objetivo não informado")}</small></span>
     <span class="badge">${s.user_id===selectedStudentId?"Ativo":"Abrir"}</span>
   </button>
   <button type="button" class="student-delete mini-danger" data-student="${s.user_id}" title="Excluir aluno">Excluir</button>
 </div>`).join("")||`<div class="empty-state"><strong>Nenhum aluno cadastrado</strong><span>Os alunos aparecerão aqui depois do cadastro.</span></div>`}</div>`;
}
function studentSelect(){return isCoach?`<div class="field"><label>Aluno</label><select name="user_id" class="student-select" required>${data.students.map(s=>`<option value="${s.user_id}" ${s.user_id===selectedStudentId?"selected":""}>${esc(s.full_name||"Aluno")}</option>`).join("")}</select></div>`:""}
function coachStudentBanner(){return isCoach&&selectedStudentId?`<div class="student-banner"><span>Aluno selecionado</span><strong>${esc(selectedStudentName())}</strong></div>${coachLoadWarning()}`:""}
function pair(a,an,b,bn){return `<div class="row"><div class="field"><label>${a}</label><input type="number" step="0.1" name="${an}" value="0"></div><div class="field"><label>${b}</label><input type="number" step="0.1" name="${bn}" value="0"></div></div>`}
function measurePair(a,an,b,bn,m){return `<div class="row"><div class="field"><label>${a}</label><input type="number" step="0.1" name="${an}" value="${esc(m?.[an]??0)}"></div><div class="field"><label>${b}</label><input type="number" step="0.1" name="${bn}" value="${esc(m?.[bn]??0)}"></div></div>`}
function history(arr,table,dateCol,valCol,unit,labelCol=""){return `<div class="list">${arr.slice(0,20).map((x,i)=>`<button type="button" class="item history-row record-open" data-table="${table}" data-index="${i}"><div><strong>${fmt(x[dateCol])}</strong><br><small>${esc(labelCol?(x[labelCol]||"Registro"):(x.notes||"Toque para ver todos os dados"))}</small></div><div class="history-right"><strong>${x[valCol]??"—"} ${unit}</strong><span>Ver detalhes ›</span></div></button>`).join("")||"<p class='sub'>Nenhum registro ainda.</p>"}</div>`}

function measures(){const m=last(data.measurements);return `${pageBack()}${coachStudentBanner()}<div class="section-head"><div><div class="eyebrow">Avaliação corporal</div><h1>Medidas</h1></div></div>
<form id="measureForm" class="card"><div class="eyebrow">Nova avaliação</div><h2>Registre todas as medidas</h2>${studentSelect()}
<div class="field"><label>Data</label><input type="date" name="assessment_date" value="${today()}" required></div>
${measurePair("Peso (kg)","weight","Cintura (cm)","waist",m)}${measurePair("Quadril (cm)","hip","Glúteo (cm)","glute",m)}${measurePair("Peitoral (cm)","chest","Braço direito (cm)","arm_right",m)}${measurePair("Braço esquerdo (cm)","arm_left","Antebraço direito (cm)","forearm_right",m)}${measurePair("Antebraço esquerdo (cm)","forearm_left","Coxa direita (cm)","thigh_right",m)}${measurePair("Coxa esquerda (cm)","thigh_left","Panturrilha direita (cm)","calf_right",m)}
<div class="field"><label>Panturrilha esquerda (cm)</label><input type="number" step="0.1" name="calf_left" value="${esc(m?.calf_left??0)}"></div>
<button class="btn btn-primary btn-full">Salvar avaliação e atualizar gráfico</button></form>
<div class="card"><div class="eyebrow">Histórico completo</div><h2>${data.measurements.length} avaliações registradas</h2>${history(data.measurements,"measurements","assessment_date","weight","kg")}</div>`}

function food(){
 const active=data.diet_plans.find(x=>x.is_active!==false)||null;
 const prescribed=active?data.diet_plan_meals.filter(x=>String(x.plan_id)===String(active.id)).sort((a,b)=>(a.position||0)-(b.position||0)):[];
 const macro=(label,v,unit="g")=>v!=null&&v!==""?`<div class="metric"><span class="small">${label}</span><strong>${esc(v)}${unit}</strong></div>`:"";
 const planHtml=active?`<div class="card diet-plan-card"><div class="eyebrow">Plano prescrito pelo Coach</div><h2>${esc(active.title)}</h2>${active.objective?`<p class="sub">${esc(active.objective)}</p>`:""}
 <div class="diet-macros">${macro("CALORIAS",active.target_calories," kcal")}${macro("PROTEÍNA",active.target_protein)}${macro("CARBOIDRATOS",active.target_carbs)}${macro("GORDURAS",active.target_fat)}</div>
 ${active.notes?`<div class="notice"><strong>Orientações</strong><br>${esc(active.notes)}</div>`:""}
 <div class="diet-meals">${prescribed.map((m,i)=>`<div class="diet-meal"><div class="diet-meal-head"><span class="diet-number">${i+1}</span><div><small>${esc(m.time_label||"")}</small><strong>${esc(m.title)}</strong></div></div><div class="diet-description">${esc(m.description||"Sem descrição.").replace(/\n/g,"<br>")}</div><div class="diet-meal-macros">${m.calories!=null?`<span>${esc(m.calories)} kcal</span>`:""}${m.protein!=null?`<span>P ${esc(m.protein)}g</span>`:""}${m.carbs!=null?`<span>C ${esc(m.carbs)}g</span>`:""}${m.fat!=null?`<span>G ${esc(m.fat)}g</span>`:""}</div>${m.notes?`<small class="diet-notes">${esc(m.notes)}</small>`:""}</div>`).join("")}</div></div>`:`<div class="card"><div class="empty-state"><strong>Nenhum plano alimentar ativo</strong><span>Quando o Coach prescrever uma dieta, ela aparecerá aqui organizada por refeições.</span></div></div>`;
 return `${pageBack()}${coachStudentBanner()}<div class="section-head"><div><div class="eyebrow">Prescrição e acompanhamento</div><h1>Alimentação</h1></div></div>${loadErrors.diet_plans?`<div class="notice error-notice"><strong>Plano alimentar indisponível.</strong><br><span class="small">${esc(loadErrors.diet_plans)}</span></div>`:""}${planHtml}
 <details class="card food-diary"><summary><strong>Registro diário de alimentação</strong><span class="small">Opcional — abrir histórico e registrar refeição</span></summary><form id="mealForm" style="margin-top:16px"><div class="eyebrow">Nova refeição</div>${studentSelect()}<div class="field"><label>Data</label><input type="date" name="meal_date" value="${today()}" required></div><div class="field"><label>Refeição</label><select name="meal_type"><option>Café da manhã</option><option>Almoço</option><option>Lanche</option><option>Jantar</option><option>Ceia</option></select></div><div class="field"><label>Descrição</label><textarea name="description"></textarea></div>${pair("Calorias","calories","Proteína (g)","protein")}${pair("Carboidratos (g)","carbs","Gorduras (g)","fat")}<button class="btn btn-primary btn-full">Salvar refeição do dia</button></form><div style="margin-top:18px"><h3>Histórico</h3>${history(data.meals,"meals","meal_date","calories","kcal","meal_type")}</div></details>`
}


function trainingSetupWarning(){
 const msg=loadErrors.training_plans||loadErrors.exercise_library||"";
 if(!msg)return "";
 return `<div class="notice error-notice"><strong>Módulo de treinos não disponível.</strong><br><span class="small">${esc(msg)}</span></div>`;
}
function exById(id){return data.exercise_library.find(x=>String(x.id)===String(id))||null}
function dayExercises(dayId){return data.training_day_exercises.filter(x=>String(x.training_day_id)===String(dayId)).sort((a,b)=>(a.position||0)-(b.position||0))}
function planDays(planId){return data.training_days.filter(x=>String(x.plan_id)===String(planId)).sort((a,b)=>(a.position||0)-(b.position||0))}
function youtubeEmbed(url=""){
 try{
   const u=new URL(url);
   let id="";
   if(u.hostname.includes("youtu.be"))id=u.pathname.slice(1).split("/")[0];
   else if(u.hostname.includes("youtube.com")){id=u.searchParams.get("v")||u.pathname.split("/").filter(Boolean).pop();}
   return id?`https://www.youtube.com/embed/${encodeURIComponent(id)}`:"";
 }catch(_){return ""}
}
function videoEmbed(ex,compact=false){
 const url=String(ex?.video_url||"").trim();
 if(!url)return `<div class="training-video-empty"><span>▶</span><small>Sem vídeo demonstrativo</small></div>`;
 const yt=youtubeEmbed(url);
 if(yt)return `<div class="training-video ${compact?"compact":""}"><iframe src="${esc(yt)}" title="Vídeo de ${esc(ex.name)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
 if(/\.(mp4|webm|ogg)(\?|$)/i.test(url))return `<div class="training-video ${compact?"compact":""}"><video controls preload="metadata" playsinline src="${esc(url)}"></video></div>`;
 return `<div class="training-video-link"><a class="btn btn-ghost btn-full" href="${esc(url)}" target="_blank" rel="noopener">▶ Abrir vídeo demonstrativo</a></div>`;
}
function trainingView(){
 return isCoach?coachTrainingView():studentTrainingView();
}
function coachTrainingView(){
 const plans=data.training_plans.filter(x=>x.is_active!==false);
 return `${pageBack()}${coachStudentBanner()}<div class="section-head"><div><div class="eyebrow">Ficha de treino</div><h1>Meu Treino</h1></div></div>${trainingSetupWarning()}
 ${plans.length?plans.map(plan=>{const days=planDays(plan.id);return `<div class="card"><div class="eyebrow">${esc(plan.objective||"Plano atual")}</div><h2>${esc(plan.title)}</h2><div class="training-day-list">${days.map(day=>{const items=dayExercises(day.id);return `<button class="training-day-card training-day-open" data-day="${day.id}"><span class="training-day-icon">✦</span><span><strong>${esc(day.title)}</strong><small>${items.length} exercício(s)</small></span><span class="activity-arrow">›</span></button>`}).join("")||`<p class="sub">Nenhum exercício prescrito nesta ficha.</p>`}</div></div>`}).join(""):`<div class="card"><div class="empty-state"><strong>Nenhum treino prescrito ainda</strong><span>A ficha ativa aparecerá aqui.</span></div></div>`}`;
}
function coachPlanCard(plan){
 const days=planDays(plan.id);
 return `<div class="card training-plan-card"><div class="training-plan-head"><div><div class="eyebrow">Ficha de treino</div><h2>${esc(plan.title)}</h2><p class="sub">${esc(plan.objective||"")}</p></div><button class="btn btn-danger training-plan-delete" data-plan="${plan.id}">Excluir ficha</button></div>
 <form class="trainingDayForm" data-plan="${plan.id}"><div class="row"><div class="field"><label>Novo treino</label><input name="title" placeholder="Ex.: Treino A — Peito e tríceps" required></div><div class="field"><label>Ordem</label><input name="position" type="number" value="${days.length+1}" min="0"></div></div><button class="btn btn-ghost btn-full">+ Acrescentar Treino A/B/C</button></form>
 ${days.map(day=>coachDayCard(day)).join("")||`<p class="sub">Ainda não há dias de treino nesta ficha.</p>`}</div>`;
}
function coachDayCard(day){
 const items=dayExercises(day.id);
 return `<section class="training-day-editor"><div class="training-day-editor-head"><button type="button" class="training-day-open" data-day="${day.id}"><strong>${esc(day.title)}</strong><small>${items.length} exercício(s) · visualizar ›</small></button><button class="mini-danger training-day-delete" data-day="${day.id}">Excluir</button></div>
 <form class="assignExerciseForm" data-day="${day.id}"><div class="field"><label>Acrescentar exercício</label><select name="exercise_id" required><option value="">Selecione...</option>${data.exercise_library.map(ex=>`<option value="${ex.id}">${esc(ex.name)}</option>`).join("")}</select></div><div class="training-mini-grid"><input name="sets" type="number" value="3" min="1" max="20" placeholder="Séries"><input name="reps_min" type="number" value="8" min="1" placeholder="Rep mín"><input name="reps_max" type="number" value="12" min="1" placeholder="Rep máx"><input name="rest_seconds" type="number" value="60" min="0" placeholder="Desc. s"></div><div class="field"><input name="notes" placeholder="Observação do exercício (opcional)"></div><button class="btn btn-primary btn-full">+ Acrescentar ao treino</button></form>
 <div class="assigned-list">${items.map(it=>{const ex=exById(it.exercise_id);return `<div class="assigned-row"><div><strong>${esc(ex?.name||"Exercício")}</strong><small>${it.sets} × ${it.reps_min||"—"}${it.reps_max?`–${it.reps_max}`:""} · ${it.rest_seconds||0}s</small></div><button class="mini-danger assigned-delete" data-assigned="${it.id}">Excluir</button></div>`}).join("")}</div></section>`;
}
function studentTrainingView(){
 const plans=data.training_plans.filter(x=>x.is_active!==false);
 return `${pageBack()}<div class="section-head"><div><div class="eyebrow">Prescrição do Coach</div><h1>Meu Treino</h1></div></div>${trainingSetupWarning()}
 ${plans.length?plans.map(plan=>{const days=planDays(plan.id);return `<div class="card"><div class="eyebrow">${esc(plan.objective||"Plano atual")}</div><h2>${esc(plan.title)}</h2><p class="sub">${esc(plan.notes||"Siga a prescrição e registre suas cargas a cada série.")}</p><div class="training-day-list">${days.map(day=>{const items=dayExercises(day.id);const done=data.training_sessions.filter(s=>String(s.training_day_id)===String(day.id)&&s.finished_at).length;return `<button class="training-day-card training-day-open" data-day="${day.id}"><span class="training-day-icon">✦</span><span><strong>${esc(day.title)}</strong><small>${items.length} exercício(s) · ${done} conclusão(ões)</small></span><span class="activity-arrow">›</span></button>`}).join("")||`<p class="sub">Seu Coach ainda não adicionou os treinos.</p>`}</div></div>`}).join(""):`<div class="card"><div class="empty-state"><strong>Nenhum treino prescrito ainda</strong><span>Quando seu Coach publicar sua ficha, ela aparecerá aqui.</span></div></div>`}
 <div class="card"><button class="btn btn-ghost btn-full" data-go="workouts">Registrar outra atividade</button></div>`;
}
function activeSessionForDay(dayId){return data.training_sessions.find(s=>String(s.training_day_id)===String(dayId)&&!s.finished_at)||null}
function logsFor(sessionId,exerciseId){return data.training_set_logs.filter(x=>String(x.session_id)===String(sessionId)&&String(x.exercise_id)===String(exerciseId))}
function trainingDayView(){
 const day=data.training_days.find(x=>String(x.id)===String(selectedTrainingDayId));
 if(!day)return `${pageBack()}<div class="card"><div class="empty-state"><strong>Treino não encontrado</strong><span>Volte e abra o treino novamente.</span></div></div>`;
 const items=dayExercises(day.id);const session=activeSessionForDay(day.id);
 return `${pageBack()}${coachStudentBanner()}<div class="section-head"><div><div class="eyebrow">Treino prescrito</div><h1>${esc(day.title)}</h1></div></div>
 ${isCoach?`<div class="notice"><strong>Visualização do Coach</strong><br><span class="small">Você está vendo como este treino fica para o aluno.</span></div>`:""}
 ${!isCoach&&!session?`<div class="card"><p class="sub">Ao iniciar, suas cargas e repetições serão salvas online.</p><button class="btn btn-primary btn-full" id="startTraining" data-day="${day.id}">▶ Iniciar treino</button></div>`:""}
 ${session?`<div class="training-session-status"><span>Treino em andamento</span><strong>Iniciado ${new Date(session.started_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</strong></div>`:""}
 ${items.map((it,idx)=>trainingExerciseCard(it,idx,session)).join("")||`<div class="card"><p class="sub">Nenhum exercício foi adicionado a este treino.</p></div>`}
 ${session&&!isCoach?`<button class="btn btn-primary btn-full finish-training" data-session="${session.id}">✓ Finalizar treino</button>`:""}`;
}
function trainingExerciseCard(it,idx,session){
 const ex=exById(it.exercise_id)||{name:"Exercício"};
 const logs=session?logsFor(session.id,it.exercise_id):[];
 return `<div class="card training-exercise-card"><div class="exercise-number">${idx+1}</div><h2>${esc(ex.name)}</h2><p class="sub">${esc(ex.muscle_group||"")}</p>${ex.instructions?`<div class="exercise-instructions"><strong>Execução</strong><p>${esc(ex.instructions)}</p></div>`:""}<div class="prescription-strip"><span><small>Séries</small><strong>${it.sets}</strong></span><span><small>Repetições</small><strong>${it.reps_min||"—"}${it.reps_max?`–${it.reps_max}`:""}</strong></span><span><small>Descanso</small><strong>${it.rest_seconds||0}s</strong></span></div>${it.notes?`<p class="training-note">${esc(it.notes)}</p>`:""}
 ${session&&!isCoach?`<div class="set-log-list">${Array.from({length:it.sets},(_,i)=>{const setNo=i+1;const log=logs.find(x=>Number(x.set_number)===setNo);return `<div class="set-log-row ${log?.completed?"done":""}" data-session="${session.id}" data-exercise="${it.exercise_id}" data-set="${setNo}"><span class="set-number">${setNo}</span><input class="set-weight" type="number" step="0.5" min="0" placeholder="kg" value="${log?.weight_kg??""}"><input class="set-reps" type="number" min="0" placeholder="reps" value="${log?.reps??""}"><button class="set-save ${log?.completed?"done":""}" type="button">${log?.completed?"✓":"Salvar"}</button></div>`}).join("")}</div>`:""}</div>`;
}
async function addExercise(form){
 const f=new FormData(form);const o={name:String(f.get("name")||"").trim(),muscle_group:String(f.get("muscle_group")||"").trim()||null,instructions:String(f.get("instructions")||"").trim()||null,created_by:user.id};
 if(!o.name)return toast("Digite o nome do exercício.",true);
 const r=await supabase.from("exercise_library").insert(o).select().single();if(r.error)return toast("Erro ao cadastrar exercício: "+r.error.message,true);toast("Exercício acrescentado.");await loadTrainingData(selectedStudentId||user.id);render();
}
async function editExerciseVideo(id){
 const ex=exById(id);if(!ex)return;const url=prompt("Cole o novo link do vídeo (YouTube, MP4 ou WebM):",ex.video_url||"");if(url===null)return;
 const r=await supabase.from("exercise_library").update({video_url:String(url).trim()||null,updated_at:new Date().toISOString()}).eq("id",id);if(r.error)return toast("Erro ao atualizar vídeo: "+r.error.message,true);toast("Vídeo atualizado.");await loadTrainingData(selectedStudentId||user.id);render();
}
async function removeExerciseVideo(id){
 if(!confirm("Excluir o vídeo deste exercício? O exercício continuará na biblioteca."))return;
 const r=await supabase.from("exercise_library").update({video_url:null,thumbnail_url:null,updated_at:new Date().toISOString()}).eq("id",id);if(r.error)return toast("Erro ao excluir vídeo: "+r.error.message,true);toast("Vídeo excluído.");await loadTrainingData(selectedStudentId||user.id);render();
}
async function deleteExercise(id){
 const inUse=data.training_day_exercises.some(x=>String(x.exercise_id)===String(id));
 if(inUse)return toast("Este exercício está em uma ficha. Exclua-o primeiro dos treinos em que foi prescrito.",true);
 if(!confirm("Excluir definitivamente este exercício da biblioteca?"))return;
 const r=await supabase.from("exercise_library").delete().eq("id",id);if(r.error)return toast("Erro ao excluir exercício: "+r.error.message,true);toast("Exercício excluído da biblioteca.");await loadTrainingData(selectedStudentId||user.id);render();
}
async function addTrainingPlan(form){const f=new FormData(form);const o={user_id:selectedStudentId,title:String(f.get("title")||"").trim(),objective:String(f.get("objective")||"").trim()||null,notes:String(f.get("notes")||"").trim()||null,created_by:user.id};if(!o.user_id||!o.title)return toast("Selecione o aluno e informe o nome da ficha.",true);const r=await supabase.from("training_plans").insert(o);if(r.error)return toast("Erro ao criar ficha: "+r.error.message,true);toast("Ficha criada.");await loadTrainingData(selectedStudentId);render();}
async function addTrainingDay(form){const f=new FormData(form);const o={plan_id:form.dataset.plan,title:String(f.get("title")||"").trim(),position:Number(f.get("position")||0)};if(!o.title)return;const r=await supabase.from("training_days").insert(o);if(r.error)return toast("Erro ao acrescentar treino: "+r.error.message,true);toast("Treino acrescentado.");await loadTrainingData(selectedStudentId);render();}
async function assignExercise(form){const f=new FormData(form);const exid=String(f.get("exercise_id")||"");if(!exid)return toast("Selecione um exercício.",true);const current=dayExercises(form.dataset.day);const o={training_day_id:form.dataset.day,exercise_id:exid,position:current.length+1,sets:Number(f.get("sets")||3),reps_min:Number(f.get("reps_min")||0)||null,reps_max:Number(f.get("reps_max")||0)||null,rest_seconds:Number(f.get("rest_seconds")||0)||null,notes:String(f.get("notes")||"").trim()||null};const r=await supabase.from("training_day_exercises").insert(o);if(r.error)return toast("Erro ao acrescentar exercício: "+r.error.message,true);toast("Exercício acrescentado ao treino.");await loadTrainingData(selectedStudentId);render();}
async function deleteAssigned(id){if(!confirm("Excluir este exercício deste treino?"))return;const r=await supabase.from("training_day_exercises").delete().eq("id",id);if(r.error)return toast(r.error.message,true);await loadTrainingData(selectedStudentId);render();}
async function deleteTrainingDay(id){if(!confirm("Excluir este treino e todos os exercícios dele?"))return;const r=await supabase.from("training_days").delete().eq("id",id);if(r.error)return toast(r.error.message,true);await loadTrainingData(selectedStudentId);render();}
async function deleteTrainingPlan(id){if(!confirm("Excluir esta ficha inteira? Os dias e exercícios prescritos nela também serão removidos."))return;const r=await supabase.from("training_plans").delete().eq("id",id);if(r.error)return toast(r.error.message,true);await loadTrainingData(selectedStudentId);render();}
async function startTraining(dayId){const r=await supabase.from("training_sessions").insert({user_id:user.id,training_day_id:dayId}).select().single();if(r.error)return toast("Não foi possível iniciar: "+r.error.message,true);toast("Treino iniciado. Bora! 👊");await loadTrainingData(user.id);render();}
async function saveTrainingSet(row){const sid=row.dataset.session,eid=row.dataset.exercise,setNo=Number(row.dataset.set);const weight=row.querySelector(".set-weight").value;const reps=row.querySelector(".set-reps").value;const o={session_id:sid,exercise_id:eid,set_number:setNo,weight_kg:weight===""?null:Number(weight),reps:reps===""?null:Number(reps),completed:true};const r=await supabase.from("training_set_logs").upsert(o,{onConflict:"session_id,exercise_id,set_number"}).select().single();if(r.error)return toast("Erro ao salvar série: "+r.error.message,true);row.classList.add("done");const b=row.querySelector(".set-save");b.classList.add("done");b.textContent="✓";await loadTrainingData(user.id);}
async function finishTraining(id){if(!confirm("Finalizar o treino de hoje?"))return;const r=await supabase.from("training_sessions").update({finished_at:new Date().toISOString()}).eq("id",id);if(r.error)return toast("Erro ao finalizar: "+r.error.message,true);toast("Treino finalizado e salvo. Excelente! 👊");await loadTrainingData(user.id);route="training";render();}

function workouts(){return `${pageBack()}${coachStudentBanner()}<div class="section-head"><div><div class="eyebrow">Registro de atividade</div><h1>Treinos</h1></div></div>
<form id="workoutForm" class="card"><div class="eyebrow">Registro de treino</div><h2>Como foi seu treino hoje?</h2>${studentSelect()}
<div class="field"><label>Data</label><input type="date" name="workout_date" value="${today()}" required></div>
<div class="row"><div class="field"><label>Tipo</label><select name="workout_type"><option>Musculação</option><option>Corrida</option><option>Natação</option><option>Luta</option><option>Outro</option></select></div><div class="field"><label>Duração (min)</label><input type="number" name="duration_minutes" value="0"></div></div>
<div class="row"><div class="field"><label>Grupo muscular</label><select name="muscle_group"><option>Peito e tríceps</option><option>Costas e bíceps</option><option>Pernas</option><option>Ombros</option><option>Corpo inteiro</option></select></div><div class="field"><label>Intensidade</label><select name="intensity"><option>Leve</option><option selected>Moderada</option><option>Alta</option></select></div></div>
<div class="field"><label>Calorias gastas</label><input type="number" name="calories" value="0"></div><div class="field"><label>Anotações</label><textarea name="notes"></textarea></div>
<button class="btn btn-primary btn-full">Salvar treino</button></form><div class="card"><h2>Histórico</h2>${history(data.workouts,"workouts","workout_date","duration_minutes","min","workout_type")}</div>`}

function hormones(){return `${pageBack()}${coachStudentBanner()}<div class="section-head"><div><div class="eyebrow">Acompanhamento</div><h1>Uso hormonal</h1></div></div>
<form id="hormoneForm" class="card"><div class="eyebrow">Acompanhamento semanal</div><h2>Registrar uso hormonal</h2><p class="sub">Registre apenas o que foi prescrito e acompanhado por profissional habilitado.</p><div class="notice"><strong>Acompanhamento médico</strong><br><span class="small">Não altere substância, quantidade ou frequência por conta própria.</span></div>${studentSelect()}
<div class="row"><div class="field"><label>Nome conforme prescrição</label><input name="hormone_name"></div><div class="field"><label>Quantidade</label><input name="amount" type="number" step="0.1"></div></div>
<div class="row"><div class="field"><label>Unidade</label><select name="unit"><option>mg</option><option>mL</option><option>UI</option></select></div><div class="field"><label>Frequência</label><select name="frequency"><option>1 vez por semana</option><option>2 vezes por semana</option><option>3 vezes por semana</option><option>Conforme prescrição</option></select></div></div>
<div class="row"><div class="field"><label>Dia/período</label><input name="period"></div><div class="field"><label>Data de início</label><input type="date" name="start_date" value="${today()}"></div></div>
<div class="field"><label>Observações</label><textarea name="notes"></textarea></div><button class="btn btn-primary btn-full">Salvar registro semanal</button></form>
<div class="card"><h2>Histórico</h2>${history(data.hormone_logs,"hormone_logs","start_date","amount","","hormone_name")}</div>`}

function profileView(){return `${pageBack()}<div class="section-head"><div><div class="eyebrow">Configurações do aluno</div><h1>Meu perfil</h1></div></div>
<form id="profileForm" class="card"><div class="eyebrow">Dados pessoais</div><h2>Seu cadastro</h2>
<div class="field"><label>Nome</label><input name="full_name" value="${esc(profile.full_name||"")}" required></div>
<div class="field"><label>Objetivo</label><select name="goal">${["Hipertrofia","Emagrecimento","Condicionamento","Saúde"].map(x=>`<option ${profile.goal===x?"selected":""}>${x}</option>`).join("")}</select></div>
<div class="row"><div class="field"><label>Idade</label><input type="number" name="age" value="${esc(profile.age||"")}"></div><div class="field"><label>Altura (cm)</label><input type="number" step="0.1" name="height_cm" value="${esc(profile.height_cm||"")}"></div></div>
<button class="btn btn-primary btn-full">Salvar configurações</button><p class="small">Os dados ficam salvos online na sua conta.</p></form>
<div class="card photo-cta"><div class="eyebrow">Fotos de evolução</div><h2>Seu acompanhamento visual</h2><p class="sub">Registre fotos de frente, lado e costas e acompanhe seu antes e depois.</p><button type="button" class="btn btn-primary btn-full" data-go="photos">Abrir Fotos de Evolução</button></div>`}

function coach(){return `${pageBack()}${coachStudentBanner()}<div class="section-head"><div><div class="eyebrow">Acesso profissional</div><h1>Avaliação profissional</h1></div></div>
<div class="card"><div class="eyebrow">Alunos</div><h2>Acompanhamento</h2>${studentList()}</div>
<form id="skinfoldForm" class="card"><div class="eyebrow">Avaliação por dobras cutâneas</div><h2>Composição corporal</h2>${studentSelect()}
<div class="field"><label>Data</label><input type="date" name="assessment_date" value="${today()}"></div>${pair("Tríceps (mm)","triceps","Subescapular (mm)","subscapular")}${pair("Peitoral (mm)","chest","Axilar média (mm)","midaxillary")}${pair("Suprailíaca (mm)","suprailiac","Abdominal (mm)","abdominal")}
<div class="field"><label>Coxa (mm)</label><input type="number" step="0.1" name="thigh" value="0"></div><div class="field"><label>Protocolo</label><select name="protocol"><option>Jackson & Pollock — 7 dobras</option></select></div>
<button class="btn btn-primary btn-full">Salvar avaliação profissional</button></form>
<div class="card"><div class="eyebrow">Avaliações profissionais</div><h2>${data.skinfolds.length} registros salvos</h2>${history(data.skinfolds,"skinfolds","assessment_date","protocol","","protocol")}</div>`}

function obj(form,fields){let f=new FormData(form),o={};fields.forEach(k=>o[k]=f.get(k)===""?null:f.get(k));return o}
async function insert(table,form,fields){
 let o=obj(form,fields);o.user_id=isCoach?new FormData(form).get("user_id"):user.id;
 if(!o.user_id)return toast("Selecione um aluno.",true);

 const btn=form.querySelector('button[type="submit"],button:not([type])');
 if(btn){btn.disabled=true;btn.dataset.originalText=btn.textContent;btn.textContent="Salvando online...";}

 let r=await supabase.from(table).insert(o).select("*").single();

 if(btn){btn.disabled=false;btn.textContent=btn.dataset.originalText||"Salvar";}

 if(r.error)return toast("Não foi possível salvar: "+r.error.message,true);

 toast("Salvo online com sucesso.");
 await loadTable(table,o.user_id);
 render();

 // abre o registro recém salvo para o usuário confirmar todos os campos
 const idx=data[table].findIndex(x=>x.id&&r.data?.id&&x.id===r.data.id);
 if(idx>=0)setTimeout(()=>openRecordDetail(table,idx),120);
}
function bindRoute(){
 $$("[data-go]").forEach(b=>b.onclick=()=>{route=b.dataset.go;render()});
 $$(".student-open").forEach(b=>b.onclick=()=>chooseStudent(b.dataset.student,b.dataset.next||"student"));
 $$(".student-select").forEach(s=>s.onchange=()=>chooseStudent(s.value,route));
 $$("[data-back]").forEach(b=>b.onclick=goBack);
 $$(".student-delete").forEach(b=>b.onclick=e=>{e.stopPropagation();deleteStudent(b.dataset.student)});
$$(".record-open").forEach(b=>b.onclick=()=>openRecordDetail(b.dataset.table,b.dataset.index));
 $$(".photo-delete").forEach(b=>b.onclick=()=>deleteProgressPhoto(b.dataset.photoId,b.dataset.photoPath));
 $$(".photo-open").forEach(b=>b.onclick=e=>{
   e.preventDefault();
   e.stopPropagation();
   openPhotoViewerById(b.dataset.photoId);
 });

 if($("#exerciseForm"))$("#exerciseForm").onsubmit=e=>{e.preventDefault();addExercise(e.currentTarget)};
 $$(".exercise-delete").forEach(b=>b.onclick=()=>deleteExercise(b.dataset.exercise));
 if($("#trainingPlanForm"))$("#trainingPlanForm").onsubmit=e=>{e.preventDefault();addTrainingPlan(e.currentTarget)};
 $$(".trainingDayForm").forEach(f=>f.onsubmit=e=>{e.preventDefault();addTrainingDay(f)});
 $$(".assignExerciseForm").forEach(f=>f.onsubmit=e=>{e.preventDefault();assignExercise(f)});
 $$(".assigned-delete").forEach(b=>b.onclick=()=>deleteAssigned(b.dataset.assigned));
 $$(".training-day-delete").forEach(b=>b.onclick=()=>deleteTrainingDay(b.dataset.day));
 $$(".training-plan-delete").forEach(b=>b.onclick=()=>deleteTrainingPlan(b.dataset.plan));
 $$(".training-day-open").forEach(b=>b.onclick=()=>{selectedTrainingDayId=b.dataset.day;route="trainingDay";render()});
 if($("#startTraining"))$("#startTraining").onclick=()=>startTraining($("#startTraining").dataset.day);
 $$(".set-save").forEach(b=>b.onclick=()=>saveTrainingSet(b.closest(".set-log-row")));
 $$(".finish-training").forEach(b=>b.onclick=()=>finishTraining(b.dataset.session));
 const studentSearch=$("#studentSearch");
 if(studentSearch){
   studentSearch.oninput=()=>{
     const q=studentSearch.value.trim().toLowerCase();
     $$("#studentList .student-row").forEach(row=>{
       row.hidden=!!q&&!String(row.dataset.studentName||"").includes(q);
     });
   };
 }
 if($("#photoForm")){
   bindPhotoPreviews();
   $("#photoForm").onsubmit=e=>e.preventDefault();
 }
 if($("#measureForm"))$("#measureForm").onsubmit=e=>{e.preventDefault();insert("measurements",e.currentTarget,["assessment_date","weight","waist","hip","glute","chest","arm_right","arm_left","forearm_right","forearm_left","thigh_right","thigh_left","calf_right","calf_left"])};
 if($("#mealForm"))$("#mealForm").onsubmit=e=>{e.preventDefault();insert("meals",e.currentTarget,["meal_date","meal_type","description","calories","protein","carbs","fat"])};
 if($("#workoutForm"))$("#workoutForm").onsubmit=e=>{e.preventDefault();insert("workouts",e.currentTarget,["workout_date","workout_type","duration_minutes","muscle_group","intensity","calories","notes"])};
 if($("#hormoneForm"))$("#hormoneForm").onsubmit=e=>{e.preventDefault();insert("hormone_logs",e.currentTarget,["start_date","hormone_name","amount","unit","frequency","period","notes"])};
 if($("#skinfoldForm"))$("#skinfoldForm").onsubmit=e=>{e.preventDefault();insert("skinfolds",e.currentTarget,["assessment_date","triceps","subscapular","chest","midaxillary","suprailiac","abdominal","thigh","protocol"])};
 if($("#profileForm"))$("#profileForm").onsubmit=async e=>{e.preventDefault();let o=obj(e.currentTarget,["full_name","goal","age","height_cm"]);o.updated_at=new Date().toISOString();let r=await supabase.from("profiles").update(o).eq("user_id",user.id).select().single();if(r.error)return toast("Erro ao salvar: "+r.error.message,true);profile=r.data;toast("Configurações salvas online.");render()};
}
function drawChart(){
 let cv=$("#chart");if(!cv)return;let a=[...data.measurements].slice(0,10).reverse(),dpr=devicePixelRatio||1,w=cv.clientWidth||320,h=180;cv.width=w*dpr;cv.height=h*dpr;let c=cv.getContext("2d");c.scale(dpr,dpr);c.strokeStyle="#333530";for(let i=1;i<5;i++){c.beginPath();c.moveTo(0,i*h/5);c.lineTo(w,i*h/5);c.stroke()}if(a.length<2){c.fillStyle="#a8aaa6";c.font="13px sans-serif";c.fillText("Salve 2 avaliações para ver sua evolução.",12,90);return}let vals=a.map(x=>n(x.weight)),mn=Math.min(...vals)-1,mx=Math.max(...vals)+1;c.strokeStyle="#ff6d66";c.lineWidth=3;c.beginPath();a.forEach((x,i)=>{let px=12+i*(w-24)/(a.length-1),py=h-18-((n(x.weight)-mn)/(mx-mn))*(h-36);i?c.lineTo(px,py):c.moveTo(px,py)});c.stroke()
}
init();
