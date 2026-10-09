// Evolução Corporal v11 — composição neon do Coach + painel visual dos alunos.
(function(){
 const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
 const coach=()=>/Painel do Coach/i.test(document.body.innerText);
 const student=()=>!!q('.topbar')&&!coach();
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
 function studentStyle(){
  if(q('#student-neon-style'))return;const s=document.createElement('style');s.id='student-neon-style';s.textContent=`
  body.student-neon{--accent:#caff18!important;--primary:#caff18!important;--gold:#caff18!important} body.student-neon .topbar,body.student-neon .bottomnav{background:#080c09!important;border-color:rgba(202,255,24,.25)!important} body.student-neon .navbtn.active,body.student-neon .navbtn.active .ico,body.student-neon .eyebrow,body.student-neon .metric .small,body.student-neon .premium-brand .tagline{color:#caff18!important} body.student-neon .navbtn.active{background:rgba(202,255,24,.10)!important} body.student-neon .card,body.student-neon .metric{border-color:rgba(202,255,24,.25)!important} body.student-neon .premium-brand{margin:14px 22px 18px!important;min-height:285px!important;border-radius:30px!important;border:1px solid rgba(202,255,24,.34)!important;background:linear-gradient(180deg,rgba(4,7,5,.08),rgba(4,7,5,.58)),url('./brand-background.jpg') center/cover no-repeat!important;box-shadow:0 20px 48px #000b,0 0 24px rgba(202,255,24,.08)!important;overflow:hidden!important}
  body.student-neon .premium-brand-content{min-height:285px!important;padding:28px!important;display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-items:center!important;text-align:center!important;background:linear-gradient(180deg,transparent 28%,rgba(3,5,4,.72) 100%)!important}
  body.student-neon .premium-logo{display:none!important} body.student-neon .premium-brand h1{font-size:38px!important;line-height:1!important;color:#fff!important;margin:0!important;text-shadow:0 3px 16px #000!important} body.student-neon .premium-brand .names{font-size:17px!important;color:#fff!important;margin-top:9px!important} body.student-neon .premium-brand .tagline{font-size:10px!important;letter-spacing:.20em!important;color:#caff18!important;margin-top:8px!important;text-transform:uppercase!important}
  body.student-neon .student-billing-card{margin:0 22px 18px!important;padding:18px!important;border:1px solid rgba(202,255,24,.55)!important;border-radius:24px!important;background:linear-gradient(145deg,#111713,#080c09)!important;box-shadow:0 18px 38px #0009,0 0 18px rgba(202,255,24,.09)!important} body.student-neon .student-billing-card .eyebrow{margin-bottom:6px!important} body.student-neon .student-billing-row{display:flex;justify-content:space-between;align-items:center;gap:12px} body.student-neon .student-billing-status{font-size:21px;font-weight:800;color:#caff18} body.student-neon .student-billing-date{color:#c7cec9;font-size:12px;text-align:right}
  body.student-neon .welcome-row{margin:0 22px 18px!important} body.student-neon .welcome-row h2{font-size:34px!important;color:#fff!important;margin:2px 0!important} body.student-neon .metric-grid{margin:0 22px 18px!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important} body.student-neon .metric{background:linear-gradient(145deg,#121914,#080c09)!important;border:1px solid rgba(202,255,24,.30)!important;border-radius:20px!important;min-height:132px!important;box-shadow:0 15px 28px #0008!important} body.student-neon .metric strong{color:#fff!important} body.student-neon .metric .metric-icon{color:#caff18!important}
  body.student-neon .student-main-actions{margin:0 22px 18px!important;padding:20px!important;border:1px solid rgba(202,255,24,.38)!important;border-radius:24px!important;background:linear-gradient(145deg,#111713,#080c09)!important} body.student-neon .student-main-actions h2{margin:3px 0 16px!important;color:#fff!important;font-size:28px!important} body.student-neon .student-main-actions .quick-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important} body.student-neon .student-main-actions .quick-action{min-height:105px!important;border-color:rgba(202,255,24,.28)!important} body.student-neon .student-main-actions .quick-action>span{color:#caff18!important;font-size:24px!important}
  @media(max-width:620px){body.student-neon .premium-brand{margin:12px 14px 16px!important;min-height:250px!important}body.student-neon .premium-brand-content{min-height:250px!important;padding:20px!important}body.student-neon .premium-brand h1{font-size:32px!important}body.student-neon .student-billing-card,body.student-neon .welcome-row,body.student-neon .metric-grid,body.student-neon .student-main-actions{margin-left:14px!important;margin-right:14px!important}}
  `;document.head.appendChild(s)
 }
 function studentHome(){
  if(!student())return;const main=q('#content');if(!main)return;const hero=q('.premium-brand',main);if(!hero)return;document.body.classList.add('student-neon');studentStyle();
  const h=q('h1',hero);if(h)h.textContent='Evolução Corporal';const names=q('.names',hero);if(names)names.textContent='André Salles • Silvana Salles';const tag=q('.tagline',hero);if(tag)tag.textContent='CONSULTORIA ONLINE · HIPERTROFIA & EMAGRECIMENTO';
  if(!q('.student-billing-card',main)){const bill=document.createElement('section');bill.className='student-billing-card';bill.innerHTML='<div class="eyebrow">MENSALIDADE DA CONSULTORIA</div><div class="student-billing-row"><div class="student-billing-status">Em dia</div><div class="student-billing-date">Acompanhamento ativo</div></div>';hero.after(bill)}
  const quick=qa(':scope > .card',main).find(c=>/Registrar hoje/i.test(c.innerText));if(quick){quick.classList.add('student-main-actions');const e=q('.eyebrow',quick);if(e)e.textContent='ACESSO RÁPIDO';const hh=q('h2',quick);if(hh)hh.textContent='Seu acompanhamento';const bs=qa('.quick-action',quick),labels=[['Meu Treino','Acessar ficha'],['Minha Alimentação','Plano alimentar'],['Minha Evolução','Medidas e avaliações'],['Minhas Fotos','Evolução visual']];if(bs.length>=4){const order=[2,1,0,3];const wrap=q('.quick-actions',quick);order.forEach((idx,pos)=>{const b=bs[idx];const strong=q('strong',b),small=q('small',b);if(strong)strong.textContent=labels[pos][0];if(small)small.textContent=labels[pos][1];wrap.appendChild(b)})}}
 }
 function run(){nav();layout();studentHome()}
 let lock=false;new MutationObserver(()=>{if(lock)return;lock=true;requestAnimationFrame(()=>{run();lock=false})}).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',run);setTimeout(run,200);setTimeout(run,900);
})();