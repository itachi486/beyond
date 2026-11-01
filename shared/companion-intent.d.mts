export type ActionIntent='GENERAL_CHAT'|'CREATE_WORLD_OBJECT'|'EDIT_EXISTING_WORLD_OBJECT'|'INSPECT_WORLD'|'CONFIRM_ACTION'|'CANCEL_ACTION'|'CHECK_USAGE'|'REPORT_ERROR'|'EXPLORE_WORLD'|'NEEDS_CLARIFICATION';
export function companionActionIntent(message:string,context?:{pending?:unknown;lastEdit?:boolean}):ActionIntent;
export function companionIntent(message:string,context?:{pending?:unknown;lastEdit?:boolean}):'chat'|'edit'|'clarify'|'explore'|'cancel'|'usage'|'error'|'inspect';
