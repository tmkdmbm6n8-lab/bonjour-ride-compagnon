/** Preserve given names; disclose only the initial of the final family-name token. */
export function passengerDisplayName(value) {
  const parts = typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean) : [];
  if (!parts.length) return 'Passager';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(' ')} ${Array.from(parts.at(-1))[0].toLocaleUpperCase('fr-FR')}.`;
}
