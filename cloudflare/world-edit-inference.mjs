import{runAI}from'./workers-ai.mjs';
// An uncertain provider attempt may have consumed compute. Never automatically
// submit it again; the existing root reservation and request ID stay authoritative.
export async function worldInference({env,stage,model,step,input}){return step(stage,()=>runAI(env,model,input()));}
