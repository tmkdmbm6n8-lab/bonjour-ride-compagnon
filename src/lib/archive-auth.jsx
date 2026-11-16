import {createContext,useContext,useEffect,useState,useCallback} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {apiFetch} from './archive-fetch';
import {clearRideDraft} from './ride-draft';
const AuthContext=createContext({data:null,status:'loading',update:async()=>{}});
export function SessionProvider({children}) {
 const [data,setData]=useState(null),[status,setStatus]=useState('loading');
 const update=useCallback(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){setData(null);setStatus('unauthenticated');return null;}const res=await apiFetch('/api/users/me');const j=await res.json();if(!res.ok){setStatus('unauthenticated');return null;}const value={user:j.user};setData(value);setStatus('authenticated');return value;},[]);
 useEffect(()=>{update();const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))setTimeout(update,0);});return ()=>subscription.unsubscribe();},[update]);
 return <AuthContext.Provider value={{data,status,update}}>{children}</AuthContext.Provider>;
}
export function useSession(){return useContext(AuthContext);}
export async function signIn(_,options){const {error}=await supabase.auth.signInWithPassword({email:options.username,password:options.password});return error?{error:'Adresse e-mail ou mot de passe incorrect',status:400}:{ok:true};}
export async function signOut({callbackUrl='/'}){clearRideDraft();await import('./native-push').then(m=>m.unregisterDriverPush()).catch(()=>{});await supabase.auth.signOut({scope:'local'});window.location.href=callbackUrl;}
