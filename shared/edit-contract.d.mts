export const EDIT_CONTRACT_VERSION:1;
export const CREATE_WORLD_OBJECT:'CREATE_WORLD_OBJECT';
export const EDIT_EXISTING_WORLD_OBJECT:'EDIT_EXISTING_WORLD_OBJECT';
export const OBJECT_KINDS:readonly string[];
export type EditContract={contractVersion:1;operationId:string;requestId?:string;worldId:string;actionType:typeof CREATE_WORLD_OBJECT|typeof EDIT_EXISTING_WORLD_OBJECT;objectKind:string;position:{x:number;y:number};targetId:string|null;parentId:string|null;sourceHash:string;expectedWorldRevision:number|null};
export function validateEditContract(input:unknown):string|null;
