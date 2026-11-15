const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

/** Shown only in test mode (or when production card payments are not configured yet). */
export default function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="pay-banner pay-banner-danger">
        Le paiement par carte n’est pas encore configuré en production. Terminez l’activation Stripe pour accepter de vrais paiements.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="pay-banner">
        Paiements par carte en mode test : aucun argent réel n’est débité.{" "}
        <a href="https://docs.lovable.dev/features/payments#test-and-live-environments" target="_blank" rel="noopener noreferrer">
          En savoir plus
        </a>
      </div>
    );
  }
  return null;
}
