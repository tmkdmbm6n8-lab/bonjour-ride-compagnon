import { hasPaidDriverGold, loadDriverGold } from "./driver-gold.server";
import { waiveGoldCommission } from "./driver-gold-fare";
import { favoriteDriverId } from "./private-clients.server";

/** Share the commission decision between the offer and the accepted fare. */
export async function fareForDriver(db, ride, driverId) {
  if (ride.is_test) return ride.fare;

  const ownPrivateClient = (await favoriteDriverId(db, ride.rider_id)) === driverId;
  // The priority entitlement includes the private-client benefit even
  // when the driver has no paid Stripe subscription.
  if (ownPrivateClient && (await loadDriverGold(db, driverId)).included) {
    return waiveGoldCommission(ride.fare, true);
  }

  if (await hasPaidDriverGold(db, driverId)) {
    return waiveGoldCommission(ride.fare, ownPrivateClient);
  }
  return ride.fare;
}
