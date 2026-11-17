import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mock=vi.hoisted(()=>({load:vi.fn(),maps:[] as any[],lines:[] as any[],overlays:[] as any[]}));
vi.mock('@/lib/google-maps-loader',()=>({loadGoogleMaps:mock.load}));
import MapView from '@/components/maps/MapView';
class GoogleMap {
 listeners:any={};panTo=vi.fn();setZoom=vi.fn();getZoom=()=>13;fitBounds=vi.fn();
 constructor(...args:any[]){mock.maps.push(this)}
 addListener(name:string,fn:any){this.listeners[name]=fn;return {remove:vi.fn()}}
}
class Overlay {
 position:any;element:any;
 onAdd(){}draw(){}onRemove(){}
 constructor(){mock.overlays.push(this)}
 setMap(map:any){if(map){this.onAdd();this.draw()}else this.onRemove()}
 getPanes(){return {overlayMouseTarget:document.body}}
 getProjection(){return {fromLatLngToDivPixel:()=>({x:10,y:20})}}
}
class Polyline {setMap=vi.fn();options:any;constructor(options:any){this.options=options;mock.lines.push(this)}}
beforeEach(()=>{
 mock.maps.length=0;mock.lines.length=0;mock.overlays.length=0;
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 mock.load.mockReset().mockResolvedValue({Map:GoogleMap,OverlayView:Overlay,Polyline,LatLng:class{constructor(p:any){Object.assign(this,p)}},LatLngBounds:class{extend(){}},event:{trigger:vi.fn(),clearInstanceListeners:vi.fn(),addListenerOnce:()=>({remove:vi.fn()})}});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
describe('carte Google Maps',()=>{
 it('rend les positions reçues avant le chargement du SDK et convertit le tracé lng/lat',async()=>{
  render(<MapView pickup={{lat:48,lng:7}} dropoff={{lat:49,lng:8}} routeGeometry={[[7,48],[8,49]]} fit/>);
  await waitFor(()=>expect(mock.lines).toHaveLength(3));
  expect(mock.overlays).toHaveLength(2);expect(mock.lines[1].options.path).toEqual([{lat:48,lng:7},{lat:49,lng:8}]);
  expect(mock.maps[0].fitBounds).toHaveBeenCalled();
 });
 it('transmet le clic carte et retire les marqueurs et tracés au démontage',async()=>{
  const click=vi.fn();const view=render(<MapView pickup={{lat:48,lng:7}} onClick={click} routeGeometry={[[7,48],[8,49]]}/>);
  await waitFor(()=>expect(mock.lines).toHaveLength(3));
  mock.maps[0].listeners.click({latLng:{lat:()=>48.2,lng:()=>7.3}});expect(click).toHaveBeenCalledWith({lat:48.2,lng:7.3});
  view.unmount();expect(document.querySelector('.marker-pin')).toBeNull();expect(mock.lines[0].setMap).toHaveBeenCalledWith(null);
 });
 it('présente une erreur et permet de réessayer si le SDK est indisponible',async()=>{
  mock.load.mockRejectedValueOnce(new Error('Chargement impossible'));
  render(<MapView/>);await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Réessayer'}));
  await waitFor(()=>expect(mock.maps).toHaveLength(1));
 });
});
