import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DriverLayout from "@/components/DriverLayout";
import { Route as DiscoverRoute } from "@/routes/_authenticated.driver.discover";
import { Route as EarningsRoute } from "@/routes/_authenticated.driver.earnings";
import { Route as InboxRoute } from "@/routes/_authenticated.driver.inbox";
import { Route as MenuRoute } from "@/routes/_authenticated.driver.menu";
const fixtures = vi.hoisted(() => ({ data: {} as Record<string, any>, request: vi.fn() }));
vi.mock("@/lib/archive-fetch", () => ({ apiFetch: (...args: any[]) => fixtures.request(...args) }));
vi.mock("@/lib/native-push", () => ({ registerDriverPush: vi.fn() }));
vi.mock("@/components/shell/AppShell", () => ({
  default: ({ nav, children }: any) => (
    <>
      <nav>
        {nav.map((item: any) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      {children}
    </>
  ),
}));
vi.mock("@/lib/archive-navigation", () => ({
  useRouter:()=>({push:vi.fn()}),
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/useDriverData", () => ({
  default: (path: string) => ({
    data: fixtures.data[path.split("?")[0] as string] || null,
    error: "",
    reload: vi.fn(),
  }),
}));
vi.mock("@/lib/archive-auth", () => ({
  useSession: () => ({ data: { user: { id: "driver-a", name: "Tigran" } } }),
  signOut: vi.fn(),
}));
vi.mock("@/components/driver/PayoutCard", () => ({ default: () => <div>Versements</div> }));
vi.mock("@/components/driver/Waybill", () => ({ default: () => null }));
vi.mock("@/components/ArchiveMap", () => ({ default: () => <div>Carte</div> }));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ open, children, title }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));
vi.mock("@/hooks/useVisualViewport", () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  fixtures.data = {};
  fixtures.request.mockReset();
  localStorage.clear();
});
describe("onglets chauffeur", () => {
  it("sépare Découvrir, Inbox et Menu des préférences de conduite", () => {
    render(
      <DriverLayout>
        <div />
      </DriverLayout>,
    );
    expect(screen.getByRole("link", { name: "Trafic" }).getAttribute("href")).toBe("/driver/discover");
    expect(screen.getByRole("link", { name: "Inbox" }).getAttribute("href")).toBe("/driver/inbox");
    expect(screen.getByRole("link", { name: "Menu" }).getAttribute("href")).toBe("/driver/menu");
  });
  it("ne remplace pas une date non publiée par de faux vols", () => {
    fixtures.data["/api/drivers/me/discover"] = {
      day: "2026-11-15",
      items: [],
      feeds: [{ kind: "flight", warning: "Horaires non publiés" }],
    };
    const Component = DiscoverRoute.options.component as any;
    render(<Component />);
    expect(screen.queryByText("Horaires non publiés")).toBeNull();
    expect(screen.queryByText("Aucun horaire disponible pour cette sélection.")).toBeNull();
    expect(screen.getByText("Aucun flux d'arrivée répertorié pour le moment.")).toBeTruthy();
  });
  it("affiche les vrais totaux et permet de choisir un jour", () => {
    fixtures.data["/api/drivers/me/earnings"] = {
      week: {
        start: "2026-11-09",
        end: "2026-11-16",
        total: 42,
        trips: 2,
        onlineSeconds: 5400,
        activitySeconds: 3600,
        byDay: [
          { _id: "2026-11-09", earnings: 12, trips: 1, onlineSeconds: 2400, activitySeconds: 1200 },
          { _id: "2026-11-10", earnings: 30, trips: 1, onlineSeconds: 3000, activitySeconds: 2400 },
        ],
      },
      stats: { averageRating: 4.9 },
      wallet: { balance: 50 },
      recentRides: [],
    };
    const Component = EarningsRoute.options.component as any;
    render(<Component />);
    expect(screen.getByText(/42,00/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /9 nov.*12,00/ }));
    expect(screen.getByText(/12,00/)).toBeTruthy();
    expect(screen.getByText("0 h 40")).toBeTruthy();
  });
  it("affiche les fiches du jour demandé même après minuit", () => {
    fixtures.data["/api/drivers/me/earnings"] = {
      week: { start: "2026-11-16", end: "2026-11-23", total: 10.01, trips: 1, onlineSeconds: 60,
        byDay: [{ _id: "2026-11-17", earnings: 10.01, trips: 1, onlineSeconds: 60 }] },
      stats: {}, wallet: { balance: 0 },
      recentRides: [{ id: "yesterday", status: "completed", completedAt: "2026-11-17T21:26:00Z",
        pickup: { city: "Strasbourg" }, dropoff: { city: "Schiltigheim" }, fare: { driverEarnings: 10.01 } }],
    };
    const Component = EarningsRoute.options.component as any;
    render(<Component />);
    fireEvent.click(screen.getByRole("button", { name: /17 nov.*10,01/ }));
    expect(screen.queryByLabelText("Jour des courses")).toBeNull();
    expect(screen.getByText("Prise en charge à Strasbourg")).toBeTruthy();
    expect(screen.getByText("Dépose à Schiltigheim")).toBeTruthy();
    expect(screen.getByText("Vous avez gagné")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /De Strasbourg/ })).toBeNull();
  });
  it("ouvre une conversation administrateur réelle depuis Inbox", () => {
    fixtures.data["/api/drivers/me/inbox"] = {
      threads: [
        {
          id: "thread-1",
          subject: "Mon versement",
          messages: [
            { id: "m1", from: "admin", text: "Votre virement est en cours.", createdAt: "2026-11-15T10:00:00Z" },
          ],
          status: "open",
          updatedAt: "2026-11-15T10:00:00Z",
        },
      ],
      rides: [],
      hasMore: false,
    };
    const Component = InboxRoute.options.component as any;
    render(<Component />);
    fireEvent.click(screen.getByText("Mon versement").closest("button")!);
    expect(screen.getByRole("dialog", { name: "Mon versement" })).toBeTruthy();
    expect(screen.getByText("StrasDrive Régulation")).toBeTruthy();
  });
  it('montre les avertissements actifs dans l’Inbox', () => {
    fixtures.data['/api/drivers/me/inbox'] = { threads: [], rides: [], hasMore: false };
    fixtures.data['/api/drivers/me'] = { driver: { activeWarningsCount: 1 } };
    const Component = InboxRoute.options.component as any;
    render(<Component />);
    fireEvent.click(screen.getByRole('button', { name: /1 avertissement actif/ }));
    expect(screen.getByRole('dialog', { name: 'Vos avertissements' })).toBeTruthy();
    expect(screen.getByText(/À trois avertissements actifs/)).toBeTruthy();
    expect(screen.getByText(/pendant 14 jours, pendant 30 jours/)).toBeTruthy();
    expect(screen.getByText(/faits extrêmement graves/)).toBeTruthy();
  });
  it("garde l’administration seule et exige une confirmation avant suppression", async () => {
    fixtures.data["/api/drivers/me/inbox"] = {
      threads: [{id:'11111111-1111-1111-1111-111111111111',subject:'Conversation à supprimer',messages:[{id:'message',from:'admin',text:'Bonjour',createdAt:'2026-11-18T08:00:00Z'}],status:'open',updatedAt:'2026-11-18T08:00:00Z'}],
      rides:[{id:'passenger',messages:[{text:'Message passager invisible'}]}],hasMore:false,
    };
    fixtures.request.mockResolvedValue({ok:true,json:async()=>({driver:{isApproved:true},ok:true})});
    const Component=InboxRoute.options.component as any;
    render(<Component />);
    expect(screen.queryByText('Centre de messagerie')).toBeNull();
    expect(screen.queryByText('Passagers')).toBeNull();
    expect(screen.queryByText('Message passager invisible')).toBeNull();
    expect(screen.queryByRole('button',{name:'Supprimer Conversation à supprimer'})).toBeNull();
    const swipe=screen.getByText('Conversation à supprimer').closest('button')!.parentElement!;
    fireEvent.keyDown(swipe,{key:'ArrowLeft'});
    fireEvent.click(screen.getByRole('button',{name:'Supprimer Conversation à supprimer'}));
    expect(screen.getByRole('dialog',{name:'Supprimer cette conversation ?'})).toBeTruthy();
    expect(fixtures.request.mock.calls.filter(([,options])=>options?.method==='DELETE')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'Annuler'}));
    expect(screen.getByText('Conversation à supprimer')).toBeTruthy();
    const again=screen.getByText('Conversation à supprimer').closest('button')!.parentElement!;
    fireEvent.keyDown(again,{key:'ArrowLeft'});
    fireEvent.click(screen.getByRole('button',{name:'Supprimer Conversation à supprimer'}));
    fireEvent.click(screen.getByRole('button',{name:/^Supprimer$/}));
    await waitFor(()=>expect(screen.queryByText('Conversation à supprimer')).toBeNull());
    expect(fixtures.request.mock.calls.filter(([,options])=>options?.method==='DELETE')).toHaveLength(1);
  });
  it("ouvre la fiche chauffeur et ses distinctions depuis la photo et le nom", () => {
    fixtures.data["/api/users/me"]={user:{name:'Tigran',rating:{count:5,average:5}}};
    fixtures.data["/api/drivers/me"]={driver:{isApproved:true,vehicle:{make:'MG',model:'ZS'}}};
    fixtures.data["/api/drivers/me/achievements"]={name:'Tigran',vehicle:{make:'MG',model:'ZS'},memberSince:'2026-01-01T00:00:00Z',completedTrips:120,rating:{average:5,count:100},achievements:{count:100,next:{remaining:400},badges:[{threshold:50,name:'Première distinction',motif:'star',accent:'#e3b864',shape:'round',earned:true}]}};
    const Component=MenuRoute.options.component as any;
    render(<Component />);
    expect(screen.getByRole('link',{name:/Véhicule.*Documents/}).getAttribute('href')).toBe('/driver/profile');
    fireEvent.click(screen.getByRole('button',{name:'Ouvrir mon profil chauffeur et mes distinctions'}));
    expect(screen.getByRole('dialog',{name:'Votre profil chauffeur'})).toBeTruthy();
    expect(screen.getByText('Première distinction')).toBeTruthy();
    expect(screen.getByText('Badge actuel')).toBeTruthy();
  });
  it("propose des objets VTC et un objet libre uniquement dans Autre", async () => {
    fixtures.data["/api/drivers/me/inbox"]={threads:[],rides:[],hasMore:false};
    fixtures.request.mockResolvedValue({ok:true,json:async()=>({driver:{isApproved:true},thread:{id:'request',subject:'Question spécifique',messages:[],status:'open',updatedAt:'2026-11-18T11:00:00Z'}})});
    const Component=InboxRoute.options.component as any;render(<Component/>);
    fireEvent.click(screen.getByRole('button',{name:"Nouvelle demande d'assistance"}));
    expect(screen.getByRole('combobox',{name:'Objet de la demande'})).toBeTruthy();
    expect(screen.queryByRole('textbox',{name:'Précisez l’objet'})).toBeNull();
    fireEvent.change(screen.getByRole('combobox',{name:'Objet de la demande'}),{target:{value:'other'}});
    fireEvent.change(screen.getByRole('textbox',{name:'Précisez l’objet'}),{target:{value:'Question spécifique'}});
    fireEvent.change(screen.getByRole('textbox',{name:'Votre message'}),{target:{value:'Bonjour'}});
    fireEvent.click(screen.getByRole('button',{name:'Envoyer'}));
    await waitFor(()=>expect(fixtures.request.mock.calls.some(([path,options])=>path==='/api/drivers/me/inbox/support'&&options?.method==='POST'&&JSON.parse(options.body).subject==='Question spécifique')).toBe(true));
  });
  it("présente toutes les sections du menu dans la même page", () => {
    fixtures.data["/api/users/me"] = {
      user: { name: "Tigran", email: "driver@example.com", rating: { average: 4.99 } },
    };
    fixtures.data["/api/drivers/me"] = {
      driver: { isApproved: true, vehicle: { make: "MG", model: "ZS", plate: "HJ415HF" } },
    };
    const Component = MenuRoute.options.component as any;
    render(<Component />);
    expect(screen.getByText("Tigran")).toBeTruthy();
    for (const title of ["Espace de conduite", "Assistance & Légal"])
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Se déconnecter/ })).toBeTruthy();
  });
});
