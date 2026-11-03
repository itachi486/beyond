import{validVisualPlan}from'./companion-plan.mjs';
const point=p=>p&&Object.keys(p).sort().join(',')==='x,y'&&['x','y'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])&&p[k]>=0&&p[k]<=1);
export function validateAdjustments(v,source,{execute=false}={}){
 if(!v||Object.keys(v).sort().join(',')!=='position,scale'||typeof v.scale!=='number'||!Number.isFinite(v.scale)||v.scale<.5||v.scale>1.5||!point(v.position))return 'invalid_candidate_adjustments';
 if(source.actionType==='EDIT_EXISTING_WORLD_OBJECT'&&Math.hypot(v.position.x-source.position.x,v.position.y-source.position.y)>1e-8)return 'candidate_target_position_locked';
 if(execute){const rx=source.width*.09*v.scale,ry=source.height*.13*v.scale,cx=v.position.x*source.width,cy=v.position.y*source.height,ox=Math.max(0,Math.min(source.width-512,Math.round(cx-256))),oy=Math.max(0,Math.min(source.height-512,Math.round(cy-256)));if(!Number.isSafeInteger(source.width)||!Number.isSafeInteger(source.height)||rx>250||ry>250||cx-rx<0||cy-ry<0||cx+rx>source.width||cy+ry>source.height||cx-rx<ox||cy-ry<oy||cx+rx>ox+512||cy+ry>oy+512)return 'candidate_region_out_of_bounds';}
 return null;
}
export function validateRefinement(input,source){
 if(!source||source.approved||source.rejected)return 'candidate_not_editable';
 if(!validVisualPlan(source.visualPlan)||!source.originalHash||!source.imageHash||!['CREATE_WORLD_OBJECT','EDIT_EXISTING_WORLD_OBJECT'].includes(source.actionType))return 'candidate_workspace_update_required';
 if(input.worldId!==source.worldId||input.message!==source.message||input.sourceHash!==source.originalHash||input.parentId!==source.parentId||input.actionType!==source.actionType||input.objectKind!==source.objectKind||(input.targetId||null)!==(source.targetId||null))return 'candidate_source_conflict';
 const error=validateAdjustments(input.refinement,source,{execute:true});if(error)return error;
 if(!point(input.position)||Math.hypot(input.position.x-input.refinement.position.x,input.position.y-input.refinement.position.y)>1e-8)return 'invalid_candidate_adjustments';
 return null;
}
export function refinementPrompt(source,adjustments){
 const ratio=adjustments.scale/(source.previewScale||1);
 return `Use image 0 as the ORIGINAL target landscape and image 1 only as a reference for the previously generated subject: ${source.visualPlan.subject}. Recreate that SAME subject, keeping its identity, materials, clothing and recognizable details. Set its apparent width and height to about ${Math.round(ratio*100)} percent of the subject in image 1. Requested absolute preview scale: ${Math.round(adjustments.scale*100)} percent. Place it at the selected target point in image 0. Do not copy image 1's background or duplicate the old subject. The original target landscape supplies the terrain and background. Where a smaller approved target exposes background, restore matching terrain and shadows; remove its old larger outline. Match image 0's camera perspective, horizon, scale, local light direction, color temperature, contrast, atmospheric depth and painted texture. Ground physical subjects with coherent contact shadows; preserve airborne subjects if requested. Do not add an unrelated building, pedestal or new biome. Preserve nearby buildings, paths, people and vegetation. Fit the complete subject/group inside the writable ellipse around the target point, whose radii are ${Math.round(source.width*.09*adjustments.scale)} by ${Math.round(source.height*.13*adjustments.scale)} pixels in the 512px output. Leave a 20 percent inner margin. No pasted sticker edges, halos, text or logo.`;
}
