export const GOLD_MONTHLY_CENTS = 1999;
export const GOLD_TRIAL_DAYS = 7;

export function goldEntitlement(driver, billing, now = Date.now()) {
  if (driver?.is_priority === true) {
    return { active: true, included: true, status: "active", endsAt: null, trialAvailable: false, canManage: billing?.can_manage === true };
  }

  const status = billing?.gold_status || "inactive";
  const endsAt = status === "trialing" ? billing?.gold_trial_ends_at : billing?.gold_current_period_end;
  const active = (status === "trialing" || status === "active") && Date.parse(endsAt) > now;
  return {
    active,
    included: false,
    status,
    endsAt: active ? endsAt : null,
    trialAvailable: !billing?.trial_used,
    canManage: billing?.can_manage === true,
    cancelAtPeriodEnd: billing?.cancel_at_period_end === true,
  };
}
