import {vtcRequest,contactRequest} from './vtc.functions';
import {supabase} from '@/integrations/supabase/client';
export async function apiFetch(path,options={}) {
 if(!String(path).startsWith('/api/'))return fetch(path,options);
 try {
  let body=options.body?JSON.parse(options.body):{};
  let data;
  if(path==='/api/auth/signup'){
   const {data:result,error}=await supabase.auth.signUp({email:body.email,password:body.password,options:{emailRedirectTo:window.location.origin+'/login',data:{name:body.name,username:body.username,role:body.role}}});if(error)throw error;data={ok:true,needsConfirmation:!result.session};
  }else if(path==='/api/contact')data=await contactRequest({data:body});
  else data=await vtcRequest({data:{path,method:options.method||'GET',body}});
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 }catch(error){return new Response(JSON.stringify({error:error.message||'Une erreur est survenue'}),{status:400,headers:{'Content-Type':'application/json'}});}
}