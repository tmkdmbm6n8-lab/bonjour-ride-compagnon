import { useEffect, useState } from "react";
import { useSession } from "@/lib/archive-auth";
import { apiFetch } from "@/lib/archive-fetch";
import AccountModeSwitch from "./AccountModeSwitch";

/** Outside the desktop-only account popover so drivers can return on mobile too. */
export default function DriverReturnBar() {
  const { data: session } = useSession();
  const user = session?.user;
  const [verified, setVerified] = useState(null);
  useEffect(() => {
    let stopped = false;
    if (!user?.id) return;
    apiFetch("/api/users/me")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!stopped)
          setVerified({
            userId: user.id,
            canDrive: data.user?.canDrive === true || data.user?.role === "driver",
          });
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [user?.id]);
  const canReturn =
    verified && verified.userId === user?.id
      ? verified.canDrive
      : user?.canDrive === true || user?.role === "driver";
  if (!canReturn) return null;
  return (
    <div className="driver-return-bar" aria-label="Retour à votre espace chauffeur">
      <AccountModeSwitch mode="driver" className="btn btn-secondary btn-sm" />
    </div>
  );
}
