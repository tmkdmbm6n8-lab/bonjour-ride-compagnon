import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function SwipeInboxItem({ children, label, onDelete }) {
  const [offset, setOffset] = useState(0);
  const gesture = useRef(null), suppressClick = useRef(false);
  function start(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, start: offset, horizontal: false };
    suppressClick.current = false;
  }
  function move(event) {
    const current=gesture.current;if(!current)return;
    const dx=event.clientX-current.x, dy=event.clientY-current.y;
    if(!current.horizontal && Math.abs(dy)>Math.abs(dx) && Math.abs(dy)>8){gesture.current=null;return;}
    if(Math.abs(dx)>10){current.horizontal=true;suppressClick.current=true;}
    if(current.horizontal) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setOffset(Math.max(-84,Math.min(0,current.start+dx)));
    }
  }
  function finish(event) {
    const current=gesture.current;if(!current)return;
    gesture.current=null;
    if(current.horizontal) {
      const end=Math.max(-84,Math.min(0,current.start+event.clientX-current.x));
      setOffset(end < -35 ? -84 : 0);
    }
  }
  return <div className="inbox-swipe-item">
    <button type="button" className="inbox-swipe-delete" aria-label={`Supprimer ${label}`} onClick={onDelete}><Trash2 size={24} /></button>
    <div className="inbox-swipe-content" style={{transform:`translateX(${offset}px)`}} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{gesture.current=null;setOffset(0);}}
      onClickCapture={(event)=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}}}>
      {children}
    </div>
  </div>;
}
