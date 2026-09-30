// Camada visual/navegação V11 neon. Mantém toda a lógica e dados do app principal.
(function(){
 const qs=(s,r=document)=>r.querySelector(s);
 function upgradeNav(){
   const nav=qs('.bottomnav');
   if(!nav||nav.dataset.neonReady)return;
   const coach=!!qs('.brand')?.textContent?.includes('Coach');
   if(!coach)return;
   const originals={}; nav.querySelectorAll('[data-route]').forEach(b=>originals[b.dataset.route]=b);
   nav.dataset.neonReady='1';
   nav.innerHTML=`<button class="navbtn active" data-neon-route="home"><span class="ico">⌂</span>Início</button><button class="navbtn" data-neon-route="measures"><span class="ico">▥</span>Medidas</button><button class="navbtn neon-add" data-route="newStudent" aria-label="Novo aluno"><span class="ico">+</span><span>Novo aluno</span></button><button class="navbtn" data-neon-route="coach"><span class="ico">♟</span>Alunos</button><button class="navbtn" data-neon-route="records"><span class="ico">▤</span>Registros</button>`;
   nav.querySelectorAll('[data-neon-route]').forEach(btn=>btn.onclick=()=>{
     const r=btn.dataset.neonRoute;
     if(r==='records'){
       const recent=document.querySelector('.activity-item,.history-row');
       if(recent){recent.scrollIntoView({behavior:'smooth',block:'center'});return;}
       originals.home?.click(); return;
     }
     originals[r]?.click();
   });
   qs('.neon-add',nav).onclick=openNewStudent;
 }
 function openNewStudent(){
   document.querySelector('.neon-student-modal')?.remove();
   const modal=document.createElement('div'); modal.className='neon-student-modal record-overlay';
   modal.innerHTML=`<div class="record-modal neon-add-card"><div class="record-modal-head"><div><div class="eyebrow">Novo aluno</div><h2>Adicionar aluno</h2></div><button class="record-x" type="button">×</button></div><p class="sub">O aluno entra na consultoria criando a conta com o próprio e-mail. Envie o endereço do Evolução Corporal para ele tocar em <strong>Criar conta</strong>. Assim que concluir o cadastro, ele aparece automaticamente no seu painel.</p><button class="btn btn-primary btn-full neon-copy-link" type="button">Copiar link para o aluno</button><button class="btn btn-ghost btn-full neon-close" style="margin-top:10px" type="button">Fechar</button></div>`;
   document.body.appendChild(modal); const close=()=>modal.remove();
   qs('.record-x',modal).onclick=close; qs('.neon-close',modal).onclick=close; modal.onclick=e=>{if(e.target===modal)close()};
   qs('.neon-copy-link',modal).onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname);qs('.neon-copy-link',modal).textContent='Link copiado ✓';}catch(_){prompt('Copie este endereço:',location.origin+location.pathname)}};
 }
 function decorate(){upgradeNav();const hero=qs('.premium-brand');if(hero)hero.classList.add('neon-hero');document.querySelectorAll('.card,.billing-v11,.metric').forEach(x=>x.classList.add('floating-card'))}
 const obs=new MutationObserver(decorate);obs.observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',decorate);setTimeout(decorate,700);
})();