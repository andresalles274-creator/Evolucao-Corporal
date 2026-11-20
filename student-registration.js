import {intakeSections} from './intake-fields.js?v=1.0.0';

export function createStudentRegistration({db,root,appUrl}){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
 const date=d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'Data não informada';
 const checked=async result=>{const r=await result;if(r.error)throw r.error;return r.data;};
 let user=null,step=0,busy=false,dirty=false,saved=false,draft={},ticket=null,ticketFingerprint='',intake=null;
 const bucket='student-intake-exams';
 const header=()=>`<header class="reg-brand"><img src="./coach-a-neon.svg" alt="Evolução Corporal"><div><strong>Evolução Corporal</strong><span>André Salles · Silvana Salles</span></div><a href="${esc(appUrl)}">Ir para o aplicativo</a></header>`;
 const status=(text,isError=false)=>{const el=root.querySelector('#reg-status');if(el){el.textContent=text;el.className=isError?'reg-status error':'reg-status';el.setAttribute('role',isError?'alert':'status');el.scrollIntoView({block:'nearest'});}};
 function field(f){
  let control;
  if(f.type==='textarea')control=`<textarea name="${f.key}" rows="3" maxlength="${f.maxlength||4000}"></textarea>`;
  else if(f.options)control=`<select name="${f.key}">${f.options.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>`;
  else control=`<input name="${f.key}" type="${f.type||'text'}" ${f.required?'required':''} ${f.type==='number'?`min="${f.min}" max="${f.max}" step="${f.step}" inputmode="${f.step===1?'numeric':'decimal'}"`:''} ${f.type==='date'?`max="${today()}"`:''} ${!['number','date','time'].includes(f.type)?`maxlength="${f.maxlength||200}"`:''} ${f.key==='full_name'?'autocomplete="name"':''} ${f.key==='phone'?'autocomplete="tel"':''}>`;
  return `<label class="${f.type==='textarea'?'reg-wide':''}">${esc(f.label)}${f.required?' <span aria-label="obrigatório">*</span>':''}${control}</label>`;
 }
 const collect=()=>{
  const fd=new FormData(root.querySelector('#intake-form')),p={};
  for(const section of intakeSections)for(const f of section.fields){const v=String(fd.get(f.key)||'').trim();if(v)p[f.key]=f.type==='number'?Number(v):v;}
  p.consent=fd.get('consent')==='on';return p;
 };
 function form(){
  root.innerHTML=header()+`<section class="reg-intro"><p class="reg-kicker">CADASTRO DO ALUNO</p><h1>Vamos conhecer você</h1><p>Preencha o que tiver disponível. Os dados de saúde, medidas e exames são opcionais e ajudam o coach a preparar seu acompanhamento.</p><p class="reg-small">Para criar o acesso, precisamos apenas do seu nome, e-mail, senha e autorização de uso dos dados.</p></section><ol class="reg-steps" aria-label="Etapas do cadastro">${[...intakeSections.map(s=>s.title),'Revisão e acesso'].map((s,i)=>`<li data-step-label="${i}">${esc(s)}</li>`).join('')}</ol><form id="intake-form" novalidate>${intakeSections.map((s,i)=>`<section class="reg-card reg-step" data-step="${i}" ${i?'hidden':''}><h2>${esc(s.title)}</h2><p class="reg-muted">${i===0?'Somente o nome é obrigatório nesta etapa.':i===2?'Se não tiver algo a informar, deixe em branco. Não é necessário realizar exames para concluir o cadastro.':i===3?'Use as medidas que já tem. Deixe os campos desconhecidos em branco.':'Preenchimento opcional.'}</p><div class="reg-grid">${s.fields.map(field).join('')}</div></section>`).join('')}<section class="reg-card reg-step" data-step="4" hidden><h2>Revise e crie seu acesso</h2><div id="reg-review"></div><div id="reg-account"><h3>Seu login no aplicativo</h3><p>O e-mail e a senha abaixo serão usados no Evolução Corporal.</p><label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Crie uma senha<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>Confirme a senha<input name="password_confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><p class="reg-small">Use pelo menos 8 caracteres. Sua senha não será exibida ao coach.</p></div><p id="reg-existing" hidden></p><label class="reg-consent"><input name="consent" type="checkbox" required><span>Autorizo o uso dos dados pessoais e de saúde que informei para meu acompanhamento pela consultoria Evolução Corporal. Esses dados ficam acessíveis a mim e aos coaches autorizados. Posso solicitar correção ou exclusão ao coach.</span></label><p class="reg-small">Os arquivos dos exames poderão ser anexados depois de criar e, quando solicitado, confirmar a conta.</p></section><p id="reg-status" class="reg-status" role="status" aria-live="polite"></p><div class="reg-actions"><button type="button" id="reg-back">Voltar</button><button type="submit" class="reg-primary" id="reg-next">Continuar</button></div></form><footer class="reg-footer"><button type="button" id="reg-login">Já tenho uma conta</button></footer>`;
  for(const [k,v]of Object.entries(draft)){const el=root.querySelector(`[name="${k}"]`);if(el){if(el.type==='checkbox')el.checked=v===true;else el.value=v;}}
  if(user){root.querySelector('#reg-account').hidden=true;root.querySelectorAll('#reg-account input').forEach(el=>el.disabled=true);const el=root.querySelector('#reg-existing');el.hidden=false;el.textContent='Você está conectado como '+user.email+'. Este será seu acesso ao aplicativo.';}
  root.querySelector('#reg-back').onclick=()=>{if(step>0){step--;showStep();}};
  root.querySelector('#reg-login').onclick=()=>{draft=collect();login();};
  root.querySelector('#intake-form').oninput=()=>{dirty=true;};
  root.querySelector('#intake-form').onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   if(!validateStep())return;
   if(step<4){draft=collect();step++;showStep();return;}
   const p=collect();
   for(let i=0;i<4;i++){const invalid=[...root.querySelectorAll(`[data-step="${i}"] input,[data-step="${i}"] select,[data-step="${i}"] textarea`)].find(el=>!el.checkValidity());if(invalid){step=i;showStep();invalid.reportValidity();return;}}
   if(!p.full_name||p.full_name.length<2){step=0;showStep();status('Preencha seu nome completo.',true);return;}
   const fd=new FormData(e.currentTarget);
   if(!user&&fd.get('password')!==fd.get('password_confirm')){status('As senhas precisam ser iguais.',true);return;}
   draft=p;busy=true;lock(true);status('Salvando seu cadastro…');
   try{
    if(user){await checked(db.rpc('submit_student_intake',{intake_payload:p}));}
    else{
     const email=String(fd.get('email')).trim().toLowerCase();const fingerprint=JSON.stringify([email,p]);
     if(!ticket||ticketFingerprint!==fingerprint){ticket=await checked(db.rpc('prepare_student_registration',{registration_email:email,intake_payload:p}));ticketFingerprint=fingerprint;}
     const r=await db.auth.signUp({email,password:String(fd.get('password')),options:{emailRedirectTo:appUrl,data:{full_name:p.full_name,goal:p.goal||'',gender:p.gender||null,registration_ticket:ticket}}});
     if(r.error)throw r.error;
     if(!r.data.session){saved=true;dirty=false;root.querySelectorAll('input[type="password"]').forEach(el=>el.value='');pending(email);return;}
     user=r.data.session.user;
    }
    intake=await checked(db.from('student_intakes').select('*').eq('user_id',user.id).single());
    if(!intake)throw new Error('Entre na sua conta para confirmar o recebimento da ficha.');
    saved=true;dirty=false;draft={};await attachments();
   }catch(e){status(friendly(e),true);}
   finally{busy=false;lock(false);}
  };
  showStep(false);
 }
 function validateStep(){const inputs=root.querySelectorAll(`[data-step="${step}"] input,[data-step="${step}"] textarea,[data-step="${step}"] select`);for(const el of inputs)if(!el.disabled&&!el.checkValidity()){el.reportValidity();return false;}return true;}
 function showStep(scroll=true){
  root.querySelectorAll('[data-step]').forEach(s=>s.hidden=Number(s.dataset.step)!==step);
  root.querySelectorAll('[data-step-label]').forEach(el=>{el.classList.toggle('current',Number(el.dataset.stepLabel)===step);if(Number(el.dataset.stepLabel)===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  root.querySelector('#reg-back').hidden=step===0;
  root.querySelector('#reg-next').textContent=step===4?(user?'Salvar cadastro':'Criar acesso e salvar cadastro'):'Continuar';
  if(step===4){const p=collect();root.querySelector('#reg-review').innerHTML=intakeSections.map(s=>`<details><summary>${s.title} · ${s.fields.filter(f=>p[f.key]!==undefined).length} campo(s) preenchido(s)</summary><dl>${s.fields.filter(f=>p[f.key]!==undefined).map(f=>`<div><dt>${f.label}</dt><dd>${esc(f.options?f.options.find(([v])=>v===p[f.key])?.[1]||p[f.key]:p[f.key])}</dd></div>`).join('')||'<p>Você poderá informar esses dados ao coach depois.</p>'}</dl></details>`).join('');}
  status('');if(scroll)root.querySelector(`[data-step="${step}"]`).scrollIntoView({block:'start'});
 }
 function lock(v){root.querySelectorAll('button,input,textarea,select').forEach(el=>{if(el.closest('#reg-account')&&user)return;el.disabled=v;});}
 function friendly(e){const m=String(e.message||e);if(/already registered|already exists|already been registered/i.test(m))return 'Este e-mail já tem uma conta. Use “Já tenho uma conta” para entrar e concluir a ficha.';if(/email.*confirm/i.test(m))return 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.';if(/rate limit|too many/i.test(m))return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';if(/fetch|network|load failed/i.test(m))return 'Falha de conexão. Seus campos continuam nesta página. Tente novamente.';return 'Não foi possível concluir: '+m;}
 function pending(email){root.innerHTML=header()+`<section class="reg-card reg-result"><span class="reg-result-icon">✓</span><h1>Confira seu e-mail</h1><p>Enviamos as instruções de confirmação para <strong>${esc(email)}</strong>, quando necessário. Confira também a pasta de spam.</p><p>Para um cadastro novo, sua ficha fica guardada enquanto você confirma o e-mail. Depois, entre com o mesmo e-mail e senha e volte a este link para anexar exames, se tiver.</p><p class="reg-small">Se este e-mail já tinha uma conta, entre para enviar a ficha completa.</p><button type="button" id="reg-enter" class="reg-primary">Entrar e continuar</button><p id="reg-status" role="status"></p></section>`;root.querySelector('#reg-enter').onclick=()=>login(email);}
 function login(email=''){
  root.innerHTML=header()+`<section class="reg-card"><h1>Entrar para continuar</h1><p>Use a conta do Evolução Corporal. Não precisa criar outra senha.</p><form id="reg-signin"><label>E-mail<input name="email" type="email" autocomplete="email" required value="${esc(email)}"></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><p id="reg-status" class="reg-status" role="status" aria-live="polite"></p><button class="reg-primary" type="submit">Entrar</button><button type="button" id="reg-return">Voltar ao cadastro</button><button type="button" id="reg-forgot">Esqueci minha senha</button></form></section>`;
  root.querySelector('#reg-return').onclick=()=>{step=0;form();};
  root.querySelector('#reg-forgot').onclick=async()=>{const el=root.querySelector('[name="email"]');if(!el.reportValidity())return;try{await checked(db.auth.resetPasswordForEmail(el.value.trim(),{redirectTo:appUrl}));status('Confira seu e-mail para redefinir a senha.');}catch(e){status(friendly(e),true);}};
  root.querySelector('#reg-signin').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);busy=true;lock(true);try{await checked(db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))}));await start();}catch(e){status(friendly(e),true);}finally{busy=false;lock(false);}};
 }
 async function attachments(){
  root.innerHTML=header()+`<section class="reg-intro"><p class="reg-kicker">FICHA RECEBIDA</p><h1>${intake?.finalized_at?'Seu cadastro está concluído':'Agora, os exames que você tiver'}</h1><p>Seus dados foram salvos e já estão disponíveis para o coach. Os anexos são opcionais: você pode concluir sem enviar nenhum arquivo.</p></section><section class="reg-card"><h2>Anexar exame</h2><p class="reg-muted">PDF, JPG, PNG ou WebP, até 15 MB por arquivo. Envie os documentos que já possui.</p><form id="reg-upload"><label>Nome do exame<input name="title" maxlength="160" placeholder="Ex.: Hemograma"></label><label>Data do exame, se souber<input name="exam_date" type="date" max="${today()}"></label><label>Observações<textarea name="notes" rows="2" maxlength="4000"></textarea></label><label>Arquivo do exame<input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></label><button type="submit">Enviar exame</button></form></section><section class="reg-card"><h2>Exames enviados</h2><div id="reg-file-list" aria-live="polite">Carregando…</div></section><p id="reg-status" class="reg-status" role="status" aria-live="polite"></p><div class="reg-actions"><button type="button" class="reg-primary" id="reg-finish">Concluir cadastro e abrir aplicativo</button></div><p class="reg-small">Você usa o mesmo e-mail e senha no aplicativo. Pode voltar a este link para enviar outros exames.</p>`;
  root.querySelector('#reg-upload').onsubmit=async e=>{
   e.preventDefault();if(busy)return;const form=e.currentTarget,fd=new FormData(form),file=fd.get('file');
   const types={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
   if(!file?.size||!types[file.type]||file.size>15*1024*1024){status('Selecione PDF, JPG, PNG ou WebP de até 15 MB.',true);return;}
   busy=true;lock(true);status('Enviando arquivo…');const path=`${user.id}/${crypto.randomUUID()}.${types[file.type]}`;
   try{await checked(db.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false}));
    try{await checked(db.from('student_intake_files').insert({user_id:user.id,title:String(fd.get('title')).trim()||file.name.slice(0,160),exam_date:fd.get('exam_date')||null,notes:String(fd.get('notes')||''),storage_path:path,file_name:file.name.slice(0,255),file_size:file.size,mime_type:file.type}).select().single());}
    catch(e){await db.storage.from(bucket).remove([path]);throw e;}
    form.reset();status('Exame enviado e disponível para o coach.');await listFiles();
   }catch(e){status(friendly(e),true);}finally{busy=false;lock(false);}
  };
  root.querySelector('#reg-finish').onclick=async()=>{if(busy)return;busy=true;lock(true);try{await checked(db.rpc('finalize_student_intake'));dirty=false;saved=true;root.innerHTML=header()+`<section class="reg-card reg-result"><span class="reg-result-icon">✓</span><h1>Cadastro concluído!</h1><p>Sua ficha está disponível para o coach. Use o e-mail e a senha que cadastrou para entrar no aplicativo.</p><a class="reg-primary" href="${esc(appUrl)}">Abrir Evolução Corporal</a></section>`;}catch(e){status(friendly(e),true);}finally{busy=false;lock(false);}};
  await listFiles();
 }
 async function listFiles(){const el=root.querySelector('#reg-file-list');try{const rows=await checked(db.from('student_intake_files').select('*').eq('user_id',user.id).order('created_at',{ascending:false}));el.innerHTML=rows.length?rows.map(r=>`<article class="reg-file"><div><strong>${esc(r.title)}</strong><small>${date(r.exam_date)} · ${esc(r.file_name)}</small></div><button type="button" data-file="${esc(r.id)}">Abrir arquivo</button></article>`).join(''):'<p class="reg-muted">Nenhum exame anexado. Você pode concluir sem anexos.</p>';el.querySelectorAll('[data-file]').forEach(b=>b.onclick=async()=>{const row=rows.find(r=>r.id===b.dataset.file),win=window.open('about:blank','_blank');if(win)win.opener=null;try{const data=await checked(db.storage.from(bucket).createSignedUrl(row.storage_path,300));if(win)win.location=data.signedUrl;else{const a=document.createElement('a');a.href=data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir exame';b.after(a);}}catch(e){win?.close();status(friendly(e),true);}});}catch(e){el.textContent='Não foi possível carregar os anexos.';const retry=document.createElement('button');retry.type='button';retry.textContent='Tentar novamente';retry.onclick=listFiles;el.appendChild(retry);}}
 async function start(){
  try{
   const {session}=await checked(db.auth.getSession());user=session?(await checked(db.auth.getUser())).user:null;
   if(user){
    const coach=await checked(db.rpc('is_coach'));
    if(coach){root.innerHTML=header()+`<section class="reg-card"><h1>Link de cadastro para seus alunos</h1><p>Você está conectado como coach. Para um aluno preencher, envie este link ou abra-o em outro navegador, sem a sua conta conectada.</p><label>Link do cadastro<input value="${esc(new URL('./cadastro.html',appUrl).href)}" readonly></label><button type="button" id="reg-copy" class="reg-primary">Copiar link de cadastro</button><p id="reg-status" class="reg-status" role="status"></p></section>`;root.querySelector('#reg-copy').onclick=async()=>{try{await navigator.clipboard.writeText(new URL('./cadastro.html',appUrl).href);status('Link copiado para enviar ao aluno.');}catch{status('Selecione e copie o link acima.');}};return;}
    intake=await checked(db.from('student_intakes').select('*').eq('user_id',user.id).maybeSingle());
    if(intake){saved=true;dirty=false;await attachments();return;}
    const p=await checked(db.from('profiles').select('*').eq('user_id',user.id).maybeSingle());
    draft={full_name:p?.full_name||user.user_metadata?.full_name||'',goal:p?.goal||'',height_cm:p?.height_cm||'',age:p?.age||'',...draft};
   }
   step=0;form();
  }catch(e){root.innerHTML=header()+`<section class="reg-card"><h1>Vamos tentar novamente</h1><p>Não foi possível carregar o cadastro. Verifique sua conexão.</p><button type="button" id="reg-retry">Tentar novamente</button></section>`;root.querySelector('#reg-retry').onclick=start;}
 }
 window.addEventListener('beforeunload',e=>{if(dirty&&!saved){e.preventDefault();e.returnValue='';}});
 return {start};
}
