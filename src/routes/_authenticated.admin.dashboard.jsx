import {createFileRoute} from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/lib/archive-navigation';
import { Route as RouteIcon, DollarSign, Car, Users, ArrowRight, Inbox } from 'lucide-react';
import MapView from '@/components/ArchiveMap';
import { useSocket } from '@/context/SocketProvider';
import { RideStatusBadge, Loading, money } from '@/components/ui/bits';
import { formatRelativeTime } from '@/lib/utils/geo';

function AdminDashboard() {
  const { socket } = useSocket();
  const [data, setData] = useState(null);
  const [liveDrivers, setLiveDrivers] = useState([]);
  const driversRef = useRef(new Map());

  async function load() {
    try {
      const res = await fetch('/api/admin/overview');
      if (res.ok) setData(await res.json());
    } catch { /* retry on next refresh */ }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  // Live driver positions + ride updates over the admin socket
  useEffect(() => {
    if (!socket) return undefined;

    const onLocation = (d) => {
      if (!d?.location) return;
      driversRef.current.set(d.driverProfileId, {
        id: d.driverProfileId,
        location: d.location,
      });
      setLiveDrivers([...driversRef.current.values()]);
    };
    const onRideUpdated = () => load();
    const onDriverStatus = (d) => {
      if (d.online === false) {
        driversRef.current.delete(d.driverProfileId);
        setLiveDrivers([...driversRef.current.values()]);
      }
      load();
    };

    socket.on('driver:location', onLocation);
    socket.on('ride:updated', onRideUpdated);
    socket.on('driver:status-changed', onDriverStatus);
    return () => {
      socket.off('driver:location', onLocation);
      socket.off('ride:updated', onRideUpdated);
      socket.off('driver:status-changed', onDriverStatus);
    };
  }, [socket]);

  if (!data) return <div className="content-pad"><Loading label="Chargement de la vue d’ensemble…" /></div>;

  // Build the 7-day revenue series (fill missing days with zero)
  const byDay = new Map((data.revenue7d || []).map((d) => [d._id, d]));
  const weekBars = [];
  let maxDayRevenue = 0;
  const week = { driverEarnings: 0, platformFees: 0, trips: 0 };
  const todayKey = new Date().toISOString().slice(0, 10);
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = byDay.get(key);
    const revenue = day?.revenue || 0;
    maxDayRevenue = Math.max(maxDayRevenue, revenue);
    week.driverEarnings += day?.driverEarnings || 0;
    week.platformFees += day?.platformFees || 0;
    week.trips += day?.trips || 0;
    weekBars.push({
      key,
      label: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      revenue,
      isToday: key === todayKey,
    });
  }

  const stats = [
    { label: 'Courses aujourd’hui', value: data.ridesToday, icon: RouteIcon, tone: 'var(--info)' },
    { label: 'En cours actuellement', value: data.activeRides, icon: Car, tone: 'var(--gold-600)' },
    { label: 'Montant brut des réservations aujourd’hui', value: money(data.revenueToday), icon: DollarSign, tone: 'var(--success)' },
    { label: 'Chauffeurs en ligne', value: data.onlineDrivers, icon: Users, tone: 'var(--ink-700)' },
  ];

  return (
    <div className="content-pad">
      <div className="flex items-center justify-between mb-6 wrap gap-3">
        <div>
          <h1 className="page-title">Vue d’ensemble</h1>
          <p className="page-sub">État de la plateforme en temps réel</p>
        </div>
        <div className="flex gap-2 wrap">
          {data.pendingDrivers > 0 && (
            <Link href="/admin/drivers?pending=1" className="btn btn-gold btn-sm">
              {data.pendingDrivers} chauffeur{data.pendingDrivers > 1 ? 's' : ''} en attente d’approbation
              <ArrowRight size={15} />
            </Link>
          )}
          {data.openSupport > 0 && (
            <Link href="/admin/support" className="btn btn-secondary btn-sm">
              <Inbox size={15} /> {data.openSupport} message d’assistance ouvert{data.openSupport > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      </div>

      <div className="grid-4">
        {stats.map(({ label, value, icon: Icon, tone }) => ( <div key={label} className="card card-pad flex items-center gap-3">
            <span className="avatar" style={{ background: 'var(--ink-50)', color: tone }}>
              <Icon size={19} />
            </span>
            <div className="stat">
              <span className="stat-label">{label}</span>
              <span className="stat-value" style={{ fontSize: '1.4rem' }}>{value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-split mt-4">
        <div className="card" style={{ height: 380, overflow: 'hidden', position: 'relative' }}>
          <MapView center={{ lat: 40.7128, lng: -74.006 }} zoom={12} drivers={liveDrivers} />
          <span
            className="badge badge-success badge-dot"
            style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, background: '#fff', boxShadow: 'var(--shadow-sm)' }}
          >
            {liveDrivers.length} chauffeur en direct{liveDrivers.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="card card-pad" style={{ overflowY: 'auto', maxHeight: 380 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="small" style={{ fontWeight: 700 }}>Courses récentes</h3>
            <Link href="/admin/rides" className="tiny" style={{ fontWeight: 600, color: 'var(--gold-700)' }}> Tout voir </Link>
          </div>
          <div className="flex-col gap-3">
            {data.recentRides.length === 0 && <p className="small muted">Aucune course pour le moment.</p>}
            {data.recentRides.map((r) => ( <div key={r._id} className="flex items-center gap-3" style={{ borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="tiny truncate" style={{ fontWeight: 600 }}>
                    {r.riderId?.name || '—'} → {r.dropoff?.address}
                  </div>
                  <div className="tiny muted">{formatRelativeTime(r.createdAt)}</div>
                </div>
                <RideStatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7-day money flow: revenue split between drivers and platform */}
      <div className="card card-pad mt-4">
        <div className="flex items-center justify-between mb-4 wrap gap-2">
          <h3 className="small" style={{ fontWeight: 700 }}>7 derniers jours</h3>
          <span className="tiny muted">
            {money(week.driverEarnings)} aux chauffeurs · {money(week.platformFees)} de frais de plateforme ·{' '}
            {week.trips} courses
          </span>
        </div>
        <div className="flex gap-2" style={{ height: 110, alignItems: 'flex-end' }}>
          {weekBars.map((bar) => ( <div key={bar.key} className="flex-col items-center gap-2 flex-1">
              <div
                title={`${bar.label} : ${money(bar.revenue)}`}
                style={{
                  width: '100%',
                  maxWidth: 56,
                  height: Math.max(4, maxDayRevenue ? (bar.revenue / maxDayRevenue) * 84 : 4),
                  borderRadius: 6,
                  background: bar.isToday ? 'var(--gold-600)' : 'var(--ink-900)',
                  opacity: bar.revenue === 0 ? 0.15 : 1,
                  transition: 'height 400ms var(--ease)',
                }}
              />
              <span className="tiny muted">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-4 mt-4">
        <div className="card card-pad stat">
          <span className="stat-label">Total des passagers</span>
          <span className="stat-value">{data.totalUsers}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">Total des chauffeurs</span>
          <span className="stat-value">{data.totalDrivers}</span>
        </div>
        <div className="card card-pad stat">
          <span className="stat-label">Frais de plateforme aujourd’hui</span>
          <span className="stat-value">{money(data.platformFeesToday)}</span>
                  </div>
        <div className="card card-pad stat">
          <span className="stat-label">Terminées cette semaine</span>
          <span className="stat-value">{data.statusBreakdown?.completed || 0}</span>
          <span className="tiny muted">
            {data.statusBreakdown?.cancelled || 0} annulées · {data.statusBreakdown?.no_drivers || 0} sans chauffeur
          </span>
        </div>
      </div>
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/admin/dashboard')({head:()=>({meta:[{title:"Vue d’ensemble · StrasDrive"},{name:'description',content:"StrasDrive — vue d’ensemble, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Vue d’ensemble · StrasDrive"},{property:'og:description',content:"StrasDrive — vue d’ensemble, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <AdminLayout><AdminDashboard/></AdminLayout>});
