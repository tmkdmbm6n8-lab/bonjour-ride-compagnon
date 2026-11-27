import {accountRealtimeChanged} from './account-live';
import {watchRefresh,publishRefresh} from './live-refresh';
import {createContext,useContext,useEffect,useState,useCallback,useRef} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {apiFetch} from './archive-fetch';
import {clearRideDraft} from './ride-draft';
import {localSessionUser} from './offline-session';
// The route guard and provider can start together on a protected deep link.
let pendingUserVerification;
export function verifySessionUser() {
 if (typeof window === 'undefined') return supabase.auth.getUser();
 if (pendingUserVerification) return pendingUserVerification;
 const verification = (async () => {
  // The phone's saved session decides first; the network only confirms it.
  // A failed or slow check (airplane mode, tunnel) never signs the driver out.
  const local = await localSessionUser();
  try {
   const res = await Promise.race([supabase.auth.getUser(), new Promise((resolve) => setTimeout(() => resolve(null), 4000))]);
   if (!res) return { data: { user: local }, error: null };
   const status = res.error?.status;
   // Only an explicit refusal from the server ends the session.
   if (res.error && !res.data?.user && !(status === 401 || status === 403)) return { data: { user: local }, error: null };
   return res;
  } catch {
   return { data: { user: local }, error: null };
  }
 })().finally(() => {
  if (pendingUserVerification === verification) pendingUserVerification = null;
 });
 pendingUserVerification = verification;
 return verification;
}
const AuthContext=createContext({data:null,status:'loading',live:null,update:async()=>{}});
export function SessionProvider({children}) {
 const updateRequest=useRef(0);
 const [data,setData]=useState(null),[status,setStatus]=useState('loading'),[live,setLive]=useState(null);
 const update=useCallback(async()=>{
  const request=++updateRequest.current;
  const {data:{user},error}=await verifySessionUser();
  if(request!==updateRequest.current)return null;
  if(error){setStatus(current=>current==='loading'?'unauthenticated':current);return null;}
  if(!user){setData(null);setLive(null);setStatus('unauthenticated');return null;}
  const res=await apiFetch('/api/users/me');
  if(request!==updateRequest.current)return null;
  if(!res.ok){setStatus(current=>current==='loading'?'unauthenticated':current);return null;}
  const j=await res.json(),value={user:j.user};
  if(request!==updateRequest.current)return null;
  setData(value);setStatus('authenticated');return value;
 },[]);
 useEffect(()=>{
  let active=true;
  update().catch(()=>{if(active)setStatus('unauthenticated');});
  const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
   if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)) pendingUserVerification = null;
   if(event==='SIGNED_OUT'){++updateRequest.current;setData(null);setLive(null);setStatus('unauthenticated');}
   else if(['SIGNED_IN','USER_UPDATED'].includes(event))setTimeout(()=>{if(active)void update().catch(()=>{});},0);
  });
  return ()=>{active=false;subscription.unsubscribe();};
 },[update]);
 useEffect(()=>{
  if(status!=='authenticated'||!data?.user?.id)return;
  let previousRevision=null,disconnecting=false;
  const stop=watchRefresh(async(active,signal)=>{
   const response=await apiFetch('/api/users/me/live',{signal});
   if(!response.ok)return;
   const value=await response.json();
   if(!active())return;
   setLive({...value,checkedAt:Date.now()});
   setData(current=>current?{...current,user:{...current.user,role:value.role,canDrive:value.canDrive}}:current);
   if(previousRevision!==null && previousRevision!==value.revision) { publishRefresh(); void update().catch(()=>{}); }
   previousRevision=value.revision;
   const driverView=/^\/driver(?:\/|$)/.test(window.location.pathname);
   if(value.suspended && driverView && !value.hasDriverRide && !disconnecting){
    disconnecting=true;
    void signOut({callbackUrl:'/login?suspended=1'}).catch(()=>{disconnecting=false;});
   }else if(driverView && !value.canDrive && !value.hasDriverRide){
    window.location.replace('/dashboard');
   }else if(/^\/admin(?:\/|$)/.test(window.location.pathname) && value.role!=='admin'){
    window.location.replace('/dashboard');
   }
  },5000);
  // Realtime accelerates updates when enabled; polling remains the authoritative fallback.
  const channel=supabase.channel(`account-live:${data.user.id}`);
  for(const [table,column] of [['profiles','id'],['drivers','user_id'],['user_roles','user_id']]){
   channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`${column}=eq.${data.user.id}`},payload=>{if(accountRealtimeChanged(table,payload))publishRefresh();});
  }
  channel.subscribe();
  return ()=>{stop();void supabase.removeChannel(channel);};
 },[status,data?.user?.id]);
 return <AuthContext.Provider value={{data,status,live,update}}>{children}</AuthContext.Provider>;
}
export function useSession(){return useContext(AuthContext);}
export async function signIn(_,options){const {error}=await supabase.auth.signInWithPassword({email:options.username,password:options.password});return error?{error:'Adresse e-mail ou mot de passe incorrect',status:400}:{ok:true};}
export async function signOut({callbackUrl='/'}){clearRideDraft();await Promise.race([import('./live-activity-native').then(m=>m.stopLiveActivitiesForSignOut()).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1000))]);await import('./native-push').then(m=>m.unregisterDriverPush()).catch(()=>{});await supabase.auth.signOut({scope:'local'});window.location.href=callbackUrl;}
