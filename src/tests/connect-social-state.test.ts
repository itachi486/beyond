import{describe,it,expect}from'vitest';import{mergeSocialMessages,type SocialMessage}from'../features/connect/socialState';
const row=(id:string,seq:number,revision=1,groupId='global:floating-islands')=>({id,serverSeq:seq,revision,groupId,body:'Unicode 🌌',mine:false}as SocialMessage);
describe('CONNECT server revision merge',()=>{
 it('orders by server sequence and ignores duplicate or older responses',()=>{const newest=row('a',1,3);expect(mergeSocialMessages([newest],[row('b',2),row('a',1,1),row('b',2)],newest.groupId)).toEqual([newest,row('b',2)]);});
 it('rejects a different group and invalid sequence/revision',()=>{expect(mergeSocialMessages([],[row('a',1,1,'global:deep-ocean'),row('b',NaN),row('c',2,Infinity)],'global:floating-islands')).toEqual([]);});
 it('retains a deletion revision and bounds the live view without changing stored history',()=>{const deleted={...row('a',1,2),deletedAt:new Date().toISOString(),body:''};expect(mergeSocialMessages([deleted],[row('a',1,1)],deleted.groupId)[0]).toEqual(deleted);expect(mergeSocialMessages([],Array.from({length:205},(_,i)=>row(String(i),i)),deleted.groupId)).toHaveLength(200);});
});
