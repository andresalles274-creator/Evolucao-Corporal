
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const APP_VERSION="11.0";
const PHOTO_BUCKET="evolution-photos";
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v="")=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;","&gt;":"&gt;",'"':"&quot;","'":"&#039;"}[m]));