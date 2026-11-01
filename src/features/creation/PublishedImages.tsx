import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {Overlay} from '../../components/Overlay';
import type {PublishedImage} from './starterWorlds';
import './published-images.css';
export default function PublishedImages({category,onSelect,selected}:{category:string;onSelect?:(image:PublishedImage|undefined)=>void;selected?:string}){
 const [items,setItems]=useState<PublishedImage[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(1),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[detailId,setDetailId]=useState<string|null>(null);
 const detail=items.find(image=>image.id===detailId);
 useEffect(()=>{setPage(1);setDetailId(null);},[category]);
 useEffect(()=>{const update=()=>setRefresh(v=>v+1);window.addEventListener('focus',update);return()=>window.removeEventListener('focus',update);},[]);
 useEffect(()=>{const c=new AbortController();fetch('/api/public/images?'+new URLSearchParams({category,page:String(page)}),{cache:'no-store',signal:c.signal}).then(async r=>{if(r.status===404)return{items:[],totalPages:1};if(!r.ok)throw Error('Images unavailable.');return r.json();}).then(d=>{if(!c.signal.aborted){setItems(d.items);setPages(d.totalPages);setError('');}}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[category,page,refresh]);
 return <section className="published-images" aria-label={onSelect?'Starter World images':'Published world images'}>
 <h3>{onSelect?'Choose a Starter World':'World images'}</h3>
 {onSelect&&<button type="button" aria-pressed={!selected} onClick={()=>onSelect(undefined)}>Use existing world artwork</button>}
 {error&&<p role="alert">{error}</p>}
 <div className={`published-image-grid${onSelect?' starter-image-gallery':''}`}>
 {items.map(image=><article key={image.id}>{onSelect?<button className="starter-image-card" type="button" aria-label={`View ${image.name}`} aria-haspopup="dialog" aria-pressed={selected===image.id} onClick={()=>setDetailId(image.id)}><img src={image.previewUrl} alt="" loading="lazy"/><span className="starter-image-name">{image.name}</span>{selected===image.id&&<span className="starter-image-check" aria-label="Selected starter">✓</span>}</button>:<><img src={image.previewUrl} alt={image.name} loading="lazy"/><h4>{image.name}</h4><p>{image.description}</p><a href={image.fileUrl} target="_blank" rel="noreferrer">View original</a></>}</article>)}
 </div>
 {!items.length&&!error&&<p>No published images yet.</p>}
 {pages>1&&<div><button type="button" disabled={page===1} onClick={()=>{setDetailId(null);setPage(p=>p-1);}}>Previous images</button><span> {page} / {pages} </span><button type="button" disabled={page===pages} onClick={()=>{setDetailId(null);setPage(p=>p+1);}}>Next images</button></div>}
 {onSelect&&detail&&createPortal(<div className="starter-detail-layer" data-starter-detail data-starter-id={detail.id}><Overlay title={detail.name} closeLabel="Close starter details" onClose={()=>setDetailId(null)}><img className="starter-detail-image" src={detail.fileUrl} alt={detail.name}/><h2>{detail.name}</h2><p className="starter-detail-description">{detail.description}</p><p role="status">{selected===detail.id?'Selected starter':'Not selected yet'}</p><p>Choose this starter to continue with your world name and description.</p><button type="button" className="creation-primary" onClick={()=>{onSelect(detail);setDetailId(null);}}>Create World</button></Overlay></div>,document.body)}
 </section>;
}
