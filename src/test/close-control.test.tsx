import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {createRef} from 'react';
import CloseControl from '../components/ui/CloseControl';
import Modal from '../components/ui/Modal';
import DriverPageClose from '../components/driver/DriverPageClose';
vi.mock('@/lib/archive-navigation',()=>({default:({href,children,...props}:any)=><a href={href} {...props}>{children}</a>}));
vi.mock('@/hooks/useVisualViewport',()=>({default:()=>null}));
afterEach(cleanup);
it('garde la destination et le même style pour une croix de page',()=>{
  render(<><CloseControl href="/" label="Fermer l’inscription"/><DriverPageClose/></>);
  const signup=screen.getByRole('link',{name:'Fermer l’inscription'});
  const driver=screen.getByRole('link',{name:'Fermer et revenir au menu chauffeur'});
  expect(signup.getAttribute('href')).toBe('/');expect(driver.getAttribute('href')).toBe('/driver/menu');
  expect(signup.classList.contains('sd-close-control')).toBe(true);expect(driver.classList.contains('sd-close-control')).toBe(true);
});
it('préserve les callbacks, les refs et le blocage pendant une action',()=>{
  const close=vi.fn(),ref=createRef<HTMLButtonElement>();
  const {rerender}=render(<CloseControl label="Fermer" onClick={close} ref={ref}/>);
  expect(ref.current).toBe(screen.getByRole('button',{name:'Fermer'}));
  fireEvent.click(ref.current!);expect(close).toHaveBeenCalledOnce();
  rerender(<CloseControl label="Fermer" onClick={close} disabled/>);
  fireEvent.click(screen.getByRole('button',{name:'Fermer'}));expect(close).toHaveBeenCalledOnce();
});
it('la fenêtre commune ferme par la croix harmonisée',()=>{
  const close=vi.fn();render(<Modal open onClose={close} title="Fenêtre">Contenu</Modal>);
  const button=screen.getByRole('button',{name:'Fermer la boîte de dialogue'});
  expect(button.classList.contains('sd-close-control')).toBe(true);
  fireEvent.click(button);expect(close).toHaveBeenCalledOnce();
});
