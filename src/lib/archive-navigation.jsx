import {Link as RouterLink,useLocation,useNavigate,useParams as routerParams,useRouter as routerHook} from '@tanstack/react-router';
import {useMemo} from 'react';
export default function Link({href,...props}) {return <RouterLink to={href} {...props}/>;}
export function usePathname(){return useLocation().pathname;}
export function useSearchParams(){const search=useLocation().searchStr;return useMemo(()=>new URLSearchParams(search),[search]);}
export function useParams(){return routerParams({strict:false});}
export function useRouter(){const navigate=useNavigate(),router=routerHook();return useMemo(()=>({push:path=>navigate({to:path}),replace:path=>navigate({to:path,replace:true}),back:()=>router.history.back(),refresh:()=>router.invalidate()}),[navigate,router]);}