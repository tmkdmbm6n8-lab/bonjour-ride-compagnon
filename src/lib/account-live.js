const DRIVER_FIELDS = ['is_approved', 'is_online', 'is_priority', 'vehicle_class', 'accepts_classes', 'vehicle', 'trip_prefs', 'documents_override'];
export function accountRealtimeChanged(table, { eventType, old: previous = {}, new: next = {} } = {}) {
  if (table !== 'drivers' || eventType !== 'UPDATE') return true;
  return DRIVER_FIELDS.some(field => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}
