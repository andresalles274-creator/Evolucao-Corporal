// Interface V11 — painel coach fiel à referência neon aprovada.
(function(){
 const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
 function isCoach(){return /Painel do Coach/i.test(document.body.innerText)}
 function openNewStudent(){
  q('.neon-student-modal')?.remove();
  const m=document.createElement('div');m.className='neon-student-modal record-overlay';
  m.innerHTML=`<div class="record-modal neon-add-card"><div class="record-modal-head"><div><div class="eyebrow">NOVO ALUNO</div><h2>Adicionar aluno</h2></div><button class="record-x" type="button">×</button></div><p class="sub">Envie o link do Evolução Corporal para o aluno criar a conta. Assim que ele concluir o cadastro, aparecerá no seu painel.</p><button class="btn btn-primary btn-full neon-copy-link" type="button">Copiar link para o aluno</button><button class="btn btn-ghost btn-full neon-close" type="button" style="margin-top:10px">Fechar</button></div>`;
  document.body.appendChild(m);const close=()=>m.remove();q('.record-x',m).onclick=close;q('.neon-close',m).onclick=close;m.onclick=e=>{if(e.target===m)close()};q('.neon-copy-link',m).onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname);q('.neon-copy-link',m).textContent='Link copiado ✓'}catch(_){prompt('Copie este endereço:',location.href)}};
 }
 function upgradeNav(){
  const nav=q('.bottomnav');if(!nav||!isCoach())return;
  if(nav.dataset.layout==='reference')return;
  const old={};qa('[data-route]',nav).forEach(b=>old[b.dataset.route]=b);
  nav.dataset.layout='reference';nav.innerHTML=`<button class="navbtn active" data-neon="home"><span class="ico">⌂</span><span>Início</span></button><button class="navbtn" data-neon="measures"><span class="ico">▥</span><span>Medidas</span></button><button class="navbtn neon-add" type="button"><span class="plus">+</span><span>Novo aluno</span></button><button class="navbtn" data-neon="coach"><span class="ico">♟</span><span>Alunos</span></button><button class="navbtn" data-neon="records"><span class="ico">▤</span><span>Registros</span></button>`;
  qa('[data-neon]',nav).forEach(b=>b.onclick=()=>{const r=b.dataset.neon;if(r==='records'){const x=qa('.card').find(x=>/Últimos registros/i.test(x.innerText));if(x){x.scrollIntoView({behavior:'smooth',block:'center'});return}}if(r==='coach'){const x=qa('.card').find(x=>/^Alunos|\nAlunos/i.test(x.innerText));if(x){x.scrollIntoView({behavior:'smooth',block:'center'});return}}(old[r]||old.home)?.click()});
  q('.neon-add',nav).onclick=openNewStudent;
 }
 function classify(){
  if(!isCoach())return;
  const hero=q('.premium-brand');if(hero)hero.classList.add('ref-hero');
  qa('.card').forEach(c=>{const t=c.innerText||'';if(/Aluno em destaque|Carlos Roberto|Abrir ficha completa/i.test(t))c.classList.add('ref-featured');if(/^Alunos|\nAlunos/i.test(t))c.classList.add('ref-students');if(/Últimos registros/i.test(t))c.classList.add('ref-records')});
  const billing=q('.billing-v11');if(billing)billing.classList.add('ref-billing');
  // Ordem da referência: banner, mensalidades, destaque, alunos/registros.
  const main=hero?.parentElement;
  if(main&&billing&&hero.parentElement===billing.parentElement){main.insertBefore(hero,billing);hero.after(billing)}
 }
 function decorate(){upgradeNav();classify();qa('.card,.billing-v11,.metric').forEach(x=>x.classList.add('floating-card'))}
 let busy=false;const run=()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{decorate();busy=false})};
 new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',run);setTimeout(run,300);setTimeout(run,1200);
})();