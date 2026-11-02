// Canonical global identities. Names are presentation; immutable IDs determine membership.
export const connectCatalog=[
 ['floating-islands','Floating Islands','b07f9334-7ee6-4c3a-9c79-59e0cab97f27'],
 ['lost-island','Lost Island','82158cf5-d5de-4e88-b6b9-c5fd3a8c92b8'],
 ['endless-desert','Endless Desert','5142ed7e-a1ed-4feb-9c25-77a9ab0104b6'],
 ['deep-ocean','Deep Ocean','4845107c-bffa-421c-b857-05d41533c585'],
 ['green-valley','Green Valley','af8ee6f5-1e89-4a00-970a-9a86494a2846'],
 ['alien-planet','Alien Planet','ff2b1fa4-eefe-46d3-bd88-8fd8842baa4e'],
 ['enchanted-forest','Enchanted Forest',null],['outer-space','Outer Space',null]
].map(([key,name,imageId])=>({key,name,imageId,groupId:'global:'+key}));
