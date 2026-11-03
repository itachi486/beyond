type Request=(path:string,body?:unknown)=>Promise<any>;
const ambiguous=new Set(['workers_resource_limit','workers_cpu_limit','request_timeout','network_error','service_unavailable','world_save_failed','decision_outcome_unknown','decision_state_unavailable','decision_invalid_response']);
/** Never resend a write automatically: resolve an ambiguous response using saved state. */
export async function confirmWorldEditDecision(request:Request,base:string,id:string,worldId:string,approve:boolean){
 try{const result=await request(`${base}/${id}/${approve?'approve':'reject'}`,{confirm:true});if(result?.item?.requestId!==id||result.item.worldId!==worldId||!(approve?result.item.approved:result.item.rejected))throw Error('decision_invalid_response');return result;}
 catch(error){
  const code=error instanceof Error?error.message:'';
  if(!(error instanceof TypeError)&&!(error instanceof DOMException&&['AbortError','TimeoutError'].includes(error.name))&&!ambiguous.has(code))throw error;
  let saved;try{saved=await request(`${base}/${id}/status?worldId=${encodeURIComponent(worldId)}`);}catch(e){if(e instanceof Error&&['account_context_stale','sign_in_required'].includes(e.message))throw e;throw Error('decision_outcome_unknown');}
  if(saved?.state!=='success'||saved.item?.requestId!==id||saved.item.worldId!==worldId)throw Error('decision_outcome_unknown');
  if(!(approve?saved.item.approved:saved.item.rejected))throw Error(approve&&saved.item.rejected?'candidate_rejected':approve?'approval_not_saved':'rejection_not_saved');
  if(approve){let active=saved.activeRequestId;if(active===undefined){let list;try{list=await request(`${base}?worldId=${encodeURIComponent(worldId)}`);}catch{throw Error('decision_outcome_unknown');}active=list.items?.find((v:any)=>v.approved&&!v.rejected)?.requestId;}if(active!==id)throw Error('world_version_conflict');}
  return{...saved,recovered:true};
 }
}
