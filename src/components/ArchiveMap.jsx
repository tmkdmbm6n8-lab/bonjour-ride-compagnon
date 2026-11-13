import {ClientOnly} from '@tanstack/react-router';
import {lazy,Suspense} from 'react';
const Map=lazy(()=>import('./maps/MapView'));
export default function ArchiveMap(props){return <ClientOnly fallback={null}><Suspense fallback={null}><Map {...props}/></Suspense></ClientOnly>;}