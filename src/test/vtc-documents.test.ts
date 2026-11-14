import { describe, expect, it } from 'vitest';
import { REQUIRED_DOCUMENTS, validateDocumentInput, driverCompliance, documentState } from '@/lib/vtc-documents';

const TODAY = '2026-11-14';
const approvedAll = () => REQUIRED_DOCUMENTS.map((d) => ({ doc_type: d.type, status: 'approved', valid_until: d.dateKind ? '2027-06-01' : null }));

describe('documents obligatoires VTC', () => {
  it('exige les 10 documents obligatoires (contrôle technique facultatif)', () => {
    expect(REQUIRED_DOCUMENTS.map((d) => d.type)).toEqual(['identity', 'driving_license', 'vtc_card', 'company', 'vtc_register', 'vehicle_registration', 'vehicle_insurance', 'rc_pro', 'vtc_sticker', 'urssaf']);
  });

  it('refuse une carte VTC déjà expirée', () => {
    expect(() => validateDocumentInput('vtc_card', { date: '2026-11-13', number: 'VTC123' }, TODAY)).toThrow(/expiré/);
  });

  it('refuse un Kbis de plus de 3 mois et accepte un Kbis récent', () => {
    expect(() => validateDocumentInput('company', { date: '2026-08-01', number: '12345678901234' }, TODAY)).toThrow(/trop ancien/);
    expect(validateDocumentInput('company', { date: '2026-10-01', number: '123 456 789 01234' }, TODAY)).toMatchObject({ valid_until: '2026-12-30', document_number: '12345678901234' });
  });

  it('exige un SIRET à 14 chiffres', () => {
    expect(() => validateDocumentInput('company', { date: '2026-10-01', number: '1234' }, TODAY)).toThrow(/SIRET/);
  });

  it('attestation URSSAF valable 6 mois après délivrance', () => {
    expect(validateDocumentInput('urssaf', { date: '2026-11-01' }, TODAY).valid_until).toBe('2027-05-02');
    expect(() => validateDocumentInput('urssaf', { date: '2026-04-01' }, TODAY)).toThrow(/trop ancien/);
  });

  it('un chauffeur ne peut être validé que si tous les documents obligatoires sont vérifiés', () => {
    expect(driverCompliance(approvedAll(), TODAY).canBeApproved).toBe(true);
    const docs = approvedAll(); docs[0]!.status = 'pending';
    expect(driverCompliance(docs, TODAY).canBeApproved).toBe(false);
    expect(driverCompliance(approvedAll().slice(1), TODAY).canBeApproved).toBe(false);
  });

  it('un document renouvelé en vérification ne bloque pas la conduite, un document expiré ou refusé oui', () => {
    const pending = approvedAll(); pending[6]!.status = 'pending';
    expect(driverCompliance(pending, TODAY).canDrive).toBe(true);
    const expired = approvedAll(); expired[6]!.valid_until = '2026-11-13';
    expect(driverCompliance(expired, TODAY).canDrive).toBe(false);
    const rejected = approvedAll(); rejected[2]!.status = 'rejected';
    expect(driverCompliance(rejected, TODAY).canDrive).toBe(false);
  });

  it('signale un document qui expire dans moins de 30 jours', () => {
    expect(documentState({ status: 'approved', valid_until: '2026-12-01' }, TODAY)).toBe('expiring');
    expect(documentState({ status: 'approved', valid_until: '2027-01-30' }, TODAY)).toBe('approved');
  });
});
