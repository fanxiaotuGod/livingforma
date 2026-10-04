import type {CSSProperties} from 'react';
import {AnimatePresence,LayoutGroup,motion,useReducedMotion} from 'motion/react';
import type {GenerationOutline} from '@livingforma/contracts';

function Sketch({kind,items=3}:{kind:GenerationOutline['sections'][number]['kind'];items?:number}){
  if(kind==='media')return <div className="formation-media"><svg viewBox="0 0 60 40" aria-hidden="true"><rect x="1" y="1" width="58" height="38" rx="5"/><circle cx="41" cy="12" r="4"/><path d="m6 33 15-17 12 11 6-6 15 12"/></svg></div>;
  if(kind==='chart')return <div className="formation-chart"><span/><span/><span/><span/><svg viewBox="0 0 240 90" aria-hidden="true"><path d="M0 70 Q40 70 60 45 T120 40 T180 30 T240 12"/></svg></div>;
  if(kind==='collection'||kind==='metrics')return <div className={`formation-cells sketch-${kind}`}>{Array.from({length:items},(_,i)=><div key={i}>{kind==='collection'&&<i className="formation-cover"/>}<i className="formation-line short"/><i className="formation-line"/></div>)}</div>;
  if(kind==='form')return <div className="formation-form">{Array.from({length:Math.min(items,4)},(_,i)=><div key={i}><i className="formation-line short"/><i className="formation-input"/></div>)}<i className="formation-submit"/></div>;
  return <div className={`formation-copy sketch-${kind}`}><i className="formation-line"/><i className="formation-line"/><i className="formation-line short"/>{kind==='hero'&&<i className="formation-submit"/>}</div>;
}
export function Formation({outline,sequence,scope}:{outline:GenerationOutline;sequence:number;scope:string}){
  const reduced=useReducedMotion();
  return <section className="formation" data-skin={outline.skin??'linen'} aria-label="Live design outline"><div className="formation-caption"><div><span className="eyebrow">DESIGN TAKING SHAPE</span><h3>{outline.title||'Your next website'}</h3></div><span role="status">Outline checkpoint {sequence}</span></div><p className="formation-note">A live layout sketch from the generation. These shapes are placeholders, not saved data.</p><LayoutGroup id={`outline-${scope}`}><div className="formation-grid"><AnimatePresence initial={false}>{outline.sections.map((section,index)=><motion.article key={section.id} layout={reduced?false:true} initial={reduced?false:{opacity:0,y:9}} animate={{opacity:1,y:0}} exit={reduced?{opacity:0}:{opacity:0,scale:.97}} transition={reduced?{duration:0}:{duration:.32,ease:[.22,.61,.36,1]}} className={`formation-section outline-${section.kind}`} data-outline-id={section.id} style={{'--outline-columns':section.columns??(outline.layout==='flow'?12:outline.layout==='split'?(index%2===0?8:4):6)} as CSSProperties}><div className="formation-section-label"><span>{section.label||section.kind.replaceAll('-',' ')}</span><small>{section.kind}</small></div><div aria-hidden="true"><Sketch kind={section.kind} items={section.items}/></div></motion.article>)}</AnimatePresence></div></LayoutGroup></section>;
}
