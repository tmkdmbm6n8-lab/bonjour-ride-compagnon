import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/lib/archive-fetch',()=>({apiFetch:mocks.fetch}));
vi.mock('recharts',()=>({ResponsiveContainer:({children}:any)=><div>{children}</div>,AreaChart:({children}:any)=><div>{children}</div>,LineChart:({children}:any)=><div>{children}</div>,Area:()=>null,Line:()=>null,XAxis:()=>null,YAxis:()=>null,CartesianGrid:()=>null,Tooltip:()=>null,Legend:()=>null}));
import { MonitoringPage } from '@/routes/_authenticated.admin.monitoring';
const payload={sampledAt:'2026-11-17T10:00:00Z',driversOnline:100,activeRides:12,searchingRides:3,completedLastHour:40,activityQueryMs:9,connectedClients:null,infrastructure:{cpuPercent:null,memoryPercent:null,capacityPercent:null},objectives:{drivers:500,clients:10000}};
beforeEach(()=>{mocks.fetch.mockReset();mocks.fetch.mockResolvedValue({ok:true,json:async()=>payload})});afterEach(cleanup);
describe('supervision du site',()=>{
 it('présente les données mesurées et indique que le pourcentage vise un objectif',async()=>{
  render(<MonitoringPage/>);await screen.findByText('Activité du réseau');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
  expect(screen.getByText('20 %')).toBeVisible();expect(screen.getByText('Non mesuré')).toBeVisible();
  expect(screen.getByText(/ne représentent pas la saturation/)).toBeVisible();
  expect(screen.getByText('Mesures de l’hébergeur à connecter')).toBeVisible();
  expect(mocks.fetch).toHaveBeenCalledWith('/api/admin/monitoring');
 });
 it('conserve les dernières données si une actualisation échoue',async()=>{
  render(<MonitoringPage/>);await screen.findByText('Activité du réseau');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Actualiser les mesures'})).toBeEnabled());
  mocks.fetch.mockRejectedValueOnce(new Error('Connexion perdue'));
  fireEvent.click(screen.getByRole('button',{name:'Actualiser les mesures'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('dernières valeurs connues');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
 });
});
