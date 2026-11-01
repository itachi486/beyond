import{useEffect,useState}from'react';
import{workersCapabilities,requestText,aiMessage}from'./workersDialogue';
export default function AIWorldPlan({es,name}:{es:boolean;name:string}){
 const[enabled,setEnabled]=useState(false),[message,setMessage]=useState(''),[reply,setReply]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;workersCapabilities().then(c=>{if(alive)setEnabled(!!c?.configured);}).catch(()=>{});return()=>{alive=false;};},[]);
 if(!enabled)return null;
 return <details className="spirit-ai-plan"><summary>{es?'Planificar con Workers AI':'Plan with Workers AI'}</summary><p>{es?'Solo sugerencias. Tu mundo y sus imágenes no se reemplazan.':'Suggestions only. Your world and its images are never replaced.'}</p><label>{es?'¿Qué quieres añadir?':'What would you like to add?'}<textarea value={message} maxLength={1000} onChange={e=>setMessage(e.target.value)}/></label><button type="button" disabled={busy||!message.trim()} onClick={async()=>{setBusy(true);setError('');try{setReply(await requestText({kind:'plan',message:`World: ${name.slice(0,100)}. Additive request: ${message}`,locale:es?'es':'en'}));}catch(e){setError(aiMessage(e instanceof Error?e.message:'',es));}finally{setBusy(false);}}}>{busy?(es?'Pensando…':'Thinking…'):(es?'Preparar plan':'Prepare plan')}</button>{error&&<p role="alert">{error}</p>}{reply&&<p role="status" style={{whiteSpace:'pre-wrap'}}>{reply}</p>}</details>;
}
