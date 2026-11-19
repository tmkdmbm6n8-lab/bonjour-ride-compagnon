# Activation de StrasDrive Gold

StrasDrive Gold coûte 19,99 € TTC par mois, avec sept jours d’essai à la première souscription. Le code utilise un compte Stripe dédié à Gold par chauffeur et par environnement. Les chauffeurs prioritaires bénéficient de Gold via `drivers.is_priority`, même si Stripe ou la table Gold sont indisponibles. Le statut expire côté serveur à la date de fin enregistrée. Une résiliation programmée laisse l’accès ouvert jusqu’à la fin de la période. Les liens de clientèle sont conservés lorsque l’accès est suspendu. La suppression administrative d’un compte ferme son compte de facturation Gold dédié chez Stripe avant de supprimer le profil.

## 1. Appliquer le schéma dans Lovable Cloud

Faire appliquer ce SQL via une migration gérée par Lovable avant de configurer Stripe. La table est accessible au service role uniquement, avec un lien vers le chauffeur et une séparation entre test et production.

```sql
begin;

create table public.driver_gold_subscriptions (
  driver_id uuid not null references public.drivers(user_id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'live')),
  stripe_customer_id text not null,
  stripe_subscription_id text,
  gold_status text not null default 'inactive'
    check (gold_status in ('trialing', 'active', 'past_due', 'canceled', 'inactive')),
  gold_trial_ends_at timestamptz,
  gold_current_period_end timestamptz,
  trial_used boolean not null default false,
  can_manage boolean not null default false,
  cancel_at_period_end boolean not null default false,
  revision integer not null default 0,
  primary key (driver_id, environment),
  unique (environment, stripe_customer_id),
  unique (environment, stripe_subscription_id)
);

alter table public.driver_gold_subscriptions enable row level security;
revoke all on table public.driver_gold_subscriptions from public, anon, authenticated;
grant select, insert, update on table public.driver_gold_subscriptions to service_role;

commit;
```

## 2. Configurer Stripe

1. Créer le produit **StrasDrive Gold** avec un tarif récurrent **19,99 EUR** tous les mois, taxes incluses. Créer le tarif dans chaque environnement utilisé. Conserver le tarif de Gold séparé des paiements des courses.
2. Activer le portail client Stripe avec mise à jour du moyen de paiement et résiliation en fin de période. Laisser le changement de formule désactivé. L’essai peut démarrer sans carte. Stripe résilie l’essai à son échéance si aucun moyen de paiement n’a été ajouté. Une souscription ultérieure est payante dès la première échéance.
3. Dans Lovable, renseigner `GOLD_STRIPE_ENV` (`sandbox` ou `live`), `GOLD_STRIPE_PRICE_ID` (identifiant `price_…` du même environnement), et vérifier `APP_URL`, `LOVABLE_API_KEY`, `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY` et le secret webhook correspondant.
4. Ajouter les événements à la destination existante `/api/public/payments/webhook?env=sandbox` ou `?env=live` en conservant les événements Checkout des courses et du portefeuille. Ajouter `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded` et `invoice.payment_failed`. Garder `checkout.session.completed` et les événements asynchrones existants. Les sessions Gold suivent le traitement des abonnements et sont exclues du crédit portefeuille.

## 3. Vérifier en sandbox avant bascule

1. Ouvrir **Clients** avec un chauffeur ordinaire. Vérifier le statut inactif, l’absence de QR et la présence des liens existants grisés. Confirmer que son favori disparaît du comparateur passager.
2. Démarrer l’essai, avec puis sans moyen de paiement sur des comptes de test distincts. Vérifier l’activation dès réception du webhook, la génération et la lecture du QR, et l’offre privée de 30 s.
3. Simuler un renouvellement refusé, la fin de l’essai sans carte et une résiliation. Vérifier que le QR déjà affiché est refusé au scan, que le comparateur revient aux gammes normales et qu’une offre privée en attente n’est plus réservée. Effectuer un paiement réussi et vérifier que les liens restaurent l’accès.
4. Renvoyer les événements dans le désordre et en double. Le serveur relit l’état Stripe et applique le résultat avec un contrôle de version atomique. Vérifier qu’une seconde souscription du même compte n’obtient pas d’essai.
5. Activer puis retirer le statut prioritaire via l’admin. Vérifier le QR, le comparateur et le dispatch sur un chauffeur prioritaire sans abonnement Stripe. Refaire un paiement course et une recharge de portefeuille pour vérifier les traitements existants.
6. Reprendre la configuration en `live` seulement après validation en sandbox. Les souscriptions sandbox ne donnent aucun droit dans l’environnement live.
