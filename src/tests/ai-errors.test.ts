import{it,expect}from'vitest';import{aiErrors,readAIResponse}from'../features/creation/aiErrors';
it('AI errors preserve image/free/provider distinctions and never call an HTML503 a quota failure',async()=>{
 await expect(readAIResponse(new Response('<!DOCTYPE html><title>Service unavailable</title>',{status:503,headers:{'Content-Type':'text/html'}}))).rejects.toThrow('service_unavailable');
 await expect(readAIResponse(new Response('Worker exceeded CPU time limit',{status:503}))).rejects.toThrow('workers_cpu_limit');
 for(const code of ['image_daily_limit_reached','text_budget_exhausted','cloudflare_free_allocation_exhausted','provider_quota_unconfirmed'])await expect(readAIResponse(Response.json({error:code},{status:429}))).rejects.toThrow(code);
 expect(aiErrors.image_daily_limit_reached).toContain('Conversation remains available');expect(aiErrors.service_unavailable).toContain('not a confirmed usage-limit');
});

it('distinguishes platform resource HTML from confirmed CPU and quota errors',async()=>{await expect(readAIResponse(new Response('<title>Worker exceeded resource limits</title>',{status:503,headers:{'Content-Type':'text/html'}}))).rejects.toThrow('workers_resource_limit');});
