import {AsyncLocalStorage} from 'node:async_hooks';
export const requestContext=new AsyncLocalStorage();
export const runtime=()=>{const ctx=requestContext.getStore();if(!ctx)throw Error('Request context unavailable');return ctx;};
