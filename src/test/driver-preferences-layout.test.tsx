import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {Route} from '../routes/_authenticated.driver.preferences';
import {getNavApp,NAV_APPS} from '../lib/navigation';
const fixture=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('@/components/DriverLayout',()=>({default:({children}:any)=><div>{children}</div>}));
vi.mock('@/lib/archive-navigation',()=>({default:({href,children,...props}:any)=><a href={href} {...props}>{children}</a>}));
vi.mock('@/lib/archive-fetch',()=>({apiFetch:(...args:any[])=>fixture.request(...args)}));
vi.mock('@/components/ui/Toast',()=>({useToast:()=>vi.fn()}));
afterEach(()=>{cleanup();fixture.request.mockReset();localStorage.clear();});
function setup(){
  let driver:any={vehicleClass:'economy',lowerClasses:['pet'],acceptsClasses:[],tripPrefs:{acceptCash:true,minRiderRating:null,minPayPerKm:null}};
  fixture.request.mockImplementation(async(path:string,options:any)=>{
    if(options?.method==='PATCH'){
      const body=JSON.parse(options.body);
      driver={...driver,...(body.acceptsClasses?{acceptsClasses:body.acceptsClasses}:{}),tripPrefs:{...driver.tripPrefs,...body.tripPrefs}};
    }
    return{ok:true,json:async()=>({driver})};
  });
  const Component=Route.options.component as any;render(<Component/>);
}
it('propose les trois rubriques et une croix vers le menu',async()=>{
  setup();await screen.findByText('Les courses qui vous correspondent');
  expect(screen.getByRole('link',{name:'Fermer les préférences'}).getAttribute('href')).toBe('/driver/menu');
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(screen.getByRole('tab',{name:/Services/}).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('checkbox',{name:/StrasDrive Pet/}));
  await waitFor(()=>expect(fixture.request).toHaveBeenCalledWith('/api/drivers/me/classes',expect.objectContaining({method:'PATCH',body:JSON.stringify({acceptsClasses:['pet']})})));
});
it('conserve les mêmes champs de préférences sans toucher aux prix',async()=>{
  setup();await screen.findByText('Les courses qui vous correspondent');
  fireEvent.click(screen.getByRole('tab',{name:/Critères/}));
  fireEvent.change(screen.getByRole('combobox',{name:/Note minimale/}),{target:{value:'4.7'}});
  await waitFor(()=>expect(fixture.request).toHaveBeenCalledWith('/api/drivers/me/preferences',expect.objectContaining({body:JSON.stringify({tripPrefs:{minRiderRating:4.7}})})));
  await waitFor(()=>expect((screen.getByRole('combobox',{name:/Gain minimum/}) as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(screen.getByRole('combobox',{name:/Gain minimum/}),{target:{value:'1.5'}});
  await waitFor(()=>expect(fixture.request).toHaveBeenCalledWith('/api/drivers/me/preferences',expect.objectContaining({body:JSON.stringify({tripPrefs:{minPayPerKm:1.5}})})));
});
it('garde le choix GPS local et la possibilité de le retirer',async()=>{
  setup();await screen.findByText('Les courses qui vous correspondent');
  fireEvent.click(screen.getByRole('tab',{name:/GPS/}));
  const [id,label]=Object.entries(NAV_APPS)[0] as [string,string];
  fireEvent.click(screen.getByRole('radio',{name:label}));expect(getNavApp()).toBe(id);
  fireEvent.click(screen.getByRole('button',{name:'Me demander à chaque trajet'}));expect(getNavApp()).toBeNull();
  expect(fixture.request.mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(false);
});
