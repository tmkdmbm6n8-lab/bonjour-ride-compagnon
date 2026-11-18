import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import SwipeInboxItem from '../components/driver/SwipeInboxItem';
afterEach(cleanup);
it('révèle la corbeille par glissement sans ouvrir la conversation',()=>{
  const open=vi.fn(),remove=vi.fn();
  render(<SwipeInboxItem label="Conversation" onDelete={remove}><button onClick={open}>Ouvrir</button></SwipeInboxItem>);
  const content=screen.getByRole('button',{name:'Ouvrir'}).parentElement!;
  fireEvent.pointerDown(content,{clientX:200,clientY:20,pointerId:1,pointerType:'touch'});
  fireEvent.pointerMove(content,{clientX:110,clientY:22,pointerId:1,pointerType:'touch'});
  fireEvent.pointerUp(content,{clientX:110,clientY:22,pointerId:1,pointerType:'touch'});
  expect(content.style.transform).toBe('translateX(-84px)');
  fireEvent.click(screen.getByRole('button',{name:'Ouvrir'}));expect(open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Supprimer Conversation'}));expect(remove).toHaveBeenCalledTimes(1);
});
it('laisse le défilement vertical et ne supprime rien',()=>{
  const remove=vi.fn();
  render(<SwipeInboxItem label="Conversation" onDelete={remove}><button>Ouvrir</button></SwipeInboxItem>);
  const content=screen.getByRole('button',{name:'Ouvrir'}).parentElement!;
  fireEvent.pointerDown(content,{clientX:200,clientY:20,pointerId:1,pointerType:'touch'});
  fireEvent.pointerMove(content,{clientX:195,clientY:70,pointerId:1,pointerType:'touch'});
  fireEvent.pointerUp(content,{clientX:195,clientY:70,pointerId:1,pointerType:'touch'});
  expect(content.style.transform).toBe('translateX(0px)');expect(remove).not.toHaveBeenCalled();
});
