import DriverReturnBar from '@/components/shell/DriverReturnBar';
import { useEffect, useState } from 'react';
import { CarFront, ChevronRight } from 'lucide-react';
import Link from '@/lib/archive-navigation';
import { apiFetch } from '@/lib/archive-fetch';
import {createFileRoute} from '@tanstack/react-router';
import RiderLayout from '@/components/RiderLayout';
'use client';

import ProfileCard from '@/components/profile/ProfileCard';

function DriverApplicationLink() {
  const [canDrive, setCanDrive] = useState(null);
  useEffect(() => {
    let ignore = false;
    apiFetch("/api/users/me").then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (!ignore) setCanDrive(data.user?.canDrive === true || data.user?.role === "driver");
    }).catch(() => {});
    return () => { ignore = true; };
  }, []);
  if (canDrive !== false) return null;
  return <Link href="/become-driver" className="sd-become-driver-menu-link">
    <CarFront size={21} aria-hidden="true" />
    <span>Devenir chauffeur <small>Rejoindre StrasDrive</small></span>
    <ChevronRight size={20} aria-hidden="true" />
  </Link>;
}

function RiderProfilePage() {
  return (
    <div className="content-pad" style={{ maxWidth: 640 }}>
      <h1 className="page-title">Menu</h1>
      <p className="page-sub mb-6">Les informations de votre compte</p>
      <DriverReturnBar/>
      <DriverApplicationLink />
      <ProfileCard />
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/profile')({head:()=>({meta:[{title:"Profil client · StrasDrive"},{name:'description',content:"StrasDrive — profil client, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Profil client · StrasDrive"},{property:'og:description',content:"StrasDrive — profil client, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <RiderLayout><RiderProfilePage/></RiderLayout>});
