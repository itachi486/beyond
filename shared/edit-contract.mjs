export const EDIT_CONTRACT_VERSION=1;
export const CREATE_WORLD_OBJECT='CREATE_WORLD_OBJECT';
export const EDIT_EXISTING_WORLD_OBJECT='EDIT_EXISTING_WORLD_OBJECT';
export const OBJECT_KINDS=Object.freeze(['house','villa','bridge','farm','garden','waterfall','object']);
const id=v=>typeof v==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(v);
/** Pure admission checks shared by both clients and the server. No legacy inference. */
export function validateEditContract(input){
 if(!input||input.contractVersion!==EDIT_CONTRACT_VERSION)return 'edit_contract_update_required';
 // Numeric native heads require B10; do not silently accept an unimplemented guard.
 if('expectedImageHeadRevision' in Object(input))return 'edit_contract_update_required';
 if(![CREATE_WORLD_OBJECT,EDIT_EXISTING_WORLD_OBJECT].includes(input.actionType))return 'invalid_action_type';
 if(!id(input.operationId)||input.operationId.length<16)return 'invalid_operation_id';
 if(input.requestId!==undefined&&input.requestId!==input.operationId)return 'operation_id_mismatch';
 if(!id(input.worldId))return 'invalid_world_id';
 if(!OBJECT_KINDS.includes(input.objectKind))return 'invalid_object_kind';
 if(!input.position||!['x','y'].every(k=>typeof input.position[k]==='number'&&Number.isFinite(input.position[k])&&input.position[k]>=0&&input.position[k]<=1))return 'invalid_position';
 if(input.actionType===CREATE_WORLD_OBJECT?input.targetId!==null:!id(input.targetId))return 'invalid_target_id';
 if(input.parentId!==null&&!id(input.parentId))return 'invalid_image_head';
 if(typeof input.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(input.sourceHash))return 'invalid_source_hash';
 if(input.expectedWorldRevision!==null&&(!Number.isSafeInteger(input.expectedWorldRevision)||input.expectedWorldRevision<0))return 'invalid_world_revision';
 return null;
}
