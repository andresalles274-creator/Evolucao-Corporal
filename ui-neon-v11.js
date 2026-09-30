// Painel Coach v11 — composição baseada na referência visual aprovada.
(function(){
 const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
 const coach=()=>/Painel do Coach/i.test(document.body.innerText);
 function openNewStudent(){
  q('.neon-student-modal')?.remove(); const m=document.createElement('div'); m.className='neon-student-modal record-overlay';
  m.innerHTML=`<div class="record-modal neon-add-card"><div class="record-modal-head"><div><div class="eyebrow">NOVO ALUNO</div><h2>Adicionar aluno</h2></div><button class="record-x" type="button">×</button></div><p class="sub">Envie o link do Evolução Corporal para o aluno criar a conta. Após o cadastro ele aparecerá no painel.</p><button class="btn btn-primary btn-full neon-copy-link" type="button">Copiar link para o aluno</button><button class="btn btn-ghost btn-full neon-close" type="button">Fechar</button></div>`;
  document.body.appendChild(m); const close=()=>m.remove(); q('.record-x',m).onclick=close;q('.neon-close',m).onclick=close;m.onclick=e=>{if(e.target===m)close()};q('.neon-copy-link',m).onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname);q('.neon-copy-link',m).textContent='Link copiado ✓'}catch(_){prompt('Copie este endereço:',location.href)}};
 }
 function nav(){
  const n=q('.bottomnav'); if(!n||!coach())return; if(n.dataset.neon==='3')return; n.dataset.neon='3';
  const routes={};qa('[data-route]',n).forEach(b=>routes[b.dataset.route]=b);
  n.innerHTML=`<button class="navbtn active" data-ref="home"><span class="ico">⌂</span><span>Início</span></button><button class="navbtn" data-ref="measures"><span class="ico">▥</span><span>Medidas</span></button><button class="navbtn neon-add"><span class="plus">+</span><span>Novo aluno</span></button><button class="navbtn" data-ref="students"><span class="ico">♟</span><span>Alunos</span></button><button class="navbtn" data-ref="records"><span class="ico">▤</span><span>Registros</span></button>`;
  q('[data-ref="home"]',n).onclick=()=>routes.home?.click(); q('[data-ref="measures"]',n).onclick=()=>routes.measures?.click(); q('.neon-add',n).onclick=openNewStudent; q('[data-ref="students"]',n).onclick=()=>q('.ref-students')?.scrollIntoView({behavior:'smooth',block:'center'}); q('[data-ref="records"]',n).onclick=()=>q('.ref-records')?.scrollIntoView({behavior:'smooth',block:'center'});
 }
 function decorateBilling(b){
  if(!b)return;b.classList.add('ref-billing','floating-card');
  const title=q('.billing-title',b);if(title&&!q('.billing-all',title)){const a=document.createElement('button');a.className='billing-all';a.type='button';a.textContent='Ver todas  →';title.appendChild(a)}
  const k=qa('.billing-kpi',b),icons=['♟','□','◷'];k.forEach((x,i)=>{if(!q('.kpi-ico',x)){const s=document.createElement('span');s.className='kpi-ico';s.textContent=icons[i]||'•';x.prepend(s)}});
 }
 function layout(){
  if(!coach())return; const main=q('#content');if(!main)return;
  const hero=q('.premium-brand',main), billing=q('.billing-v11',main), welcome=q('.coach-welcome',main); const cards=qa(':scope > .card',main);
  const featured=cards.find(c=>/Abrir ficha completa/i.test(c.innerText)); const students=cards.find(c=>/Acompanhamento[\s\S]*Alunos/i.test(c.innerText)); const records=cards.find(c=>/Últimos registros/i.test(c.innerText));
  if(welcome)welcome.classList.add('ref-welcome');
  if(hero){
    hero.classList.add('ref-hero','ref-hero-approved');
    const content=q('.premium-brand-content',hero);
    const logo=q('.premium-logo',hero); if(logo) logo.style.display='none';
    const h=q('h1',hero);if(h)h.innerHTML='Evolução<br><span>Corporal</span>';
    const names=q('.names',hero);if(names)names.textContent='André Salles • Silvana Salles';
    const tag=q('.tagline',hero);if(tag)tag.textContent='COACHING ONLINE';
    if(content&&!q('.hero-coach-kicker',hero)){const k=document.createElement('div');k.className='hero-coach-kicker';k.textContent='PAINEL DO COACH';content.prepend(k)}
    if(!q('.hero-motto',hero)){const m=document.createElement('div');m.className='hero-motto';m.innerHTML='DISCIPLINA<br>GERA<br>RESULTADOS<span></span>';content?.appendChild(m)}
  }
  decorateBilling(billing);
  if(featured){featured.classList.add('ref-featured','floating-card');const e=q('.eyebrow',featured);if(e)e.textContent='★  ALUNO EM DESTAQUE';if(!q('.featured-profile',featured)){const b=document.createElement('button');b.className='featured-profile';b.type='button';b.textContent='Ver perfil  →';b.onclick=()=>q('.btn-primary',featured)?.click();featured.appendChild(b)}}
  if(students)students.classList.add('ref-students','floating-card'); if(records)records.classList.add('ref-records','floating-card');
  if(students&&records){let grid=q('.ref-lower-grid',main);if(!grid){grid=document.createElement('div');grid.className='ref-lower-grid';students.before(grid);grid.append(students,records);const promo=document.createElement('div');promo.className='ref-promo';promo.innerHTML='<b>↗</b><strong>Mais resultados<br>para seus alunos</strong><span>Acompanhe a evolução e mantenha todos no foco.</span>';grid.appendChild(promo)}}
  if(hero&&billing&&hero.nextElementSibling!==billing)hero.after(billing);
 }
 function run(){nav();layout()}
 let lock=false;new MutationObserver(()=>{if(lock)return;lock=true;requestAnimationFrame(()=>{run();lock=false})}).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',run);setTimeout(run,200);setTimeout(run,900);
})();