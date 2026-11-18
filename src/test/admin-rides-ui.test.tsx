import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {Route} from '../routes/_authenticated.admin.rides';
const fixture=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('@/components/AdminLayout',()=>({default:({children}:any)=><div>{children}</div>}));
vi.mock('@/components/admin/AdminRideRecord',()=>({default:({id}:any)=>id?<div role="dialog">Dossier {id}</div>:null}));
vi.mock('@/lib/archive-fetch',()=>({apiFetch:(...args:any[])=>fixture.request(...args)}));
afterEach(()=>{cleanup();fixture.request.mockReset();});
it('filtre les réservations par date et ouvre le dossier de la course',async()=>{
  fixture.request.mockResolvedValue({ok:true,json:async()=>({rides:[{_id:'ride-1',createdAt:'2026-11-18T09:00:00Z',status:'completed',riderId:{name:'Client'},driverId:{name:'Chauffeur'},pickup:{address:'Départ'},dropoff:{address:'Arrivée'},vehicleType:'economy',fare:{total:10}}],pagination:{page:1,pages:1,total:1}})});
  const Component=Route.options.component as any;render(<Component/>);
  await screen.findByText('Client');
  fireEvent.change(screen.getByLabelText('Jour de réservation · heure de Paris'),{target:{value:'2026-11-18'}});
  await waitFor(()=>expect(fixture.request.mock.calls.some(([path])=>new URL(path,'https://example.test').searchParams.get('day')==='2026-11-18')).toBe(true));
  await screen.findByText('Client');
  fireEvent.click(screen.getByRole('button',{name:'Ouvrir le dossier de la course ride-1'}));
  expect(screen.getByRole('dialog').textContent).toContain('ride-1');
});
