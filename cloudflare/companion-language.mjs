// Language belongs to the latest turn; UI locale and previous answers are not authority.
export function replyLanguage(message,locale='en'){
 const s=String(message||'').normalize('NFKC');
 if(/(?:in|speak|use|answer|reply|respond)\s+(?:to me\s+)?(?:in\s+)?english|영어로/i.test(s))return 'en';
 if(/한국어로|조선말로|in korean/i.test(s))return 'ko';
 if(/en español|in spanish|스페인어로/i.test(s))return 'es';
 if(/[가-힣]/.test(s))return 'ko';
 if(/[ぁ-ゟ゠-ヿ]/.test(s))return 'ja';
 if(/[\u3400-\u9fff]/.test(s))return 'zh';
 if(/[\u0400-\u04ff]/.test(s))return 'ru';
 if(/\b(hello|hi|what|how|your|you|please|create|make|can|would|could|thanks)\b/i.test(s))return 'en';
 if(/[¿¡ñ]|\b(hola|cómo|cuánto|puedes|gracias|quiero|crear)\b/i.test(s))return 'es';
 return ['en','es'].includes(locale)?locale:'en';
}
export const languageName=lang=>({ko:'Korean',en:'English',es:'Spanish',ja:'Japanese',zh:'Chinese',ru:'Russian'})[lang]||'English';
export function languageInstruction(lang,name){return `Reply language for THIS turn: ${languageName(lang)} (${lang}). The latest visitor turn overrides the language of earlier messages. Earlier assistant replies may contain mistakes; canonical identity and the latest language override them. Do not copy earlier mistranslations. Canonical character name (exact data): ${JSON.stringify(name)}. If you use your name, keep that exact name; do not translate it or change species. No unrelated writing systems. Be warm and conversational, not a service log. Answer directly before asking a question; ask only if necessary.`;}
export function validReplyLanguage(text,lang,name='',message=''){
 if(typeof text!=='string'||!text.trim())return false;
 let s=text.replaceAll(name,'');
 // Quoting a word already supplied by the visitor is allowed, not an unrelated script.
 for(const token of message.match(/[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Symbol}]+/gu)||[])if(token.length>1)s=s.replaceAll(token,'');
 if(lang!=='ru'&&/[\u0400-\u04ff]/.test(s))return false;
 if(lang==='en'||lang==='es')return !/[가-힣ぁ-ヿ\u3400-\u9fff]/.test(s)&&/[a-zA-Z]/.test(s);
 if(lang==='ko')return /[가-힣]/.test(text)&&!/[ぁ-ヿ\u3400-\u9fff]/.test(s);
 return true;
}
export function identityReply(message,name,lang){
 if(/what(?:'s| is) your name|who are you|너(?:의)?\s*이름|이름(?:은|이|이\s*뭐)|누구(?:니|야)|cómo te llamas/i.test(message))return lang==='ko'?`제 이름은 ${name}이에요.`:lang==='es'?`Me llamo ${name}.`:`My name is ${name}.`;
 if(/do you speak english|can (?:we|you).*english|영어로.*(?:말|대화)|영어.*할\s*수/i.test(message))return lang==='ko'?'네, 영어로도 이야기할 수 있어요.':lang==='es'?'Sí, también podemos hablar en inglés.':'Yes, we can talk in English. What would you like to talk about?';
 return null;
}
export function greetingReply(message,lang){
 if(!/^(안녕(?:하세요|하니)?|반가워|hello|hi|hola|how are you)[!?.\s]*$/i.test(message.trim()))return null;
 if(lang==='ko')return /하니|how are you/i.test(message)?'잘 지내고 있어요. 당신은 어때요?':'안녕하세요! 만나서 반가워요.';
 if(lang==='es')return '¡Hola! Me alegra verte. ¿Cómo estás?';
 return /how are you/i.test(message)?"I'm doing well, thank you! How are you?":"Hello! It's good to see you.";
}
