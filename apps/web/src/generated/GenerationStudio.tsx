import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {ArrowUpIcon,CheckIcon,CodeIcon,ReloadIcon} from '@radix-ui/react-icons';
import type {GenerationJob,GenerationEvent,Snapshot,Mutation} from '@livingforma/contracts';
import {useDraft} from '../lib/client';
import {getIdentity,getPageRevision,protectedRequest,request,subscribeIdentity} from '../lib/session-client';
import {Modal} from '../components/ui';
import {VoiceInput} from '../components/media/VoiceInput';
import {GeneratedSite} from './GeneratedSite';
import {Formation} from './Formation';
import {ToolEvidence} from './ToolEvidence';
import {acceptGenerationEvent,latestOutline,newerGeneration} from './progress';
import './generated.css';
import './studio.css';

type Launch={id:string;prompt?:string;autoStart?:boolean};
type Props={snapshot:Snapshot;accountId:string;csrf:string|null;mutate:(input:Omit<Mutation,'requestId'|'definitionVersion'>)=>Promise<unknown>;onLogin:()=>void;onPublished:()=>Promise<unknown>;onUseModules:()=>void;launch:Launch|null;onLaunchConsumed:()=>void};
const studioTabs=['preview','html','css','js','tools']as const;
const activeStages=new Set(['queued','planning','writing','validating','repairing','publishing']);
const stageLabel:Record<string,string>={queued:'Your idea is in the queue',planning:'Thinking through the experience',writing:'Writing your website',validating:'Checking the source',repairing:'Repairing the preview',preview:'Your preview is ready to test',checked:'Preview checked — ready to publish',publishing:'Publishing this revision',published:'Your website is live',failed:'This draft needs another try',cancelled:'Generation stopped'};
export function interactionFeedbackReport(job:Pick<GenerationJob,'stage'|'sourceRevision'|'repairCount'>|null,text:string){
  if(!job||!['preview','checked'].includes(job.stage))throw new Error('Wait for a preview before reporting an interaction issue.');
  if(job.repairCount>=1)throw new Error('This generation has used its one repair attempt. Add your feedback to the description and create another revision.');
  const message=text.trim();if(!message||message.length>500)throw new Error('Describe the issue in 1–500 characters.');
  return {sourceRevision:job.sourceRevision,ok:false,errors:[message]};
}
export function GenerationStudio(p:Props){
  const identity=useSyncExternalStore(subscribeIdentity,getIdentity),reduced=useReducedMotion();
  const [draft,setDraft]=useDraft(`${p.snapshot.space.id}:command`,{},p.accountId),[open,setOpen]=useState(false),[job,setJob]=useState<GenerationJob|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[voiceBusy,setVoiceBusy]=useState(false),[tab,setTab]=useState<typeof studioTabs[number]>('preview'),[viewport,setViewport]=useState<'desktop'|'phone'>('desktop'),[previewError,setPreviewError]=useState('');
  const [feedbackDraft,setFeedbackDraft]=useDraft(`${p.snapshot.space.id}:preview-feedback`,{},p.accountId),[feedbackOpen,setFeedbackOpen]=useState(false),[feedbackBusy,setFeedbackBusy]=useState(false);
  const feedbackPending=useRef<string|null>(null);
  const failedCheck=useRef<{id:string;revision:number}|null>(null),[checkError,setCheckError]=useState(''),[checkRetrying,setCheckRetrying]=useState(false),[previewAttempt,setPreviewAttempt]=useState(0);
  const feedback=feedbackDraft.jobId===job?.id&&feedbackDraft.sourceRevision===job?.sourceRevision?String(feedbackDraft.text??''):'';
  const orb=useRef<HTMLButtonElement>(null);
  const epoch=useRef(0),current=useRef({p,job,draft});current.current={p,job,draft};
  const checked=useRef(new Set<string>()),autoStarted=useRef<string|null>(null),diagnosticTimer=useRef<ReturnType<typeof setTimeout>|null>(null),diagnosticErrors=useRef<string[]>([]);
  const prompt=String(draft.prompt??''),active=busy||checkRetrying||!!job&&activeStages.has(job.stage);
  const base=`/api/spaces/${encodeURIComponent(p.snapshot.space.slug)}/generations`;
  const source=useMemo(()=>{const result={html:'',css:'',js:''};for(const event of (job?.events??[]).filter(event=>event.sourceRevision===job?.sourceRevision))for(const key of ['html','css','js']as const)if(typeof event.source?.[key]==='string')result[key]=event.source[key]!;const complete=job?.proposal?.appSpec.generated;if(complete)return {html:complete.html,css:complete.css,js:complete.js};return result},[job]);
  const outline=useMemo(()=>latestOutline(job),[job]);
  const preview=useMemo(()=>{if(!job?.proposal?.appSpec.generated||!['preview','checked','published'].includes(job.stage))return null;const spec=job.proposal.appSpec.components.find(component=>component.type==='generated-site');if(!spec)return null;return {spec,snapshot:{...p.snapshot,definition:{definitionVersion:job.baseDefinitionVersion+1,entitySchema:job.proposal.entitySchema,appSpec:job.proposal.appSpec,summary:job.proposal.summary},phase:'ready'} as Snapshot}},[job,p.snapshot]);
  useEffect(()=>{return()=>{epoch.current++;if(diagnosticTimer.current)clearTimeout(diagnosticTimer.current)}},[]);
  useEffect(()=>{if(current.current.job){epoch.current++;setJob(null);setBusy(false);setError('Your session changed. Start a new generation or reopen your saved draft.')}setPreviewError('');setFeedbackBusy(false);feedbackPending.current=null;setFeedbackOpen(false);failedCheck.current=null;setCheckError('');setCheckRetrying(false);},[identity.revision]);
  useEffect(()=>{setPreviewError('');diagnosticErrors.current=[];setFeedbackOpen(false);failedCheck.current=null;setCheckError('');setCheckRetrying(false);},[job?.id,job?.sourceRevision]);
  async function load(id:string,token=epoch.current){const next=await request<GenerationJob>(`${base}/${encodeURIComponent(id)}`);if(token===epoch.current)setJob(previous=>newerGeneration(previous,next));return next}
  useEffect(()=>{
    if(!open||job||busy||typeof draft.jobId!=='string')return;const token=epoch.current;void load(draft.jobId,token).catch(error=>{if(token===epoch.current)setError(`This saved generation is unavailable. Your prompt is safe. ${error.message}`)});
  },[open,job?.id,draft.jobId,identity.revision,busy]);
  useEffect(()=>{
    if(!job||['published','failed','cancelled'].includes(job.stage))return;
    let alive=true,pending=false;const token=epoch.current,id=job.id;const after=job.events.at(-1)?.sequence??0;
    const stream=new EventSource(`${base}/${encodeURIComponent(id)}/events?after=${after}`);
    const reload=async()=>{if(pending||!alive)return;pending=true;try{await load(id,token)}catch(error){if(alive&&token===epoch.current)setError((error as Error).message)}finally{pending=false}};
    stream.addEventListener('generation',event=>{try{const update=JSON.parse((event as MessageEvent).data) as GenerationEvent;if(token!==epoch.current||!alive)return;setJob(previous=>previous?.id===id?acceptGenerationEvent(previous,update):previous);if(typeof update.sequence==='number'&&update.sequence>(current.current.job?.events.at(-1)?.sequence??0))void reload()}catch{void reload()}});
    stream.onerror=()=>{stream.close();void reload()};
    const poll=setInterval(()=>{if(document.visibilityState==='visible')void reload()},3000);
    return()=>{alive=false;clearInterval(poll);stream.close()};
  },[job?.id,job?.stage,identity.revision]);
  async function start(text=prompt,providedRequestId?:string){
    const baseDefinitionVersion=p.snapshot.definition?.definitionVersion??0;const requestId=providedRequestId??(!job&&draft.submittedPrompt===text&&draft.baseDefinitionVersion===baseDefinitionVersion&&typeof draft.requestId==='string'?draft.requestId:crypto.randomUUID());
    if(!text.trim()||busy||checkRetrying||voiceBusy)return;const token=++epoch.current;feedbackPending.current=null;setFeedbackBusy(false);setBusy(true);setError('');setPreviewError('');setJob(null);checked.current.clear();setTab('preview');
    setDraft({prompt:text,submittedPrompt:text,baseDefinitionVersion,requestId});
    try{const next=await protectedRequest<GenerationJob>(base,{method:'POST',body:JSON.stringify({prompt:text.trim(),baseDefinitionVersion,requestId})},p.accountId);if(token!==epoch.current)return;setJob(next);setDraft({prompt:text,submittedPrompt:text,baseDefinitionVersion,requestId,jobId:next.id})}catch(error){if(token===epoch.current)setError((error as Error).message)}finally{if(token===epoch.current)setBusy(false)}
  }
  useEffect(()=>{if(!p.launch||autoStarted.current===p.launch.id)return;const launch=p.launch;const timer=setTimeout(()=>{autoStarted.current=launch.id;setOpen(true);p.onLaunchConsumed();if(launch.prompt)setDraft({prompt:launch.prompt});if(launch.autoStart&&launch.prompt)void start(launch.prompt,launch.id)},0);return()=>clearTimeout(timer)},[p.launch?.id]);
  async function stop(){if(!job)return;const id=job.id,token=++epoch.current;feedbackPending.current=null;setFeedbackBusy(false);setBusy(true);setError('');setJob(null);try{const next=await protectedRequest<GenerationJob>(`${base}/${encodeURIComponent(id)}/cancel`,{method:'POST',body:'{}'},p.accountId);if(token===epoch.current)setJob(next)}catch(error){if(token===epoch.current)setError((error as Error).message)}finally{if(token===epoch.current)setBusy(false)}}
  function diagnostic(message?:string){
    const currentJob=current.current.job;if(!currentJob||failedCheck.current?.id===currentJob.id&&failedCheck.current.revision===currentJob.sourceRevision||feedbackPending.current===`${currentJob.id}:${currentJob.sourceRevision}`||!['preview','checked'].includes(currentJob.stage))return;
    if(message){diagnosticErrors.current.push(message.slice(0,500));setPreviewError(message)}
    if(diagnosticTimer.current)clearTimeout(diagnosticTimer.current);
    const revision=currentJob.sourceRevision,key=`${currentJob.id}:${revision}:${message?'error':'ready'}`,token=epoch.current,page=getPageRevision();
    const valid=()=>token===epoch.current&&page===getPageRevision()&&current.current.job?.id===currentJob.id&&current.current.job.sourceRevision===revision;
    diagnosticTimer.current=setTimeout(async()=>{
      if(!valid()||checked.current.has(key))return;checked.current.add(key);const errors=diagnosticErrors.current.slice(0,8);diagnosticErrors.current=[];
      try{const next=await protectedRequest<GenerationJob>(`${base}/${encodeURIComponent(currentJob.id)}/preview`,{method:'POST',body:JSON.stringify({sourceRevision:revision,ok:errors.length===0,errors})},p.accountId);if(valid()){setJob(previous=>newerGeneration(previous,next));setCheckRetrying(false);if(next.sourceRevision!==revision)setPreviewError('')}}catch(error){checked.current.delete(key);if(valid()){failedCheck.current={id:currentJob.id,revision};setCheckError((error as Error).message);setCheckRetrying(false)}}
    },message?100:650);
  }
  function retryPreviewCheck(){
    const failed=failedCheck.current,target=current.current.job;
    if(!failed||!target||failed.id!==target.id||failed.revision!==target.sourceRevision||!['preview','checked'].includes(target.stage)||busy||checkRetrying||!p.snapshot.permissions.canEdit||getIdentity().session?.user?.id!==p.accountId)return;
    failedCheck.current=null;setCheckError('');setCheckRetrying(true);setTab('preview');setPreviewError('');diagnosticErrors.current=[];
    checked.current.delete(`${target.id}:${target.sourceRevision}:ready`);checked.current.delete(`${target.id}:${target.sourceRevision}:error`);
    setPreviewAttempt(value=>value+1);
  }
  async function reportInteraction(){
    const target=current.current.job;if(feedbackPending.current||busy||checkRetrying||!p.snapshot.permissions.canEdit)return;
    let body;try{body=interactionFeedbackReport(target,feedback)}catch(error){setError((error as Error).message);return}if(!target)return;
    const token=epoch.current,page=getPageRevision(),id=target.id;
    const valid=()=>token===epoch.current&&page===getPageRevision()&&getIdentity().session?.user?.id===p.accountId&&current.current.job?.id===id;
    feedbackPending.current=`${id}:${body.sourceRevision}`;setFeedbackBusy(true);setBusy(true);setError('');setPreviewError('An interaction issue was reported. Repair this draft or create another revision before publishing.');
    if(diagnosticTimer.current)clearTimeout(diagnosticTimer.current);diagnosticErrors.current=[];
    checked.current.add(`${id}:${body.sourceRevision}:ready`);checked.current.add(`${id}:${body.sourceRevision}:error`);
    try{const next=await protectedRequest<GenerationJob>(`${base}/${encodeURIComponent(id)}/preview`,{method:'POST',body:JSON.stringify(body)},p.accountId);if(!valid())return;setJob(previous=>newerGeneration(previous,next));setFeedbackOpen(false);}
    catch(error){if(valid()&&current.current.job?.sourceRevision===body.sourceRevision)setError((error as Error).message)}
    finally{if(valid()){feedbackPending.current=null;setFeedbackBusy(false);setBusy(false)}}
  }
  async function publish(){if(!job||job.stage!=='checked'||previewError||checkError||checkRetrying)return;const token=epoch.current;setBusy(true);setError('');try{const result=await protectedRequest<{snapshot:Snapshot;job:GenerationJob}>(`${base}/${encodeURIComponent(job.id)}/publish`,{method:'POST',body:JSON.stringify({sourceRevision:job.sourceRevision,requestId:crypto.randomUUID()})},p.accountId);if(token!==epoch.current)return;await p.onPublished();if(token!==epoch.current)return;setJob(result.job);setDraft({});setOpen(false)}catch(error){if(token===epoch.current)setError((error as Error).message)}finally{if(token===epoch.current)setBusy(false)}}
  return <><div className="orb-anchor"><motion.button ref={orb} className={`owner-orb ${active?'is-working':''}`} aria-label="Open the space designer" title="Build your website" onClick={()=>setOpen(true)} whileTap={reduced?undefined:{scale:.96}}><span className="orb-inner"><span/><span/><span/></span></motion.button><span className="orb-caption">{active?'Creating your website…':job?.stage==='checked'?'Your website draft is ready':'Your space, in your words'}</span></div>
    <Modal open={open} onOpenChange={setOpen} title="An idea. A website. Yours." description="Describe the experience you want. Preview it here, then publish when it feels right." className="generation-studio" onCloseAutoFocus={event=>{event.preventDefault();orb.current?.focus()}}>
      <div className="studio-grid"><aside className="studio-brief"><span className="eyebrow">YOUR NEXT POSSIBILITY</span>{checkError&&<div role="alert"><p className="form-error">The preview check could not be confirmed. {checkError}</p><button className="button secondary" disabled={busy||checkRetrying} onClick={retryPreviewCheck}>Retry preview check</button><p className="inline-note">This reopens and checks the same draft. It does not start a new generation.</p></div>}<form onSubmit={event=>{event.preventDefault();void start()}}><label className="sr-only" htmlFor="website-prompt">Describe your website</label><textarea id="website-prompt" aria-label="Describe your website" value={prompt} onChange={event=>setDraft(previous=>({...previous,prompt:event.target.value}))} maxLength={4000} rows={7} placeholder="A playful place to discover photographs. A personal reading room. An interactive exhibition…"/><button className="button primary" disabled={!prompt.trim()||active||voiceBusy}>{active?'Creating…':job?'Create another revision':'Create website'}<ArrowUpIcon/></button></form><VoiceInput slug={p.snapshot.space.slug} csrf={p.csrf} disabled={active} onBusyChange={setVoiceBusy} onTranscript={text=>setDraft(previous=>({...previous,prompt:[String(previous.prompt??'').trim(),text].filter(Boolean).join('\n').slice(0,4000)}))}/>
        <div className="studio-persistence"><CheckIcon/><span>Your records and address stay with this space. A draft never replaces your live website.</span></div><button className="text-button studio-module-link" onClick={()=>{setOpen(false);p.onUseModules()}}>Use the module composer instead</button>
        {job&&<div className="generation-progress" aria-live="polite"><span className="eyebrow">{stageLabel[job.stage]}</span><ol>{job.events.slice(-8).map(event=><li key={event.sequence}><span className={`stage-dot stage-${event.stage}`}/><div><strong>{event.tool?`${event.tool.name} · ${event.tool.phase}`:event.stage}</strong><p>{event.tool?.message||event.message}</p></div></li>)}</ol></div>}
        {(error||job?.error)&&<p className="form-error" role="alert">{error||job?.error}</p>}
      </aside><section className="studio-workbench"><div className="studio-toolbar"><div className="studio-tabs" role="tablist" aria-label="Website workspace">{studioTabs.map(value=><button key={value} role="tab" tabIndex={tab===value?0:-1} aria-selected={tab===value} onKeyDown={event=>{const tabs=studioTabs;const index=tabs.indexOf(value);const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;if(next>=0){event.preventDefault();setTab(tabs[next]);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()}}} onClick={()=>setTab(value)}>{value==='preview'?'Preview':value==='tools'?'Tools':value.toUpperCase()}</button>)}</div>{tab==='preview'&&<div className="studio-widths"><button aria-pressed={viewport==='desktop'} onClick={()=>setViewport('desktop')}>Desktop</button><button aria-pressed={viewport==='phone'} onClick={()=>setViewport('phone')}>Phone</button></div>}</div>
        {tab==='tools'?<ToolEvidence job={job} slug={p.snapshot.space.slug}/>:tab!=='preview'?<div className="studio-source"><div><CodeIcon/><span>{tab==='html'?'index.html':tab==='css'?'style.css':'app.js'} · {source[tab].length.toLocaleString()} characters</span></div><pre><code>{source[tab]||'Source will appear here as your website is written.'}</code></pre></div>:preview?<div className={`studio-preview ${viewport==='phone'?'phone':''}`}><GeneratedSite key={`${job!.id}:${job!.sourceRevision}:${previewAttempt}`} snapshot={preview.snapshot} spec={preview.spec} generation={{id:job!.id,revision:job!.sourceRevision}} mutate={p.mutate} onLogin={p.onLogin} onDiagnostic={diagnostic}/></div>:outline&&job?<div className={`studio-preview ${viewport==='phone'?'phone':''}`}><Formation outline={outline.outline} sequence={outline.sequence} scope={`${job.id}:${job.sourceRevision}`}/></div>:<div className="studio-empty"><span className={`studio-drawing ${active?'working':''}`} aria-hidden="true"><i/><i/><i/></span><h3>{active?'Making room for your idea.':'What would you like to bring to life?'}</h3><p>{active?'Waiting for the next layout checkpoint. Only actual design decisions appear here.':'A custom layout, original interactions, and your own point of view. Start with a few words.'}</p></div>}
        {job&&(['preview','checked'].includes(job.stage)||job.repairCount>=1&&job.stage==='failed')&&<section className="studio-feedback" aria-label="Preview interaction feedback">
          {job.repairCount>=1?<p className="studio-feedback-limit">This generation has used its one repair attempt. If something still needs work, add it to your description and choose <strong>Create another revision</strong>. Your live website stays unchanged until you publish.</p>:<><div className="studio-feedback-heading"><div><strong>Something not working?</strong><p>A startup check cannot test every interaction.</p></div><button className="text-button" aria-expanded={feedbackOpen} aria-controls="preview-feedback-form" disabled={active} onClick={()=>setFeedbackOpen(value=>!value)}>{feedbackOpen?'Hide feedback':'Report an issue'}</button></div>{feedbackOpen&&<motion.form id="preview-feedback-form" initial={reduced?false:{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.16}} onSubmit={event=>{event.preventDefault();void reportInteraction()}}><label className="field" htmlFor="preview-feedback">What should work differently?<textarea id="preview-feedback" value={feedback} onChange={event=>setFeedbackDraft({jobId:job.id,sourceRevision:job.sourceRevision,text:event.target.value})} maxLength={500} rows={3} required disabled={feedbackBusy} placeholder="Describe what you tried, what happened, and what you expected." aria-describedby="preview-feedback-guidance"/></label><p id="preview-feedback-guidance">This asks the AI to use this generation’s one repair attempt. Your original description and live website are kept.</p><div className="studio-feedback-actions"><span>{feedback.length} / 500</span><button type="submit" className="button secondary" disabled={!feedback.trim()||feedback.length>500||active}>{feedbackBusy?'Requesting repair…':'Request repair'}</button></div></motion.form>}</>}
        </section>}
        <div className="studio-footer"><span>{job?.stage==='checked'?'This revision passed its browser startup check. Explore the interactions before publishing.':'Preview is isolated and read-only. Your published website stays available.'}</span><div>{job&&activeStages.has(job.stage)&&<button className="button secondary" onClick={()=>void stop()}>Stop generation</button>}{job&&<button className="text-button" onClick={()=>void load(job.id).catch(error=>setError(error.message))} aria-label="Refresh generation"><ReloadIcon/></button>}<button className="button primary" onClick={()=>void publish()} disabled={job?.stage!=='checked'||busy||checkRetrying||!!checkError||!!previewError}>Publish website<ArrowUpIcon/></button></div></div>
      </section></div>
    </Modal></>;
}
