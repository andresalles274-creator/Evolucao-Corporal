import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {SUPABASE_URL,SUPABASE_KEY} from './config.js';
import {createStudentRegistration} from './student-registration.js?v=1.0.0';
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
createStudentRegistration({db,root:document.getElementById('registration'),appUrl:new URL('./',location.href).href}).start();
