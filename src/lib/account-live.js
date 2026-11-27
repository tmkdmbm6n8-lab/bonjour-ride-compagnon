const DRIVER_FIELDS = ['is_approved', 'is_online', 'is_priority', 'vehicle_class', 'accepts_classes', 'vehicle', 'trip_prefs', 'documents_override'];
/** @param {string} table @param {{ eventType?: string, old?: Record<string, any>, new?: Record<string, any> }} [payload] */
export function accountRealtimeChanged(table, { eventType, old: previous = {}, new: next = {} } = {}) {
  if (table !== 'drivers' || eventType !== 'UPDATE') return true;
  return DRIVER_FIELDS.some(field => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}
