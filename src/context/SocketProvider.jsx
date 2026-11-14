import {createContext,useContext,useEffect,useState} from 'react';
import {useSession} from '@/lib/archive-auth';
import {apiFetch} from '@/lib/archive-fetch';
const SocketContext=createContext({socket:null,isConnected:false});
export function SocketProvider({children}){
 const {data:session,status}=useSession(),[socket,setSocket]=useState(null);
 useEffect(()=>{
  if(status!=='authenticated')return;
  const listeners=new Map();let previous=null,offerId=null,offerKey=null,stopped=false;
  const fire=(event,data)=>listeners.get(event)?.forEach(fn=>fn(data));
  const instance={on:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn)},off:(event,fn)=>listeners.get(event)?.delete(fn),emit:(event,data)=>{if(event==='driver:location')apiFetch('/api/drivers/location',{method:'POST',body:JSON.stringify(data)});}};
  setSocket(instance);
  async function tick(){
   if(stopped)return;
   try{
    if(session.user.role==='driver'){
     const res=await apiFetch('/api/drivers/offers');const j=await res.json();const key=j.offer?`${j.offer.rideId}:${j.offer.phase||''}`:null;if(j.offer&&key!==offerKey){offerId=j.offer.rideId;offerKey=key;fire('ride:offer',j.offer)}if(!j.offer&&offerId){fire('ride:offer-expired',{rideId:offerId});offerId=null;offerKey=null;}
    }
    if(session.user.role==='admin'){fire('ride:updated',{});return;}
    const res=await apiFetch('/api/rides/active');if(!res.ok)return;const {ride}=await res.json();
    if(ride){
     if(ride.status!==previous?.status){const events={accepted:'ride:accepted',arrived:'ride:driver-arrived',in_progress:'ride:started'};if(events[ride.status])fire(events[ride.status],{ride});}
     if(ride.driver?.location)fire('driver:location',{location:ride.driver.location});
     const oldCount=previous?.id===ride.id?previous.messages?.length||0:ride.messages?.length||0;for(const m of (ride.messages||[]).slice(oldCount))fire('ride:message',{rideId:ride.id,...m});
    }else if(previous){
     const detail=await apiFetch(`/api/rides/${previous.id}`);const j=await detail.json();if(j.ride?.status==='completed')fire('ride:completed',{fare:j.ride.fare,payment:j.ride.payment});else if(j.ride?.status==='no_drivers')fire('ride:no-drivers',{});else if(j.ride?.status==='cancelled')fire('ride:cancelled',{rideId:previous.id});
    }
    previous=ride;
   }catch{}
  }
  tick();const timer=setInterval(tick,2500);return ()=>{stopped=true;clearInterval(timer);setSocket(null)};
 },[status,session?.user?.id,session?.user?.role]);
 return <SocketContext.Provider value={{socket,isConnected:Boolean(socket)}}>{children}</SocketContext.Provider>;
}
export function useSocket(){return useContext(SocketContext);}