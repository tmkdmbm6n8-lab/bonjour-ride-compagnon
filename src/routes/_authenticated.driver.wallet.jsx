import {createFileRoute} from '@tanstack/react-router';
import DriverLayout from '@/components/DriverLayout';
'use client';

import { Suspense } from 'react';
import WalletPanel from '@/components/wallet/WalletPanel';
import { Loading } from '@/components/ui/bits';

function WalletPage() {
  return (
    <div className="driver-account-page"><Suspense fallback={<div className="content-pad"><Loading /></div>}>
      <WalletPanel />
    </Suspense></div>
  );
}

export const Route=createFileRoute('/_authenticated/driver/wallet')({head:()=>({meta:[{title:"Portefeuille chauffeur · StrasDrive"},{name:'description',content:"StrasDrive — portefeuille chauffeur, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Portefeuille chauffeur · StrasDrive"},{property:'og:description',content:"StrasDrive — portefeuille chauffeur, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <DriverLayout><WalletPage/></DriverLayout>});
