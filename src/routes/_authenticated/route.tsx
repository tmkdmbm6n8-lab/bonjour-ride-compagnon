import {createFileRoute,Outlet,redirect} from '@tanstack/react-router';
import {verifySessionUser} from '@/lib/archive-auth';
export const Route=createFileRoute('/_authenticated')({ssr:false,beforeLoad:async()=>{const {data:{user}}=await verifySessionUser();if(!user)throw redirect({to:'/login'});},component:Outlet});