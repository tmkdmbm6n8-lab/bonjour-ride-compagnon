import { describe, expect, it } from 'vitest';
import { CHAT_RETENTION_MS, chatRetention, visibleChatMessages, newChatMessage, rejectUnsafeChatText, decodeChatAttachment } from '@/lib/ride-chat';
import { assertRideActionMethod } from '@/lib/vtc-access';
describe('contenus de discussion', () => {
 it('cache les marqueurs de conservation aux participants', () => {
  const marker = { type: 'retention', expiresAt: 'later' }, text = { type: 'text', text: 'Bonjour' };
  expect(visibleChatMessages([marker, text])).toEqual([text]); expect(chatRetention([marker, text])).toEqual(marker);
  expect(CHAT_RETENTION_MS).toBe(14 * 86400000);
 });
 it('valide une position ponctuelle et ignore les champs du demandeur', () => {
  expect(newChatMessage({ type:'location',lat:48.5,lng:7.7,from:'admin' },'rider')).toMatchObject({from:'rider',type:'location',lat:48.5,lng:7.7});
  expect(()=>newChatMessage({type:'location',lat:91,lng:0},'rider')).toThrow();
  expect(()=>newChatMessage({type:'location',lat:'48',lng:7},'rider')).toThrow();
 });
 it('bloque les menaces explicites sans bloquer les messages courants', () => {
  expect(() => rejectUnsafeChatText('Je vais te tuer')).toThrow(/menace explicite/);
  expect(() => newChatMessage({ text: 'Je te frappe' }, 'rider')).toThrow(/menace explicite/);
  expect(() => rejectUnsafeChatText('I will kill you')).toThrow(/menace explicite/);
  expect(() => newChatMessage({ text: 'Bonjour, je suis devant la gare' }, 'driver')).not.toThrow();
 });
 it('valide les fichiers et limite les vocaux à une minute', () => {
  const webm = Buffer.from('1a45dfa3000000000000','hex').toString('base64');
  expect(decodeChatAttachment({mime:'audio/webm;codecs=opus',data:webm,duration:60})).toMatchObject({type:'audio',mime:'audio/webm'});
  expect(()=>decodeChatAttachment({mime:'audio/webm',data:webm,duration:61})).toThrow();
  expect(()=>decodeChatAttachment({mime:'image/jpeg',data:Buffer.from('<script>').toString('base64')})).toThrow();
  expect(()=>decodeChatAttachment({mime:'image/svg+xml',data:webm})).toThrow();
 });
 it('protège les méthodes des routes de pièces jointes',()=>{
  expect(()=>assertRideActionMethod('attachment','GET')).toThrow();
  expect(()=>assertRideActionMethod('media','POST')).toThrow();
  expect(()=>assertRideActionMethod('block','GET')).toThrow();
  expect(()=>assertRideActionMethod('unblock','GET')).toThrow();
  expect(()=>assertRideActionMethod('report-message','GET')).toThrow();
  expect(()=>assertRideActionMethod('report-message','POST')).not.toThrow();
 });
});
