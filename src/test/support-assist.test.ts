import {describe,expect,it} from 'vitest';
import {redactPersonal,buildAssistInput,normalizeAssist,assistErrorMessage,ASSIST_SCHEMA} from '../lib/support-assist.js';
describe('aide IA assistance',()=>{
  it('masque e-mail, téléphone et IBAN avant l’envoi au modèle',()=>{
    const out=redactPersonal('Écrivez à jean.dupont@mail.fr ou au 06 12 34 56 78 / +33 6 12 34 56 78, IBAN FR76 3000 6000 0112 3456 7890 189');
    expect(out).not.toMatch(/jean\.dupont|12 34 56 78|FR76/);
    expect(out).toContain('[e-mail masqué]');expect(out).toContain('[téléphone masqué]');expect(out).toContain('[IBAN masqué]');
  });
  it('n’envoie ni le nom ni l’e-mail du demandeur, et garde au plus 12 messages',()=>{
    const msgs=Array.from({length:20},(_,i)=>({from:i%2?'admin':'driver',text:`message ${i}`}));
    const input=buildAssistInput({topic:'payments',name:'Jean Dupont',email:'j@d.fr'},{subject:'Retrait',messages:msgs});
    expect(input).not.toContain('Jean Dupont');expect(input).not.toContain('j@d.fr');
    expect(input).not.toContain('message 7\n');expect(input).toContain('message 8');expect(input).toContain('message 19');
  });
  it('ramène une réponse hors règles à des valeurs autorisées',()=>{
    expect(normalizeAssist({category:'remboursement',urgency:'extrême',summary:' ok ',suggestedReply:'Bonjour',toCheck:['a','b','c','d','e']}))
      .toEqual({category:'general',urgency:'normale',summary:'ok',suggestedReply:'Bonjour',toCheck:['a','b','c','d']});
  });
  it('schéma strict : tous les champs requis, aucun champ libre',()=>{
    expect(ASSIST_SCHEMA.additionalProperties).toBe(false);
    expect([...ASSIST_SCHEMA.required].sort()).toEqual(Object.keys(ASSIST_SCHEMA.properties).sort());
  });
  it('explique les crédits épuisés et les limites sans relancer seul',()=>{
    expect(assistErrorMessage(402)).toMatch(/Crédits IA épuisés/);
    expect(assistErrorMessage(429)).toMatch(/Réessayez dans une minute/);
  });
});
