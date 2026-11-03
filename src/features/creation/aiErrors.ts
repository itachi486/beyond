/** Shared AI-only messages. Reservations and provider usage must not be confused. */
export const aiErrors:Record<string,string>={
 reply_language_mismatch:'The reply did not match your language. No automatic AI retry was made; your world is unchanged.',
 invalid_semantic_plan:'The requested subject could not be described reliably. Please clarify it; no image was generated.',
 semantic_plan_required:'This saved request needs a current description. Send the desired change again; no image was generated.',
 semantic_plan_mismatch:'The image request does not match its saved description. Reopen this world; no image was generated.',
 edit_target_position_conflict:'The requested position differs from the saved object. Reload the target; no object was replaced.',
 world_version_conflict:'A newer approved world version exists. Reload saved edits before requesting a candidate.',
 read_service_unavailable:'Saved data is temporarily unavailable. Retry; no data was deleted.',
 world_save_failed:'The world save could not be confirmed. The original and previous approval are preserved.',
 image_storage_unavailable:'The edited image could not be stored. No world change was approved.',
 waiting_stopped:'Stopped waiting locally. Provider inference may still finish; check saved previews before retrying.',
 edit_target_not_found:'The saved edit target could not be verified. No new house was created.',

 cloudflare_free_allocation_exhausted:'Cloudflare’s free daily AI allocation is exhausted. Try after 00:00 UTC. Your world and history are preserved.',
 text_budget_exhausted:'BEYOND’s shared conversation safety budget is temporarily exhausted. This is an estimate, not confirmed Cloudflare usage.',
 service_budget_exhausted:'BEYOND’s shared daily AI safety budget is exhausted. Pending operations remain reserved; existing worlds are preserved.',
 image_budget_exhausted:'The shared image safety budget is exhausted. Conversation remains available.',
 image_attempt_limit_reached:'Too many image generation attempts today. Conversation remains available.',
 image_daily_limit_reached:'Your daily image generation limit has been reached. Conversation remains available.',
 provider_rate_limited:'The AI provider is temporarily busy or rate limiting requests. Please try later.',
 provider_quota_unconfirmed:'The provider reported a quota error, but the remaining free allocation could not be verified.',
 image_edit_temporary_failure:'Image editing temporarily failed. Your current world is unchanged.',
 service_unavailable:'The AI service is temporarily unavailable. This is not a confirmed usage-limit error.',
 edit_area_protected:'This place is occupied by a protected object. Select a different position for a new object.',
 image_edit_no_change:'The model produced no visible change. No candidate was saved and your world is unchanged.',
 decision_outcome_unknown:'Approval status could not be confirmed. Check saved previews before retrying. Do not generate another image.',
 decision_state_unavailable:'Saved approval status is temporarily unavailable. Your preview has not been discarded.',
 approval_not_saved:'The saved preview is still unapproved. Approval was not saved; retry approval without generating another image.',
 rejection_not_saved:'This preview was not rejected. Review it and retry the same action; no new image is needed.',
 native_writer_required:'Approval is paused because the storage mode changed. Reopen saved previews before continuing.',
 workers_resource_limit:'The Worker exceeded its resource limit. Your approved world is preserved. No automatic model retry was made.',
 workers_cpu_limit:'The Worker exceeded its CPU limit. Your world is preserved; this is not an AI allocation error.',
 network_error:'The network connection failed. Reopen saved versions before retrying; the request may have completed.',
 request_timeout:'The request timed out. Reopen saved versions before retrying; the request may have completed.',
 // Old saved errors remain readable without asserting an unverified cause.
 daily_limit_reached:'A legacy AI limit was reported. Its exact cause is unavailable; your world is preserved.',
 provider_server_error:'The AI service is temporarily unavailable. Please try later.',
 generation_timeout:'The AI request timed out. Check saved versions before retrying.'
};
export async function readAIResponse(response:Response){
 if(!response.headers.get('content-type')?.includes('application/json')){
  const body=await response.text();if(/CPU.*(?:limit|exceeded)|exceeded.*CPU/i.test(body))throw Error('workers_cpu_limit');if(/Worker exceeded resource limits|error-code[^>]*>1102/i.test(body))throw Error('workers_resource_limit');
  throw Error(response.status===504?'request_timeout':'service_unavailable');
 }
 let data;try{data=await response.json();}catch{throw Error('service_unavailable');}
 if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'service_unavailable');return data;
}
