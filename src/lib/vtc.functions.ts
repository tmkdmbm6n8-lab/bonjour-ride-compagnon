// @ts-nocheck — server actions kept as-is from the original JS file; .ts so TanStack Start registers them.
import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {DEFAULT_PRICING,calculateFare} from './vtc-pricing';

export const vtcRequest=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>input).handler(async({data,context})=>{
 const {handleVtc}=await import('./vtc.server');
 return handleVtc(data,context);
});
export const contactRequest=createServerFn({method:'POST'}).inputValidator(input=>input).handler(async({data})=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 // Public endpoint: never trust the input validator's identity passthrough.
 if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('Vérifiez votre nom, votre e-mail et votre message.');
 if(data.company) return {ok:true}; // Honeypot for automated submissions.
 if(typeof data.name!=='string'||data.name.trim().length<2||data.name.length>100||
    typeof data.email!=='string'||data.email.length>254||!/^\S+@\S+\.\S+$/.test(data.email)||
    typeof data.message!=='string'||data.message.length<10||data.message.length>2000)
   throw new Error('Vérifiez votre nom, votre e-mail et votre message.');
 const allowedTopics=['general','ride_issue','driver_support','payments','safety','data_request'];
 const {error}=await supabaseAdmin.from('contact_messages').insert({name:data.name.trim(),email:data.email.toLowerCase(),topic:allowedTopics.includes(data.topic)?data.topic:'general',message:data.message});
 if(error) throw new Error('Votre message n’a pas pu être envoyé.');
 return {ok:true};
});
export const publicVtcRequest=createServerFn({method:'POST'}).inputValidator(input=>input).handler(async({data})=>{
 const {publicVtc}=await import('./vtc.server');
 return publicVtc(data);
});
export const getRandomRideSummary=createServerFn({method:'GET'}).handler(async()=>{
 const {getRandomRealRide}=await import('./vtc.server');
 return getRandomRealRide();
});
const okPoint=(p)=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
export const homeEstimate=createServerFn({method:'POST'}).inputValidator(input=>{
 if(!okPoint(input?.pickup)||!okPoint(input?.dropoff)) throw new Error('Adresses invalides');
 return {pickup:{lat:input.pickup.lat,lng:input.pickup.lng},dropoff:{lat:input.dropoff.lat,lng:input.dropoff.lng}};
}).handler(async({data})=>{
 const {uberProducts}=await import('./vtc-uber.server');
 const uber=await uberProducts(data.pickup,data.dropoff).catch(()=>null);
 if(Array.isArray(uber)&&uber.length) return {source:'uber',products:uber};
 const {publicVtc}=await import('./vtc.server');
 const est=await publicVtc({path:'/api/rides/estimate',body:data});
 return {source:'strasdrive',route:est.route,estimates:est.estimates};
});
