import {LEGAL_VERSION} from './legal';
import {vtcRequest,contactRequest,publicVtcRequest} from './vtc.functions';
import {supabase} from '@/integrations/supabase/client';
import {publishRefresh} from './live-refresh';
const PUBLIC_PAGES=['/','/login','/signup','/recover-account','/contact','/privacy','/terms','/mentions-legales','/join'];
let redirecting=false;
function sessionExpired(){
 if(typeof window!=='undefined'&&!redirecting&&!PUBLIC_PAGES.includes(window.location.pathname)){redirecting=true;const back=window.location.pathname+window.location.search;window.location.href=`/login?expired=1&callbackUrl=${encodeURIComponent(back)}`;}
 return new Error('Votre session a expiré : reconnectez-vous');
}
export async function apiFetch(path,options={}) {
 if(!String(path).startsWith('/api/'))return fetch(path,options);
 try {
  let body=options.body?JSON.parse(options.body):{};
  let data;
  if(path==='/api/auth/signup'){
   const {data:result,error}=await supabase.auth.signUp({email:body.email,password:body.password,options:{emailRedirectTo:window.location.origin+'/login',data:{name:body.name,username:body.username,role:body.role,consent:{termsVersion:LEGAL_VERSION,privacyVersion:LEGAL_VERSION,acceptedAt:new Date().toISOString()}}}});if(error)throw error;data={ok:true,needsConfirmation:!result.session};
  }else if(path==='/api/contact')data=await contactRequest({data:body});
  // Address search is a public map service: never tied to the session, so an expired token cannot break it.
  else if(String(path).startsWith('/api/geo/search') || path==='/api/public/app-version')data=await publicVtcRequest({data:{path,body},signal:options.signal});
  // Scanning a driver's QR code works before signing up; the server only accepts a valid, unexpired code.
  else if(path==='/api/private-clients/scan')data=await publicVtcRequest({data:{path,body},signal:options.signal});
  else{
   // Without a session the request would be refused: send the user back to sign in with a clear message.
   const {data:{session}}=await supabase.auth.getSession();if(!session)throw sessionExpired();
   try{data=await vtcRequest({data:{path,method:options.method||'GET',body},signal:options.signal});}catch(e){if(/unauthori[sz]ed|authorization header|jwt|ACCOUNT_UNAVAILABLE/i.test(String(e?.message||'')))throw sessionExpired();throw e;}
  }
  if ((options.method || 'GET') !== 'GET' && !/\/(location|online-time|push-token|estimate)$/.test(String(path))) queueMicrotask(() => publishRefresh(true));
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch(error){
  if(error.message==='DRIVER_SUSPENDED'){
   publishRefresh();
   return new Response(JSON.stringify({error:'Votre accès chauffeur est suspendu. Contactez l’assistance.',code:'DRIVER_SUSPENDED'}),{status:403,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  return new Response(JSON.stringify({error:error.message||'Une erreur est survenue'}),{status:400,headers:{'Content-Type':'application/json'}});
 }
}
