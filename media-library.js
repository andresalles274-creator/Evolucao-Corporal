const SLOTS={male_image_url:'Imagem masculina',female_image_url:'Imagem feminina',male_video_url:'Vídeo masculino',female_video_url:'Vídeo feminino'};
const TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
export const normalizeName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function validateMediaFile(key,file){
 const image=key.endsWith('image_url');
 if(!SLOTS[key]||!file?.size||!TYPES[file.type]||!file.type.startsWith(image?'image/':'video/')||file.size>(image?10:50)*1024*1024)
  throw new Error(image?'Escolha JPG, PNG ou WebP com até 10 MB.':'Escolha MP4 ou WebM com até 50 MB.');
}
export function similarExercises(source,rows){
 const tokens=normalizeName(source.name).split(/\s+/).filter(t=>t.length>2&&!['com','sem','para','dos','das'].includes(t));
 return rows.filter(e=>e.id!==source.id&&normalizeName(e.muscle_group)===normalizeName(source.muscle_group)&&tokens.some(t=>normalizeName(e.name).split(/\s+/).includes(t)));
}
export async function publishMedia({db,userId,targets,files}){
 if(!userId||!targets.length||targets.length>200)throw new Error('Selecione de 1 a 200 exercícios.');
 const entries=Object.entries(files);
 if(!entries.length)throw new Error('Escolha pelo menos uma mídia.');
 entries.forEach(([key,file])=>validateMediaFile(key,file));
 const patch={};
 // Unique uploads: no overwrite or deletion of old files, including on ambiguous connection failures.
 for(const [key,file] of entries){
  const path=`${userId}/${targets[0].id}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  const bucket=db.storage.from('exercise-library-media');
  const result=await bucket.upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
  if(result.error)throw new Error('Falha ao enviar arquivo. Nenhuma substituição foi solicitada. '+result.error.message);
  const url=bucket.getPublicUrl(path).data?.publicUrl;
  if(!/^https:\/\/[^\s"'<>]+$/.test(url||''))throw new Error('Endereço de mídia inválido. Nenhuma substituição foi solicitada.');
  patch[key]=url;
 }
 const result=await db.rpc('coach_replace_exercise_media',{p_ids:targets.map(e=>e.id),p_patch:patch,p_expected:Object.fromEntries(targets.map(e=>[e.id,e.updated_at]))});
 if(result.error)throw new Error(result.error.message+' Atualize a biblioteca para conferir o resultado antes de reenviar.');
 if(!Array.isArray(result.data)||result.data.length!==targets.length)throw new Error('Não foi possível confirmar a publicação. Atualize a biblioteca antes de reenviar.');
 return result.data;
}
export function createMediaLibrary({db,authorized,esc,notify,onSaved,exit}){
 let root=null,rows=[],selected=new Set(),source=null,drafts={},query='',group='',busy=false,generation=0;
 const preview=(url,key)=>{
  if(!/^https:\/\/[^\s"'<>]+$/.test(url||'')&&!String(url||'').startsWith('blob:'))return '<p class="sub">Sem mídia específica. A demonstração geral existente continua disponível.</p>';
  return key.endsWith('image_url')?`<img src="${esc(url)}" alt="${esc(SLOTS[key])}" loading="lazy">`:`<video src="${esc(url)}" controls playsinline preload="none"></video>`;
 };
 function clearDrafts(){Object.values(drafts).forEach(d=>URL.revokeObjectURL(d.url));drafts={};}
 function status(message){const el=root?.querySelector('[data-status]');if(el)el.textContent=message;}
 async function mount(container){
  const stamp=++generation;root=container;clearDrafts();selected.clear();source=null;query='';group='';
  if(!authorized())return;
  root.innerHTML='<div class="card"><p role="status">Carregando Biblioteca de Mídias…</p></div>';
  try{
   const collected=[];
   for(let start=0;;start+=500){
    const r=await db.from('exercise_library').select('*').order('name').order('id').range(start,start+499);
    if(r.error)throw r.error;
    collected.push(...r.data);if(r.data.length<500)break;
   }
   if(stamp!==generation||!authorized()||!root.isConnected)return;
   rows=collected;draw();
  }catch(e){if(stamp!==generation||!authorized()||!root.isConnected)return;root.innerHTML=`<div class="card"><h1>Biblioteca de Mídias</h1><p role="alert">${esc(e.message||'Falha na conexão.')}</p><button class="btn btn-primary" data-retry>Tentar novamente</button><button class="btn btn-ghost" data-exit>Voltar ao painel</button></div>`;root.querySelector('[data-retry]').onclick=()=>mount(container);root.querySelector('[data-exit]').onclick=exit;}
 }
 function draw(){
  root.innerHTML=`<section class="media-library"><button class="btn btn-ghost" data-exit>Voltar ao painel</button><button class="btn btn-ghost" data-refresh>Atualizar biblioteca</button><div class="section-head"><div><div class="eyebrow">Painel do Coach</div><h1>Biblioteca de Mídias</h1></div></div><p class="sub">Escolha um exercício, confira as mídias e selecione as substituições. A atualização vale para todos os alunos que usam o mesmo exercício. Os demais arquivos e as fichas continuam preservados.</p><div class="card"><div class="media-filters"><label>Pesquisar exercício<input type="search" data-search placeholder="Ex.: leg press" value="${esc(query)}"></label><label>Grupo muscular<select data-group><option value="">Todos os grupos</option>${[...new Set(rows.map(e=>e.muscle_group).filter(Boolean))].sort().map(g=>`<option ${g===group?'selected':''} value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label></div><p data-count class="sub" aria-live="polite"></p><div class="media-results" data-results></div></div><div data-editor></div><p data-status role="status" aria-live="polite"></p></section>`;
  root.querySelector('[data-exit]').onclick=()=>{if(!busy){clearDrafts();exit();}};
  root.querySelector('[data-refresh]').onclick=()=>{if(!busy&&(!Object.keys(drafts).length||confirm('Descartar as prévias ainda não salvas e atualizar a biblioteca?')))mount(root);};
  root.querySelector('[data-search]').oninput=e=>{query=e.target.value;drawList();};
  root.querySelector('[data-group]').onchange=e=>{group=e.target.value;drawList();};
  drawList();drawEditor();
 }
 function drawList(){
  const filtered=rows.filter(e=>(!group||e.muscle_group===group)&&normalizeName(e.name+' '+(e.alternate_name||'')).includes(normalizeName(query)));
  root.querySelector('[data-count]').textContent=`${filtered.length} exercício(s) encontrado(s) · ${selected.size} selecionado(s)`;
  root.querySelector('[data-results]').innerHTML=filtered.map(e=>`<div class="media-result"><label><input type="checkbox" data-select="${esc(e.id)}" ${selected.has(e.id)?'checked':''} ${busy?'disabled':''}><span><strong>${esc(e.name)}</strong><small>${esc(e.muscle_group||'Sem grupo')}${e.is_active===false?' · Inativo':''}</small></span></label><button type="button" class="btn btn-ghost" data-open="${esc(e.id)}" ${busy?'disabled':''}>Ver mídias</button></div>`).join('')||'<p class="sub">Nenhum exercício encontrado.</p>';
  root.querySelectorAll('[data-select]').forEach(el=>el.onchange=()=>{
   if(el.checked)selected.add(el.dataset.select);else selected.delete(el.dataset.select);
   drawList();updateSelection();
  });
  root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>{
   if(Object.keys(drafts).length&&!confirm('Descartar a prévia ainda não salva para abrir outro exercício?'))return;
   clearDrafts();source=rows.find(e=>e.id===el.dataset.open);selected=new Set([source.id]);drawList();drawEditor();
   root.querySelector('[data-editor]').scrollIntoView({behavior:'smooth',block:'start'});
  });
 }
 function updateSelection(){
  root.querySelectorAll('[data-similar]').forEach(el=>el.checked=selected.has(el.dataset.similar));
  const selection=root.querySelector('[data-selection]');
  if(selection)selection.innerHTML=`<p><strong>${selected.size} exercício(s) receberão as mídias escolhidas:</strong></p><ul>${rows.filter(e=>selected.has(e.id)).map(e=>`<li>${esc(e.name)}</li>`).join('')}</ul>`;
 }
 function drawEditor(){
  const editor=root.querySelector('[data-editor]');
  if(!source){editor.innerHTML='<div class="card"><p>Toque em Ver mídias para editar um exercício e selecionar outros semelhantes.</p></div>';return;}
  const similar=similarExercises(source,rows);
  editor.innerHTML=`<form class="card media-editor"><h2>${esc(source.name)}</h2><p class="sub">Selecione somente os arquivos que deseja substituir. Os campos sem arquivo escolhido serão mantidos em cada exercício.</p><div class="media-slot-grid">${Object.entries(SLOTS).map(([key,label])=>`<section class="media-slot"><h3>${label}</h3><small>Mídia atual</small><div class="media-preview">${preview(source[key]||source[key.endsWith('image_url')?'thumbnail_url':'video_url'],key)}</div><label>Escolher substituição<input type="file" data-file="${key}" accept="${key.endsWith('image_url')?'image/jpeg,image/png,image/webp':'video/mp4,video/webm'}"></label><small>${key.endsWith('image_url')?'Até 10 MB':'Até 50 MB'}</small><div data-draft="${key}"></div></section>`).join('')}</div><div class="media-batch"><h3>Atualização em massa</h3><p class="sub">Sugestões do mesmo grupo muscular. Marque apenas as variações que devem usar a mesma demonstração.</p>${similar.map(e=>`<label><input type="checkbox" data-similar="${esc(e.id)}" ${selected.has(e.id)?'checked':''}>${esc(e.name)}</label>`).join('')||'<p class="sub">Nenhuma sugestão. Use a pesquisa para selecionar outros exercícios.</p>'}<div data-selection></div></div><button class="btn btn-primary" type="submit">Revisar e salvar substituições</button></form>`;
  updateSelection();
  editor.querySelectorAll('[data-file]').forEach(input=>input.onchange=()=>{
   const key=input.dataset.file,file=input.files[0],slot=editor.querySelector(`[data-draft="${key}"]`);
   if(drafts[key])URL.revokeObjectURL(drafts[key].url);delete drafts[key];slot.innerHTML='';
   if(!file)return;
   try{validateMediaFile(key,file);const url=URL.createObjectURL(file);drafts[key]={file,url};slot.innerHTML=`<strong>Prévia da substituição</strong><div class="media-preview">${preview(url,key)}</div><button type="button" class="btn btn-ghost" data-cancel>Cancelar esta substituição</button>`;slot.querySelector('[data-cancel]').onclick=()=>{URL.revokeObjectURL(drafts[key].url);delete drafts[key];input.value='';slot.innerHTML='';};status('Prévia pronta. Nenhuma mídia foi salva ainda.');}
   catch(e){input.value='';status(e.message);}
  });
  editor.querySelectorAll('[data-similar]').forEach(el=>el.onchange=()=>{if(el.checked)selected.add(el.dataset.similar);else selected.delete(el.dataset.similar);drawList();updateSelection();});
  editor.querySelector('form').onsubmit=async event=>{
   event.preventDefault();if(busy||!authorized())return;
   const targets=rows.filter(e=>selected.has(e.id));
   if(!targets.length||!Object.keys(drafts).length){status('Selecione ao menos um exercício e um arquivo de substituição.');return;}
   if(targets.length>200){status('Selecione no máximo 200 exercícios por vez.');return;}
   const labels=Object.keys(drafts).map(key=>SLOTS[key]).join(', ');
   if(!confirm(`Confirmar ${targets.length>1?'substituição em massa':'substituição'}?\n\n${labels}\n\n${targets.map(e=>e.name).join('\n')}\n\nTodos os alunos que usam estes exercícios receberão a atualização. Os outros campos serão preservados.`))return;
   busy=true;root.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);status('Enviando arquivos e salvando substituições… Aguarde.');
   try{
    const updated=await publishMedia({db,userId:authorized(),targets,files:Object.fromEntries(Object.entries(drafts).map(([k,d])=>[k,d.file]))});
    rows=rows.map(e=>updated.find(u=>u.id===e.id)||e);source=rows.find(e=>e.id===source.id);clearDrafts();onSaved(updated);notify(`Mídias publicadas em ${targets.length} exercício(s).`);busy=false;draw();status('Substituições salvas. Todos os alunos que utilizam estes exercícios receberão as mídias atualizadas.');
   }catch(e){status(e.message||'Falha de conexão. Atualize antes de tentar novamente.');}
   finally{busy=false;root?.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);}
  };
 }
 return {mount,dispose(){if(busy)return;generation++;clearDrafts();root=null;}};
}
