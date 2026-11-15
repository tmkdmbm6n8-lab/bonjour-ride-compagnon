import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { HelpCircle, ShieldCheck, Settings, Compass, BadgeCheck, Gift, Car, FileText, Umbrella, Calculator, CreditCard, BookOpen, Bug, Info, ChevronRight, Star } from 'lucide-react';
import DriverLayout from '@/components/DriverLayout';
import Link from '@/lib/archive-navigation';
import { signOut, useSession } from '@/lib/archive-auth';
import useDriverData from '@/hooks/useDriverData';
import { Avatar } from '@/components/ui/bits';
import Modal from '@/components/ui/Modal';
import Waybill from '@/components/driver/Waybill';

function MenuRow({ icon: Icon, label, value, href, onClick }) {
  const content = <><span className="drv-ico"><Icon size={20} /></span><span>{label}{value && <small>{value}</small>}</span><ChevronRight size={22} /></>;
  return href ? <Link href={href} className="driver-menu-row">{content}</Link> : <button className="driver-menu-row" onClick={onClick}>{content}</button>;
}
function DriverMenuPage() {
  const { data: session } = useSession();
  const { data, error } = useDriverData('/api/users/me', 0);
  const { data: driverData } = useDriverData('/api/drivers/me', 0);
  const [panel, setPanel] = useState(null), [waybill, setWaybill] = useState(false), [shareState, setShareState] = useState('');
  const user = data?.user || session?.user || {};
  const driver = driverData?.driver;
  async function invite() {
    const url = `${window.location.origin}/signup`;
    try {
      if (navigator.share) await navigator.share({ title: 'StrasDrive', text: 'Découvrez StrasDrive à Strasbourg.', url });
      else { await navigator.clipboard.writeText(url); setShareState('Lien d’inscription copié.'); }
    } catch { setShareState(`Lien d’inscription : ${url}`); }
  }
  return <div className="driver-tab-page driver-menu-page">
    {error && <p className="driver-notice" role="alert">{error}</p>}
    <Link href="/driver/profile" className="driver-profile-tile"><Avatar name={user.name || ''} src={user.avatar || ''} size="lg" /><h1>{user.name || 'Mon compte'}</h1><span><Star size={17} fill="currentColor" />{Number(user.rating?.average ?? driver?.stats?.averageRating ?? 5).toFixed(2)}</span></Link>
    <div className="driver-menu-shortcuts"><Link href="/driver/inbox"><HelpCircle size={28} />Aide</Link><button onClick={() => setPanel('safety')}><ShieldCheck size={28} />Sécurité</button><Link href="/driver/profile"><Settings size={28} />Paramètres</Link></div>
    <section><h2>Plus d’opportunités</h2><div className="drv-group"><MenuRow icon={Compass} label="Découvrir les opportunités" href="/driver/discover" /><MenuRow icon={BadgeCheck} label="Mon statut chauffeur" value={driver ? driver.isApproved ? 'Approuvé' : 'En attente d’approbation' : 'Chargement…'} href="/driver/profile" /><MenuRow icon={Gift} label="Inviter des amis" onClick={invite} />{shareState && <p className="driver-feed-note" role="status">{shareState}</p>}</div></section>
    <section><h2>Gérer</h2><div className="drv-group"><MenuRow icon={Car} label="Véhicules" value={driver?.vehicle ? [driver.vehicle.make, driver.vehicle.model, driver.vehicle.plate].filter(Boolean).join(' · ') : ''} href="/driver/profile#driver-vehicle" /><MenuRow icon={FileText} label="Documents" href="/driver/profile#driver-documents" /><MenuRow icon={Umbrella} label="Assurance" href="/driver/profile#driver-documents" /></div></section>
    <section><h2>Argent</h2><div className="drv-group"><MenuRow icon={Calculator} label="Informations de l’exploitant" onClick={() => setWaybill(true)} /><MenuRow icon={CreditCard} label="Modes de versement" href="/driver/wallet" /><MenuRow icon={FileText} label="Mes courses" href="/driver/trips" /></div></section>
    <section><h2>Ressources</h2><div className="drv-group"><MenuRow icon={BookOpen} label="Conseils et informations" onClick={() => setPanel('tips')} /><MenuRow icon={Bug} label="Signaler un problème" href="/driver/inbox" /><MenuRow icon={Info} label="À propos" onClick={() => setPanel('about')} /></div></section>
    <div className="driver-menu-account"><button onClick={() => signOut({ callbackUrl: '/login' })}>Changer de compte</button><button onClick={() => signOut({ callbackUrl: '/' })}>Se déconnecter<small>{user.email || ''}</small></button></div>
    <Waybill open={waybill} onClose={() => setWaybill(false)} />
    <Modal open={panel !== null} onClose={() => setPanel(null)} title={panel === 'safety' ? 'Sécurité' : panel === 'tips' ? 'Conseils et informations' : 'À propos de StrasDrive'}><div className="flex-col gap-3">{panel === 'safety' ? <><p>Retrouvez vos documents professionnels, la discussion avec le client et les informations de votre course dans l’application.</p><Link href="/driver/profile#driver-documents">Mes documents</Link><Link href="/driver/inbox">Contacter l’administration</Link></> : panel === 'tips' ? <><p>Consultez les arrivées dans Découvrir avant de vous déplacer. Le signal de retour potentiel informe d’une arrivée, sans garantir une réservation.</p><p>Avant le départ, vérifiez le point de prise en charge et le code PIN du client. Vos préférences de conduite restent accessibles depuis les réglages.</p><Link href="/driver/preferences">Préférences de conduite</Link></> : <><p>StrasDrive · Service de réservation VTC à Strasbourg.</p><Link href="/mentions-legales">Mentions légales</Link><Link href="/terms">Conditions d’utilisation</Link><Link href="/privacy">Politique de confidentialité</Link></>}</div></Modal>
  </div>;
}
export const Route = createFileRoute('/_authenticated/driver/menu')({ head: () => ({ meta: [{ title: 'Menu chauffeur · StrasDrive' }] }), component: () => <DriverLayout><DriverMenuPage /></DriverLayout> });