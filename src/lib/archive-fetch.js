import {LEGAL_VERSION} from './legal';
import {vtcRequest,contactRequest,publicVtcRequest} from './vtc.functions';
import {supabase} from '@/integrations/supabase/client';
const PUBLIC_PAGES=['/','/login','/signup','/contact','/privacy','/terms','/mentions-legales'];
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
  else if(String(path).startsWith('/api/geo/search')&&!(await supabase.auth.getSession()).data.session)data=await publicVtcRequest({data:{path,body}});
  else{
   // Without a session the request would be refused: send the user back to sign in with a clear message.
   const {data:{session}}=await supabase.auth.getSession();if(!session)throw sessionExpired();
   try{data=await vtcRequest({data:{path,method:options.method||'GET',body}});}catch(e){if(/unauthori[sz]ed|authorization header|jwt/i.test(String(e?.message||'')))throw sessionExpired();throw e;}
  }
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 }catch(error){return new Response(JSON.stringify({error:error.message||'Une erreur est survenue'}),{status:400,headers:{'Content-Type':'application/json'}});}
}