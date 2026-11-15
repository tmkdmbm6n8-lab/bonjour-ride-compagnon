import Stripe from 'stripe';
import {earlyPayoutQuote,weeklyPayoutAmount,nextPayoutAt,payoutWeekKey,EARLY_PAYOUT_FEE,MIN_EARLY_PAYOUT} from './vtc-payouts';

/** Balance, next automatic transfer and recent payouts shown on the driver's earnings page. */
async function payoutSummary(admin,uid,profile){
 const {data:rows}=await admin.from('payouts').select('id,kind,amount,fee,status,created_at,paid_at,failure').eq('driver_id',uid).order('created_at',{ascending:false}).limit(10);
 const balance=Number(profile.balance);
 return {balance,nextPayoutAt:nextPayoutAt().toISOString(),nextPayoutAmount:weeklyPayoutAmount(balance),earlyFee:EARLY_PAYOUT_FEE,minPayout:MIN_EARLY_PAYOUT+EARLY_PAYOUT_FEE,earlyQuote:earlyPayoutQuote(balance),payouts:(rows||[]).map(r=>({...r,amount:Number(r.amount),fee:Number(r.fee)})),lastPayoutAt:(rows||[]).find(r=>r.status==='paid')?.paid_at||null};
}

/** Sends one recorded payout to the driver's Stripe account; a refusal puts the money back in the wallet. */
async function sendTransfer(admin,stripe,payout,accountId){
 try{
  const t=await stripe.transfers.create({amount:Math.round(payout.amount*100),currency:'eur',destination:accountId,metadata:{payoutId:payout.id}},{idempotencyKey:`payout-${payout.id}`});
  await admin.rpc('finish_payout',{_id:payout.id,_ok:true,_provider:t.id,_failure:null});return true;
 }catch(err){
  await admin.rpc('finish_payout',{_id:payout.id,_ok:false,_provider:null,_failure:String(err?.message||err)});throw new Error('Le virement a été refusé par Stripe — votre solde a été recrédité');
 }
}

/** Weekly run (Monday 00:00 Paris): pays each driver's whole positive balance, no fee. Idempotent per week. */
export async function runWeeklyPayouts(admin,now=new Date()){
 const key=process.env.STRIPE_SECRET_KEY;const week=payoutWeekKey(now);
 if(!key)return {week,paid:0,skipped:'stripe_not_connected'};
 const stripe=new Stripe(key,{httpClient:Stripe.createFetchHttpClient()});
 const {data:ds,error}=await admin.from('drivers').select('user_id,payout');if(error)throw error;
 let paid=0,failed=0,waiting=0;
 for(const d of ds||[]){
  const acct=d.payout?.stripeAccountId;
  const {data:prof}=await admin.from('profiles').select('balance').eq('id',d.user_id).single();
  const amount=weeklyPayoutAmount(prof?.balance);if(!amount)continue;
  if(!acct){waiting++;continue;}
  let account;try{account=await stripe.accounts.retrieve(acct);}catch{waiting++;continue;}
  if(!account.payouts_enabled){waiting++;continue;}
  const {data:pid,error:e}=await admin.rpc('create_payout',{_driver:d.user_id,_kind:'weekly',_amount:amount,_fee:0,_week:week});
  if(e||!pid)continue;
  try{await sendTransfer(admin,stripe,{id:pid,amount},account.id);paid++;}catch{failed++;}
 }
 return {week,paid,failed,waiting};
}
export async function handlePayments({admin,profile,uid,role,p,q,method,body}) {
 const key=process.env.STRIPE_SECRET_KEY;
 if(p==='/api/drivers/me/payouts'&&method==='GET'&&!key)return {...(await payoutSummary(admin,uid,profile)),configured:false,canCashOut:false};
 if(!key)throw new Error('Stripe n’est pas encore connecté : aucun paiement n’a été effectué.');
 const stripe=new Stripe(key,{httpClient:Stripe.createFetchHttpClient()});
 const base=process.env.APP_URL;if(!base)throw new Error('L’adresse publique doit être configurée avant les paiements.');
 const {data:d,error}=await admin.from('drivers').select('*').eq('user_id',uid).single();if(error||!d)throw new Error('Chauffeur introuvable');
 let account=d.payout?.stripeAccountId?await stripe.accounts.retrieve(d.payout.stripeAccountId):null;
 if(method==='GET')return {...(await payoutSummary(admin,uid,profile)),configured:true,connected:Boolean(account),detailsSubmitted:account?.details_submitted,payoutsEnabled:account?.payouts_enabled,canCashOut:Boolean(account?.payouts_enabled)&&earlyPayoutQuote(profile.balance).ok};
 if(body.action==='onboard'){
  if(!account){account=await stripe.accounts.create({type:'express',country:'FR',capabilities:{transfers:{requested:true}},metadata:{userId:uid}});const saved=await admin.from('drivers').update({payout:{...d.payout,stripeAccountId:account.id}}).eq('user_id',uid);if(saved.error)throw new Error('La configuration n’a pas pu être enregistrée');}
  const link=await stripe.accountLinks.create({account:account.id,type:'account_onboarding',return_url:`${base}/driver/earnings?payout=done`,refresh_url:`${base}/driver/earnings?payout=refresh`});return {url:link.url};
 }
 if(body.action==='cashout'){
  if(!account?.payouts_enabled)throw new Error('Configurez d’abord vos coordonnées bancaires');
  const quote=earlyPayoutQuote(profile.balance);if(!quote.ok)throw new Error(quote.reason);
  const {data:pid,error:e}=await admin.rpc('create_payout',{_driver:uid,_kind:'early',_amount:quote.amount,_fee:quote.fee,_week:null});if(e||!pid)throw new Error(e?.message||'Le retrait n’a pas pu être créé');
  await sendTransfer(admin,stripe,{id:pid,amount:quote.amount},account.id);
  return {amount:quote.amount,fee:quote.fee};
 }
 throw new Error('Action de versement inconnue');
}
