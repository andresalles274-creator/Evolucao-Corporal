import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
const supabaseBilling=createClient(SUPABASE_URL,SUPABASE_KEY);
async function loadBilling(){
 const session=(await supabaseBilling.auth.getSession()).data.session;
 if(!session)return;
 const userId=session.user.id;
 const coach=(await supabaseBilling.from('coach_users').select('user_id').eq('user_id',userId).maybeSingle()).data;
 let text='';
 if(coach){
  const students=(await supabaseBilling.from('profiles').select('user_id').neq('user_id',userId)).data||[];
  const ids=students.map(x=>x.user_id);
  const payments=ids.length?((await supabaseBilling.from('student_payments').select('user_id,status,due_date').in('user_id',ids)).data||[]):[];
  const now=new Date(),month=String(now.getMonth()+1).padStart(2,'0'),year=now.getFullYear();
  const paid=new Set(payments.filter(x=>x.status==='paid'&&String(x.due_date).startsWith(year+'-'+month)).map(x=>x.user_id));
  text=`Mensalidades deste mês: ${paid.size} em dia · ${Math.max(0,ids.length-paid.size)} a verificar`;
 }else{
  const setting=(await supabaseBilling.from('student_billing_settings').select('billing_day,monthly_amount,reminders_enabled').eq('user_id',userId).maybeSingle()).data;
  if(!setting||setting.reminders_enabled===false)return;
  text=`Mensalidade da consultoria · vencimento dia ${setting.billing_day}${setting.monthly_amount?' · R$ '+Number(setting.monthly_amount).toFixed(2).replace('.',','):''}`;
 }
 const show=()=>{const main=document.querySelector('#app main');if(!main||document.querySelector('.billing-v11'))return;const box=document.createElement('section');box.className='billing-v11';box.innerHTML='<h3>Mensalidade</h3><p>'+text+'</p>';main.prepend(box)};
 show();setTimeout(show,1200);setTimeout(show,3000);
}
setTimeout(loadBilling,700);