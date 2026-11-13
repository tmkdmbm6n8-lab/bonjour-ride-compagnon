import Stripe from 'stripe';
export async function handlePayments({admin,profile,uid,role,p,q,method,body}) {
 const key=process.env.STRIPE_SECRET_KEY;
 if(p==='/api/drivers/me/payouts'&&method==='GET'&&!key)return {configured:false};
 if(!key)throw new Error('Stripe n’est pas encore connecté : aucun paiement n’a été effectué.');
 const stripe=new Stripe(key,{httpClient:Stripe.createFetchHttpClient()});
 const base=process.env.APP_URL;if(!base)throw new Error('L’adresse publique doit être configurée avant les paiements.');
 if(p==='/api/wallet/checkout'){
  if(method==='POST'){
   const amount=Number(body.amount);if(!Number.isFinite(amount)||amount<5||amount>1000)throw new Error('Le montant doit être compris entre 5 € et 1 000 €.');
   const session=await stripe.checkout.sessions.create({mode:'payment',client_reference_id:uid,metadata:{userId:uid},line_items:[{price_data:{currency:'eur',unit_amount:Math.round(amount*100),product_data:{name:'Crédits de courses StrasDrive'}},quantity:1}],success_url:`${base}${role==='driver'?'/driver':''}/wallet?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${base}${role==='driver'?'/driver':''}/wallet?topup=cancelled`});return {url:session.url};
  }
  const session=await stripe.checkout.sessions.retrieve(q.get('session_id'));if(session.client_reference_id!==uid)throw new Error('Paiement inaccessible');if(session.payment_status!=='paid')return {paid:false};
  const {error}=await admin.rpc('wallet_entry',{_user:uid,_amount:session.amount_total/100,_type:'topup',_provider:session.id});if(error)throw new Error('Le paiement doit être réconcilié');return {paid:true,credited:true,amount:session.amount_total/100};
 }
 const {data:d,error}=await admin.from('drivers').select('*').eq('user_id',uid).single();if(error||!d)throw new Error('Chauffeur introuvable');
 let account=d.payout.stripeAccountId?await stripe.accounts.retrieve(d.payout.stripeAccountId):null;
 if(method==='GET')return {configured:true,connected:Boolean(account),detailsSubmitted:account?.details_submitted,payoutsEnabled:account?.payouts_enabled,balance:Number(profile.balance),canCashOut:Number(profile.balance)>=5&&account?.payouts_enabled,minPayout:5};
 if(body.action==='onboard'){
  if(!account){account=await stripe.accounts.create({type:'express',capabilities:{transfers:{requested:true}},metadata:{userId:uid}});const saved=await admin.from('drivers').update({payout:{...d.payout,stripeAccountId:account.id}}).eq('user_id',uid);if(saved.error)throw new Error('La configuration n’a pas pu être enregistrée');}
  const link=await stripe.accountLinks.create({account:account.id,type:'account_onboarding',return_url:`${base}/driver/earnings?payout=done`,refresh_url:`${base}/driver/earnings?payout=refresh`});return {url:link.url};
 }
 throw new Error('Les retraits attendent la vérification du compte Stripe et de la réconciliation.');
}