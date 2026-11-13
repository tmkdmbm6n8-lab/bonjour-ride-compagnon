import {createFileRoute} from '@tanstack/react-router';
import RiderLayout from '@/components/RiderLayout';
'use client';

import { Suspense } from 'react';
import WalletPanel from '@/components/wallet/WalletPanel';
import { Loading } from '@/components/ui/bits';

function WalletPage() {
  return (
    <Suspense fallback={<div className="content-pad"><Loading /></div>}>
      <WalletPanel />
    </Suspense>
  );
}

export const Route=createFileRoute('/_authenticated/wallet')({head:()=>({meta:[{title:"Portefeuille client · StrasDrive"},{name:'description',content:"StrasDrive — portefeuille client, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Portefeuille client · StrasDrive"},{property:'og:description',content:"StrasDrive — portefeuille client, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <RiderLayout><WalletPage/></RiderLayout>});
