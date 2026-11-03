// Conservative tool routing. Generated prose never authorizes mutations.
export function companionActionIntent(message,{pending=null,lastEdit=false}={}){
 const s=String(message||'').normalize('NFKC').trim().toLowerCase();
 if(/service_unavailable|image_edit_temporary_failure|network_error|request_timeout|workers_cpu_limit|existing world content is preserved|오류가|오류 메시지|에러가/.test(s))return 'REPORT_ERROR';
 if(/자료량|(?:이미지|생성|AI|ai|image).*(?:남은|남았|잔여|예산)|(?:remaining|available).*(?:budget|credits?|images?|capacity)|(?:budget|credits?).*(?:left|remaining)/i.test(s))return 'CHECK_USAGE';
 if(/(?:내가.*만들어.*(?:아직|더).*수\s*있|아직.*(?:만들|생성).*수\s*있|can (?:you|we|i) still (?:make|create|generate))/i.test(s))return 'CHECK_CAPABILITY';
 if(/(?:오늘|일일|하루|daily|today).*(?:생성량|생성.*(?:번|회)|한도|제한|usage|limit)|(?:사용량|neuron|quota|몇\s*번.*생성)/.test(s))return 'CHECK_USAGE';
 if(/취소|그만|싶지\s*않|원하지\s*않|하지\s*마|만들지\s*마|\bcancel\b|\bstop\b|\bdon'?t\s+(build|create|add|change|edit|make)\b|cancelar/.test(s))return 'CANCEL_ACTION';
 if(/^(응|네|그래|좋아|그렇게\s*하자|그렇게\s*해\s*줘|(?:이제|빨리)\s*만들어\s*(?:달라|줘)|만들어\s*(?:달라|줘)|해\s*줘|설계할\s*수\s*있어|yes|yep|okay|ok|sí|si)[.!?\s]*$/.test(s))return pending||/(?:이제|빨리)\s*만들어|만들어\s*달라/.test(s)?'CONFIRM_ACTION':'GENERAL_CHAT';
 if(/(?:내가\s*만든|우리|기존).*(?:집|농장|정원).*(?:어때|있어|어디|상태|보여)|(?:집|농장|정원).*(?:생성됐|저장됐)|what.*(?:house|farm).*like/.test(s))return 'INSPECT_WORLD';
 if(/문장|무슨\s*뜻|인용|예시|만드는\s*법|방법|설명해|만들었|지었|생성했|꾸몄|수정했|\b(i|we) (built|created|made)\b|\bmeaning\b|\bquote\b|\bexample\b/.test(s))return 'GENERAL_CHAT';
 if(/조금\s*더\s*(크|작)|더\s*(크게|작게)|\b(bigger|smaller|enlarge|shrink)\b/.test(s))return lastEdit||pending?'EDIT_EXISTING_WORLD_OBJECT':'NEEDS_CLARIFICATION';
 const object=/성곽|요새|궁전|성채|성벽|성(?:을|이|은|에|의|도|\s|$)|집|별장|농장|건물|정원|폭포|나무|숲|길|호수|다리|꽃|장소|\b(castle|fortress|palace|citadel|house|villa|cottage|farm|building|garden|waterfall|tree|forest|path|lake|bridge|skybridge|flowers?)\b|casa|jardín/;
 if(object.test(s)&&/있으면\s*좋|좋겠|\b(wish|maybe)\b|would be nice|what do you think/.test(s))return 'NEEDS_CLARIFICATION';
 const verb=/만들|지어|세워|추가|생성|꾸며|수정|바꾸|변경|서양식|옮겨|확대|배치|\b(build|create|add|place|decorate|modify|change|plant|put)\b|constru|crea/;
 if(object.test(s)&&verb.test(s)){if(/어떨까|가능할까|어떻게|수\s*있[어을]|\bhow\b|\bcan\b/.test(s))return 'NEEDS_CLARIFICATION';return /바꾸|변경|서양식|수정|외형|구조|style|western|modify|change/.test(s)?'EDIT_EXISTING_WORLD_OBJECT':'CREATE_WORLD_OBJECT';}
 if(/탐험|가\s*보자|둘러\s*보자|\bexplore\b|let.?s go|explorar/.test(s))return 'EXPLORE_WORLD';
 return 'GENERAL_CHAT';
}
export function companionIntent(message,context={}){const intent=companionActionIntent(message,context);return ({GENERAL_CHAT:'chat',CREATE_WORLD_OBJECT:'edit',EDIT_EXISTING_WORLD_OBJECT:'edit',CONFIRM_ACTION:'edit',CANCEL_ACTION:'cancel',EXPLORE_WORLD:'explore',NEEDS_CLARIFICATION:'clarify',CHECK_USAGE:'usage',CHECK_CAPABILITY:'usage',REPORT_ERROR:'error',INSPECT_WORLD:'inspect'})[intent];}
