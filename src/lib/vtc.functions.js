import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {DEFAULT_PRICING,calculateFare} from './vtc-pricing';

export const vtcRequest=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>input).handler(async({data,context})=>{
 const {handleVtc}=await import('./vtc.server');
 return handleVtc(data,context);
});
export const contactRequest=createServerFn({method:'POST'}).inputValidator(input=>input).handler(async({data})=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 if(data.company) return {ok:true};
 if(typeof data.name!=='string'||data.name.trim().length<2||data.name.length>100||!/^\S+@\S+\.\S+$/.test(data.email)||typeof data.message!=='string'||data.message.length<10||data.message.length>2000) throw new Error('Vérifiez votre nom, votre e-mail et votre message.');
 const {error}=await supabaseAdmin.from('contact_messages').insert({name:data.name.trim(),email:data.email.toLowerCase(),topic:data.topic,message:data.message});
 if(error) throw new Error('Votre message n’a pas pu être envoyé.');
 return {ok:true};
});
export const publicVtcRequest=createServerFn({method:'POST'}).inputValidator(input=>input).handler(async({data})=>{
 const {publicVtc}=await import('./vtc.server');
 return publicVtc(data);
});
const okPoint=(p)=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
export const homeEstimate=createServerFn({method:'POST'}).inputValidator(input=>{
 if(!okPoint(input?.pickup)||!okPoint(input?.dropoff)) throw new Error('Adresses invalides');
 return {pickup:{lat:input.pickup.lat,lng:input.pickup.lng},dropoff:{lat:input.dropoff.lat,lng:input.dropoff.lng}};
}).handler(async({data})=>{
 const {uberProducts}=await import('./vtc-uber.server');
 const uber=await uberProducts(data.pickup,data.dropoff);
 if(uber) return {source:'uber',products:uber};
 const {publicVtc}=await import('./vtc.server');
 const est=await publicVtc({path:'/api/rides/estimate',body:data});
 return {source:'strasdrive',route:est.route,estimates:est.estimates};
});
