/** Display mode never grants a role. Driver capability comes from verified server roles. */
export function accountView(pathname = "") {
  if (/^\/driver(?:\/|$)/.test(pathname)) return "driver";
  if (/^\/admin(?:\/|$)/.test(pathname)) return "admin";
  return "rider";
}
export function rideOwnerColumn(role, requestedView, canDrive = role === "driver") {
  const view = requestedView || (role === "driver" ? "driver" : "rider");
  if (!["driver", "rider"].includes(view)) throw new Error("Mode de course invalide");
  if (view === "driver" && !canDrive) throw new Error("Accès chauffeur requis");
  return view === "driver" ? "driver_id" : "rider_id";
}
