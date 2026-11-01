import {createHash} from 'node:crypto';
/** Explicit fixture input only; production never supplies defaults for legacy writes. */
export function editContract(input,bytes,expectedWorldRevision=null){
 return {contractVersion:1,operationId:input.requestId,actionType:'CREATE_WORLD_OBJECT',objectKind:'house',targetId:null,parentId:null,sourceHash:createHash('sha256').update(bytes).digest('hex'),expectedWorldRevision,...input};
}
