import {DatabaseSync} from 'node:sqlite';
import {schema,managedImageSchema,userSchema,memberSchema} from '../schema.mjs';
export class TestD1 {
 constructor(){this.db=new DatabaseSync(':memory:');this.db.exec('PRAGMA foreign_keys=ON;'+schema+managedImageSchema+userSchema+memberSchema);this.db.exec('UPDATE cf_state SET ready=1');}
 prepare(sql){return {sql,params:[],bind(...params){return {...this,params};}};}
 async batch(statements){this.db.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>{const q=this.db.prepare(s.sql),params=s.params.map(p=>Array.isArray(p)?Buffer.from(p):p);const rows=q.all(...params);return {success:true,results:rows,meta:{changes:this.db.prepare('SELECT changes() n').get().n}};});this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 close(){this.db.close();}
}
export class TestMedia {
 constructor(){this.data=new Map();this.failDelete=false;}
 async put(key,bytes,options={}){if(options.onlyIf&&this.data.has(key))return null;const copy=new Uint8Array(bytes);this.data.set(key,copy);return {key,size:copy.length};}
 async get(key){const bytes=this.data.get(key);return bytes?{key,size:bytes.length,arrayBuffer:async()=>bytes.slice().buffer}:null;}
 async delete(key){if(this.failDelete)throw Error('Fixture outage');this.data.delete(key);}
 async list({prefix='',cursor,limit=500}={}){const keys=[...this.data.keys()].filter(k=>k.startsWith(prefix)).sort(),start=Number(cursor||0),slice=keys.slice(start,start+limit);return {objects:slice.map(key=>({key,size:this.data.get(key).length})),truncated:start+limit<keys.length,cursor:String(start+limit)};}
}
