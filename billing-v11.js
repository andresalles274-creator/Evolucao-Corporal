import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
const supabaseBilling=createClient(SUPABASE_URL,SUPABASE_KEY);
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateBR=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'—';
async function loadBilling(){
 const session=(await supabaseBilling.auth.getSession()).data.session;
 if(!session)return;
 const userId=session.user.id;
 const coach=(await supabaseBilling.from('coach_users').select('user_id').eq('user_id',userId).maybeSingle()).data;
 let html='';
 if(coach){
  const students=(await supabaseBilling.from('profiles').select('user_id').neq('user_id',userId)).data||[];
  const ids=students.map(x=>x.user_id);
  const payments=ids.length?((await supabaseBilling.from('student_payments').select('user_id,status,due_date').in('user_id',ids)).data||[]):[];
  const now=new Date(),month=String(now.getMonth()+1).padStart(2,'0'),year=now.getFullYear();
  const monthly=payments.filter(x=>String(x.due_date||'').startsWith(year+'-'+month));
  const paid=new Set(monthly.filter(x=>x.status==='paid').map(x=>x.user_id));
  const overdue=new Set(monthly.filter(x=>x.status!=='paid'&&new Date(x.due_date+'T23:59:59')<now).map(x=>x.user_id));
  const pending=Math.max(0,ids.length-paid.size-overdue.size);
  html=`<div class="billing-title"><div><h3>Mensalidades</h3><p>Resumo da consultoria neste mês</p></div><span class="billing-icon">▣</span></div><div class="billing-summary"><div class="billing-kpi"><strong>${paid.size}</strong><span>Em dia</span></div><div class="billing-kpi"><strong>${pending}</strong><span>A vencer</span></div><div class="billing-kpi"><strong>${overdue.size}</strong><span>Pendentes</span></div></div>`;
 }else{
  const setting=(await supabaseBilling.from('student_billing_settings').select('billing_day,monthly_amount,reminders_enabled').eq('user_id',userId).maybeSingle()).data;
  if(!setting||setting.reminders_enabled===false)return;
  const now=new Date(),year=now.getFullYear(),month=now.getMonth();
  const due=new Date(year,month,Math.min(Number(setting.billing_day)||10,new Date(year,month+1,0).getDate()));
  const dueISO=`${year}-${String(month+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
  const payment=(await supabaseBilling.from('student_payments').select('status,due_date').eq('user_id',userId).gte('due_date',`${year}-${String(month+1).padStart(2,'0')}-01`).lte('due_date',`${year}-${String(month+1).padStart(2,'0')}-31`).order('due_date',{ascending:false}).limit(1).maybeSingle()).data;
  const isPaid=payment?.status==='paid';
  const diff=Math.ceil((due-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
  const cls=isPaid?'ok':diff<0?'late':'soon';
  const status=isPaid?'Em dia ✓':diff<0?`Vencida há ${Math.abs(diff)} dia${Math.abs(diff)===1?'':'s'}`:diff===0?'Vence hoje':`Vence em ${diff} dia${diff===1?'':'s'}`;
  html=`<div class="billing-title"><div><h3>Mensalidade da consultoria</h3><p>Vencimento: ${dateBR(payment?.due_date||dueISO)}${setting.monthly_amount?' · '+money(setting.monthly_amount):''}</p></div><span class="billing-icon">▣</span></div><span class="billing-status ${cls}">${status}</span>`;
 }
 const show=()=>{const main=document.querySelector('#app main');if(!main||document.querySelector('.billing-v11'))return;const box=document.createElement('section');box.className='billing-v11';box.innerHTML=html;main.prepend(box)};
 show();setTimeout(show,1200);setTimeout(show,3000);
}
setTimeout(loadBilling,700);