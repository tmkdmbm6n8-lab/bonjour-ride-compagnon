import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRideDraft, readRideDraft, saveRideDraft } from '@/lib/ride-draft';

const draft = {
  pickup: { address: 'Gare', lat: 48.58, lng: 7.73 },
  dropoff: { address: 'Centre', lat: 48.583, lng: 7.746 },
  pickupText: 'Gare', dropoffText: 'Centre',
};
afterEach(() => { vi.restoreAllMocks(); clearRideDraft(); });

describe('trajet conservé avant connexion', () => {
  it('transmet les adresses et les coordonnées uniquement en mémoire', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    saveRideDraft(draft);
    expect(readRideDraft()).toEqual(draft);
    expect(local).not.toHaveBeenCalled();
  });
  it('garde le texte partiel sans réutiliser les anciennes coordonnées', () => {
    saveRideDraft({ ...draft, pickupText: 'Nouvelle adresse' });
    expect(readRideDraft()).toEqual({ ...draft, pickup: null, pickupText: 'Nouvelle adresse' });
  });
  it('efface le trajet après sa transmission', () => {
    saveRideDraft(draft);
    clearRideDraft();
    expect(readRideDraft()).toBeNull();
  });
  it('ne restaure rien après un rechargement de la page', async () => {
    saveRideDraft(draft);
    vi.resetModules();
    const freshPage = await import('@/lib/ride-draft');
    expect(freshPage.readRideDraft()).toBeNull();
  });
});
