import initSQL from 'sql.js/dist/sql-wasm-browser.js';
import wasm from 'sql.js/dist/sql-wasm-browser.wasm';
let ready;
export function sqlRuntime(){return ready ||= initSQL({instantiateWasm(imports,done){const instance=new WebAssembly.Instance(wasm,imports);done(instance);return instance.exports;}});}
