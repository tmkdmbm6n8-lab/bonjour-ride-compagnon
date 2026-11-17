// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ fetch:vi.fn(),toast:vi.fn() }));
vi.mock('@/lib/archive-fetch',()=>({apiFetch:mocks.fetch}));
vi.mock('@/components/ui/Toast',()=>({useToast:()=>mocks.toast}));
import ChatAttachments from '@/components/ride/ChatAttachments';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();mocks.fetch.mockReset();mocks.toast.mockReset()});
describe('pièces jointes de discussion',()=>{
 it('partage la position uniquement au clic explicite',async()=>{
  const locate=vi.fn((success:any)=>success({coords:{latitude:48.5,longitude:7.7}}));
  vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:locate}});
  mocks.fetch.mockResolvedValue({ok:true,json:async()=>({ok:true})});
  render(<ChatAttachments rideId="ride"/>);expect(locate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Ajouter une pièce jointe'}));
  fireEvent.click(screen.getByRole('button',{name:'Partager ma position'}));
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalled());
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({type:'location',lat:48.5,lng:7.7});
 });
 it('explique un microphone indisponible sans envoyer de message',async()=>{
  vi.stubGlobal('navigator',{});render(<ChatAttachments rideId="ride"/>);
  fireEvent.pointerDown(screen.getByRole('button',{name:'Enregistrer un vocal'}),{clientX:0,pointerId:1});
  expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('navigateur'),'error');expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it('maintenir pour parler : fermer le panneau coupe le micro sans envoyer',async()=>{
  const stopTrack=vi.fn();
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop:stopTrack}]}))}});
  let rec:any;
  class Recorder { static isTypeSupported(){return true} state='inactive';mimeType='audio/webm';onstop:any;ondataavailable:any;constructor(){rec=this}start(){this.state='recording'}stop(){this.state='inactive';this.onstop?.()} }
  vi.stubGlobal('MediaRecorder',Recorder);
  const view=render(<ChatAttachments rideId="ride"/>);
  fireEvent.pointerDown(screen.getByRole('button',{name:'Enregistrer un vocal'}),{clientX:200,pointerId:1});
  await screen.findByText('Glisser jusqu’au bout pour supprimer');
  view.unmount();expect(stopTrack).toHaveBeenCalled();expect(rec.state).toBe('inactive');expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it('glisser jusqu’au bout supprime le vocal tout de suite, sans relâcher ni envoyer',async()=>{
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop:vi.fn()}]}))}});
  let rec:any;
  class Recorder { static isTypeSupported(){return true} state='inactive';mimeType='audio/webm';onstop:any;ondataavailable:any;constructor(){rec=this}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['x'])});this.onstop?.()} }
  vi.stubGlobal('MediaRecorder',Recorder);
  render(<ChatAttachments rideId="ride"/>);
  const mic=screen.getByRole('button',{name:'Enregistrer un vocal'});
  fireEvent.pointerDown(mic,{clientX:300,pointerId:1});
  await screen.findByRole('status');
  const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+3000);
  fireEvent.pointerMove(mic,{clientX:20});
  expect(rec.state).toBe('inactive');
  expect(screen.queryByText('Glisser jusqu’au bout pour supprimer')).toBeNull();
  fireEvent.pointerUp(mic,{clientX:20});
  await new Promise(r=>setTimeout(r,20));
  expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it('relâcher au milieu de la barre envoie quand même le vocal',async()=>{
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop:vi.fn()}]}))}});
  class Recorder { static isTypeSupported(){return true} state='inactive';mimeType='audio/webm';onstop:any;ondataavailable:any;start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['x'])});this.onstop?.()} }
  vi.stubGlobal('MediaRecorder',Recorder);
  mocks.fetch.mockResolvedValue({ok:true,json:async()=>({ok:true})});
  render(<ChatAttachments rideId="ride"/>);
  const mic=screen.getByRole('button',{name:'Enregistrer un vocal'});
  fireEvent.pointerDown(mic,{clientX:300,pointerId:1});
  await screen.findByRole('status');
  const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+3000);
  fireEvent.pointerMove(mic,{clientX:160});fireEvent.pointerUp(mic,{clientX:160});
  console.log('TOAST',JSON.stringify(mocks.toast.mock.calls));
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalled());
  expect(mocks.fetch.mock.calls[0][0]).toBe('/api/rides/ride/attachment');
 });
 it('refuse une image trop grande avant l’envoi',()=>{
  const {container}=render(<ChatAttachments rideId="ride"/>);
  const file=new File([new Uint8Array(4*1024*1024+1)],'photo.jpg',{type:'image/jpeg'});
  fireEvent.change(container.querySelector('input[type="file"]')!,{target:{files:[file]}});
  expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('4 Mo'),'error');
 });
});
