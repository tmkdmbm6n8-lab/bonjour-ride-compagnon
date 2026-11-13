import {createFileRoute} from '@tanstack/react-router';
import RiderLayout from '@/components/RiderLayout';
'use client';

import ProfileCard from '@/components/profile/ProfileCard';

function RiderProfilePage() {
  return (
    <div className="content-pad" style={{ maxWidth: 640 }}>
      <h1 className="page-title">Profil</h1>
      <p className="page-sub mb-6">Les informations de votre compte</p>
      <ProfileCard />
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/profile')({head:()=>({meta:[{title:"Profil client · StrasDrive"},{name:'description',content:"StrasDrive — profil client, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Profil client · StrasDrive"},{property:'og:description',content:"StrasDrive — profil client, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <RiderLayout><RiderProfilePage/></RiderLayout>});
