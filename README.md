# StrasDrive

Application de réservation VTC : espace passager, espace chauffeur et administration.

Technologies : React, TanStack Start, TypeScript, Supabase et Capacitor.

## Tarification

Les devis et les réservations utilisent le même barème distance/durée, défini dans `src/lib/vtc-pricing.js` et modifiable depuis l’administration.
Le prix est le maximum entre le minimum de la gamme et le total base + kilomètres + minutes, puis le supplément de la gamme est ajouté.
Le prix accepté est conservé pour le paiement et la fin de course.

## Développement

- `npm install`
- `npm run dev`
- `npm test`
- `npm run build`
- `npm run check:pricing`
