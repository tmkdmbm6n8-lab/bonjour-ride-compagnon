const ACTIVE = ["searching", "accepted", "arrived", "in_progress"];
function required(result) {
  if (result.error) throw new Error("Impossible de vérifier les courses en cours");
  return result.data || [];
}

export async function hasPassengerRide(db, uid) {
  return (
    required(await db.from("rides").select("id").eq("rider_id", uid).in("status", ACTIVE).limit(1))
      .length > 0
  );
}
export async function preparePassengerBooking(
  db,
  uid,
  canDrive,
  { allowActivePassenger = false } = {},
) {
  if (!allowActivePassenger && (await hasPassengerRide(db, uid)))
    throw new Error("Vous avez déjà une course passager en cours.");
  if (!canDrive) return;
  const driving = required(
    await db
      .from("rides")
      .select("id")
      .eq("driver_id", uid)
      .in("status", ["accepted", "arrived", "in_progress"])
      .limit(1),
  );
  if (driving.length)
    throw new Error("Terminez ou annulez votre course chauffeur avant de passer en mode passager.");
  const result = await db
    .from("drivers")
    .update({ is_online: false, location: null, updated_at: new Date().toISOString() })
    .eq("user_id", uid);
  if (result.error)
    throw new Error("Impossible de vous mettre hors ligne. Réessayez avant de réserver.");
}
export async function switchAccountMode(db, { uid, canDrive, mode }) {
  if (mode === "rider") {
    await preparePassengerBooking(db, uid, canDrive, { allowActivePassenger: true });
    return { mode };
  }
  if (mode !== "driver" || !canDrive) throw new Error("Accès chauffeur requis");
  if (await hasPassengerRide(db, uid))
    throw new Error("Terminez ou annulez votre course passager avant de reprendre la conduite.");
  return { mode }; // Returning to the cockpit never turns availability on automatically.
}
