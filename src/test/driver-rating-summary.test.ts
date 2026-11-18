import { describe, expect, it } from 'vitest';
import { driverRatingSummary } from '../lib/driver-rating-summary';
const rows = [
  {id:'ride-a',rider_id:'secret',pickup:{address:'private'},rating:{byRider:5,riderComment:'Très bien'}},
  {rating:{byRider:4,riderComment:'Agréable'}},
  {rating:{byRider:2,riderComment:'Conduite brusque'}},
  {rating:{byRider:null}},
  {rating:{byRider:6}},
];
describe('avis chauffeur anonymisés', () => {
  const ratings = (count) => Array.from({length:count},()=>({rating:{byRider:5,riderComment:'Bien'}}));
  it.each([0,23,49])('masque les détails côté serveur à %s avis', (count) => {
    expect(driverRatingSummary(ratings(count),false)).toEqual({count,threshold:50,locked:true,priority:false});
  });
  it.each([50,51])('débloque les détails à %s avis', (count) => {
    const result=driverRatingSummary(ratings(count),false);
    expect(result.locked).toBe(false);
    expect(result.comments).toHaveLength(count);
  });
  it('exempte les prioritaires, même sans aucun avis', () => {
    expect(driverRatingSummary([],true).locked).toBe(false);
    expect(driverRatingSummary(ratings(1),true).comments).toHaveLength(1);
  });
  it('calcule les vrais compteurs, y compris les notes négatives', () => {
    const result=driverRatingSummary(rows,true);
    expect(result.count).toBe(3);
    expect(result.average).toBeCloseTo(11/3);
    expect(result.distribution).toEqual([{stars:5,count:1},{stars:4,count:1},{stars:3,count:0},{stars:2,count:1},{stars:1,count:0}]);
  });
  it('ne transmet que les avis positifs au chauffeur normal', () => {
    const result=driverRatingSummary([...rows, ...Array.from({length:47},()=>({rating:{byRider:5}}))],false);
    expect(result.comments).toEqual([{stars:5,text:'Très bien'},{stars:4,text:'Agréable'}]);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('ride-a');
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('permet les avis négatifs aux prioritaires sans identité ni contact', () => {
    const result=driverRatingSummary(rows,true);
    expect(result.comments).toHaveLength(3);
    expect(result.comments[2]).toEqual({stars:2,text:'Conduite brusque'});
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('masque les coordonnées écrites dans un avis et gère zéro note', () => {
    const result=driverRatingSummary([{rating:{byRider:5,riderComment:'Mon mail perso@example.fr, tél 06 12 34 56 78'}}],true);
    expect(result.comments[0].text).not.toContain('perso@example.fr');
    expect(result.comments[0].text).not.toContain('06 12');
    expect(driverRatingSummary([],true).average).toBeNull();
  });
});
