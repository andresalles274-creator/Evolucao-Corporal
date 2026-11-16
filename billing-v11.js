import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const billingClient = createClient(SUPABASE_URL,SUPABASE_KEY);
const dateBR = v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : 'A definir';
const money = v => v == null ? '' : Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const safe = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {mensal:'Mensal',trimestral:'Trimestral',semestral:'Semestral'};
const periods = {mensal:1,trimestral:3,semestral:6};
const todayLocal = () => {
  const d=new Date();
  const x=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const get=t=>x.find(p=>p.type===t)?.value||'';
  return [get('year'),get('month'),get('day')].join('-');
};
function addMonths(anchor,months){
  if(!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor))return null;
  const [y,m,day]=anchor.split('-').map(Number);
  const index=y*12+m-1+months;
  const yy=Math.floor(index/12),mm=index%12+1;
  const last=new Date(Date.UTC(yy,mm,0)).getUTCDate();
  return [yy,String(mm).padStart(2,'0'),String(Math.min(day,last)).padStart(2,'0')].join('-');
}
function nextRenewal(start,plan){
  if(!start || !periods[plan])return null;
  const now=todayLocal();
  let n=periods[plan],due=addMonths(start,n);
  if(!due)return null;
  // Preserve the original contract day when a month has fewer days.
  let guard=0;
  while(due<=now && guard++<120){n+=periods[plan];due=addMonths(start,n);}
  return due;
}
let lastHTML='',observer=null;
function mountBilling(){
  if(!lastHTML)return;
  const main=document.querySelector('#app main');
  if(!main)return;
  let node=main.querySelector('.billing-v11');
  if(!node){node=document.createElement('section');node.className='billing-v11';main.prepend(node);}
  if(node.dataset.billingVersion!=='plans-1'){node.innerHTML=lastHTML;node.dataset.billingVersion='plans-1';}
}
async function loadBilling(){
  const {data:{session}}=await billingClient.auth.getSession();
  if(!session)return;
  const uid=session.user.id;
  const {data:coach}=await billingClient.from('coach_users').select('user_id').eq('user_id',uid).maybeSingle();
  let html='';
  if(coach){
    const {data:students,error:studentError}=await billingClient.from('profiles').select('user_id,full_name,is_active').eq('is_active',true).neq('user_id',uid).order('full_name');
    if(studentError)return;
    const ids=(students||[]).map(s=>s.user_id);
    const {data:settings,error:settingError}=ids.length
      ?await billingClient.from('student_billing_settings').select('user_id,plan_type,plan_start_date,monthly_amount').in('user_id',ids)
      :{data:[],error:null};
    if(settingError)return;
    const map=new Map((settings||[]).map(s=>[s.user_id,s]));
    const totals={mensal:0,trimestral:0,semestral:0,undefined:0};
    for(const s of students||[])totals[map.get(s.user_id)?.plan_type||'undefined']++;
    const rows=(students||[]).map(s=>{
      const x=map.get(s.user_id)||{},start=x.plan_start_date,renewal=nextRenewal(start,x.plan_type);
      return '<div class="billing-plan-row" style="padding:9px 2px;border-top:1px solid rgba(255,255,255,.1)">'+
        '<strong>'+safe(s.full_name)+'</strong><div style="font-size:12px;opacity:.83">'+
        safe(labels[x.plan_type]||'Não definido')+
        ' · Início: '+safe(dateBR(start))+
        ' · Renovação: '+safe(dateBR(renewal))+
        (x.monthly_amount!=null?' · '+safe(money(x.monthly_amount)):'')+
        '</div></div>';
    }).join('');
    html='<div class="billing-title"><div><h3>Planos da consultoria</h3><p>Datas ainda não informadas aparecem como “A definir”.</p></div><span class="billing-icon">▣</span></div>'+
    '<div class="billing-summary">'+
      '<div class="billing-kpi"><strong>'+ids.length+'</strong><span>Alunos ativos</span></div>'+
      '<div class="billing-kpi"><strong>'+totals.mensal+'</strong><span>Mensais</span></div>'+
      '<div class="billing-kpi"><strong>'+totals.trimestral+'</strong><span>Trimestrais</span></div>'+
      '<div class="billing-kpi"><strong>'+totals.semestral+'</strong><span>Semestrais</span></div></div>'+
    '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">Ver planos e vencimentos dos alunos</summary>'+
    '<div style="margin-top:10px">'+rows+'</div></details>';
  }else{
    const {data:setting,error}=await billingClient.from('student_billing_settings').select('plan_type,plan_start_date,monthly_amount,reminders_enabled').eq('user_id',uid).maybeSingle();
    if(error || !setting || !setting.plan_type)return;
    const due=nextRenewal(setting.plan_start_date,setting.plan_type);
    html='<div class="billing-title"><div><h3>Meu plano da consultoria</h3><p>'+
      safe(labels[setting.plan_type]||'Não definido')+
      ' · Início: '+safe(dateBR(setting.plan_start_date))+
      ' · Próxima renovação: '+safe(dateBR(due))+
      (setting.monthly_amount!=null?' · '+safe(money(setting.monthly_amount)):'')+
      '</p></div><span class="billing-icon">▣</span></div>';
  }
  lastHTML=html;
  mountBilling();
  if(!observer){
    const root=document.querySelector('#app');
    if(root){observer=new MutationObserver(mountBilling);observer.observe(root,{subtree:true,childList:true});}
  }
}
setTimeout(loadBilling,500);
billingClient.auth.onAuthStateChange((event,session)=>{
  if(!session){lastHTML='';const box=document.querySelector('.billing-v11');if(box)box.remove();return;}
  setTimeout(loadBilling,250);
});
