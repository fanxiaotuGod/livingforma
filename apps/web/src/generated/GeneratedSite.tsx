import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {jsonObjectSchema,type ToolResult,type ComponentSpec,type Mutation,type Snapshot} from '@livingforma/contracts';
import {getIdentity,getPageRevision,protectedRequest,request,subscribeIdentity} from '../lib/session-client';
import {Modal} from '../components/ui';
import {createHumanChoice,type HumanChoice} from './human-input';
import {bridgeMutation,bridgeToolRequest,frameState,parseBridgeRequest} from './bridge';

type Props={snapshot:Snapshot;spec:ComponentSpec;generation?:{id:string;revision:number};mutate:(input:Omit<Mutation,'requestId'|'definitionVersion'>)=>Promise<unknown>;onLogin:()=>void;onDiagnostic?:(error?:string)=>void};
type Asset={assetId:string;dataUrl:string};
function checkedAsset(value:Asset){if(!/^asset_[a-zA-Z0-9_-]{1,80}$/.test(value.assetId)||!/^data:image\/(png|jpeg|webp);base64,/.test(value.dataUrl)||value.dataUrl.length>710000)throw new Error('The image response could not be verified.');return value}
async function imageData(file:File){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('Choose a PNG, JPEG or WebP image under 12 MB.');
  const bitmap=await createImageBitmap(file);
  try{const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('This browser could not prepare your image.');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);for(const quality of [.86,.7,.5,.3]){const data=canvas.toDataURL('image/jpeg',quality),base64=data.split(',')[1];if(base64.length*3/4<=512*1024)return {mimeType:'image/jpeg',dataBase64:base64}}throw new Error('This image is still too large. Choose a smaller image.')}finally{bitmap.close()}
}
export function GeneratedSite(props:Props){
  const identity=useSyncExternalStore(subscribeIdentity,getIdentity),preview=!!props.generation;
  const iframe=useRef<HTMLIFrameElement>(null),port=useRef<MessagePort|null>(null),current=useRef(props);current.current=props;
  const [status,setStatus]=useState('Connecting to this website…'),[failure,setFailure]=useState(''),[choiceError,setChoiceError]=useState(''),[toolStatus,setToolStatus]=useState<{message:string;failed:boolean}|null>(null);
  const [confirmation,setConfirmation]=useState<HumanChoice<boolean>|null>(null),[picker,setPicker]=useState<HumanChoice<File>|null>(null);
  const version=props.snapshot.definition?.definitionVersion??0;
  const channel=useMemo(()=>crypto.randomUUID(),[props.snapshot.space.slug,version,props.generation?.id,props.generation?.revision,identity.revision]);
  const src=useMemo(()=>`/api/generated-frame?${new URLSearchParams({space:props.snapshot.space.slug,channel,...(props.generation?{generation:props.generation.id,revision:String(props.generation.revision)}:{version:String(version)})})}`,[channel]);
  useEffect(()=>{
    let alive=true,connected=false,busy=false,ready=false,errors=0,count=0,windowStart=Date.now();const seen=new Set<string>(),uploaded=new Set<string>();let cancelChoice:(()=>void)|null=null;
    const actor=identity.session?.user?.id??null,scope=getPageRevision(),revision=identity.revision;
    const valid=()=>alive&&scope===getPageRevision()&&revision===getIdentity().revision;
    const state=()=>frameState(current.current.snapshot,current.current.spec,preview);
    setFailure('');setChoiceError('');setToolStatus(null);setStatus('Connecting to this website…');
    const timeout=setTimeout(()=>{if(valid()&&!ready){setFailure('This website did not finish starting. You can retry the preview or ask for a repair.');current.current.onDiagnostic?.('The website did not call lf.reportReady() within 12 seconds.')}},12000);
    async function run(data:unknown,source:MessagePort){
      let id='',method='';
      try{
        if(!valid())return;const input=parseBridgeRequest(data);id=input.id;method=input.method;
        if(seen.has(id))throw new Error('This request was already handled.');if(seen.size>=512)throw new Error('Please reload this website before continuing.');seen.add(id);
        if(Date.now()-windowStart>=60000){count=0;windowStart=Date.now()}if(++count>100)throw new Error('Too many requests. Please wait a moment.');
        let result:unknown;
        if(input.method==='ready')result=state();
        else if(input.method==='reportReady'){ready=true;clearTimeout(timeout);setStatus('Website ready');current.current.onDiagnostic?.();result={ok:true}}
        else if(input.method==='reportError'){if(errors++<8){const message=String(input.params.message).slice(0,500);setFailure(message);current.current.onDiagnostic?.(message)}result={ok:true}}
        else if(input.method==='image'){
          const assetId=String(input.params.assetId),snapshot=current.current.snapshot;
          const allowed=new Set([...snapshot.definition?.appSpec.generated?.assetIds??[],...uploaded,...state().records.flatMap(record=>Object.values(record.values).filter((value):value is string=>typeof value==='string'&&/^asset_/.test(value)))]);
          if(!allowed.has(assetId))throw new Error('That image is not shared with this website.');
          result=checkedAsset(await request<Asset>(`/api/spaces/${encodeURIComponent(snapshot.space.slug)}/assets/${encodeURIComponent(assetId)}`));
        }else{
          if(preview)throw new Error(input.method==='runTool'?'Tools are disabled in preview. Publish this checked revision before running a tool.':'Preview is read-only. Publish this revision to save changes.');
          if(!actor){current.current.onLogin();throw new Error('Sign in, then try this action again. Nothing was sent.');}
          if(!current.current.snapshot.permissions.canWrite)throw new Error('Your account cannot write to this space.');
          if(busy)throw new Error('Finish the current action before starting another.');busy=true;
          try{
            if(input.method==='runTool'){
              const selected=bridgeToolRequest(input,current.current.snapshot,current.current.spec);setToolStatus({message:'Running the connected tool…',failed:false});
              try{const output=await protectedRequest<ToolResult>(selected.path,{method:'POST',body:JSON.stringify({...selected.body,requestId:crypto.randomUUID()})},actor);if(!valid())return;
                if(output.toolId!==selected.toolId||output.toolVersion!==selected.toolVersion||typeof output.reused!=='boolean')throw new Error('The tool response could not be verified.');
                result={toolId:output.toolId,toolVersion:output.toolVersion,result:jsonObjectSchema.parse(output.result),reused:output.reused};setToolStatus({message:'Tool completed. Its result is now available in this website.',failed:false});
              }catch(error){if(valid())setToolStatus({message:error instanceof Error?error.message:'The tool could not finish.',failed:true});throw error}
            }else if(input.method==='pickImage'){
              const choice=createHumanChoice<File>();cancelChoice=choice.cancel;setChoiceError('');setPicker(choice);const selected=await choice.result;cancelChoice=null;if(valid())setPicker(null);if(!valid())return;
              if(selected.status!=='selected')throw new Error(selected.status==='expired'?'Image selection expired after two minutes. Nothing was uploaded. Try again when you are ready.':'Image selection was cancelled. Nothing was uploaded.');
              const body=await imageData(selected.value);if(!valid())return;
              const asset=checkedAsset(await protectedRequest<Asset>(`/api/spaces/${encodeURIComponent(current.current.snapshot.space.slug)}/assets`,{method:'POST',body:JSON.stringify(body)},actor));uploaded.add(asset.assetId);result=asset;
            }else{
              const mutation=bridgeMutation(input,current.current.snapshot,current.current.spec);
              if(input.method==='remove'){const choice=createHumanChoice<boolean>();cancelChoice=choice.cancel;setChoiceError('');setConfirmation(choice);const selected=await choice.result;cancelChoice=null;if(valid())setConfirmation(null);if(!valid())return;if(selected.status!=='selected'||!selected.value)throw new Error(selected.status==='expired'?'Delete confirmation expired after two minutes. Your record was kept.':'Deletion was cancelled. Your record was kept.');}
              const next=await current.current.mutate(mutation);if(!valid())return;
              result=frameState(next&&typeof next==='object'&&'records'in next?next as Snapshot:current.current.snapshot,current.current.spec,false);
            }
          }finally{busy=false}
        }
        if(valid())source.postMessage({id,ok:true,result});
      }catch(error){if(valid()&&['pickImage','remove'].includes(method))setChoiceError(error instanceof Error?error.message:'This choice could not be completed.');if(valid()&&method==='runTool')setToolStatus({message:error instanceof Error?error.message:'This tool could not run.',failed:true});if(valid()&&id)source.postMessage({id,ok:false,error:{code:'BRIDGE_REJECTED',message:error instanceof Error?error.message.slice(0,500):'This action could not be completed.'}})}
    }
    const connect=(event:MessageEvent)=>{
      if(!valid()||connected||event.source!==iframe.current?.contentWindow||event.origin!=='null')return;
      const value=event.data;if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='channel,type,version'||value.type!=='lf:connect'||value.channel!==channel||value.version!==1||event.ports.length!==1)return;
      connected=true;const connection=event.ports[0];port.current=connection;connection.onmessage=event=>{void run(event.data,connection)};connection.start();
    };
    const cancelOnLeave=()=>cancelChoice?.();window.addEventListener('message',connect);window.addEventListener('pagehide',cancelOnLeave);
    return()=>{alive=false;clearTimeout(timeout);window.removeEventListener('message',connect);window.removeEventListener('pagehide',cancelOnLeave);port.current?.close();port.current=null;cancelChoice?.();cancelChoice=null;setConfirmation(null);setPicker(null)};
  },[channel]);
  useEffect(()=>{port.current?.postMessage({type:'state',state:frameState(props.snapshot,props.spec,preview)})},[props.snapshot,props.spec,preview]);
  return <div className={`generated-site ${preview?'is-preview':''}`}>
    <div className="generated-frame-status"><span role="status">{status}</span><span>{preview?'Read-only preview':'Your data stays in this space'}</span></div>
    {(props.spec.toolBindings?.length||toolStatus)&&<p className={`generated-tool-status ${toolStatus?.failed?'form-error':''}`} role={toolStatus?.failed?'alert':'status'}>{toolStatus?.message||(preview?'Tools stay off until you publish.':'Run a connected tool to see its result.')}</p>}
    {choiceError&&<p className="form-error" role="alert">{choiceError}</p>}
    {failure&&<p className="form-error generated-runtime-error" role="alert">{failure}</p>}
    <iframe ref={iframe} key={channel} src={src} title={preview?'Generated website preview':'Generated website'} sandbox="allow-scripts" referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'; payment 'none'; usb 'none'; serial 'none'; fullscreen 'none'"/>
    <Modal open={!!confirmation} onOpenChange={open=>{if(!open)confirmation?.cancel()}} title="Delete this record?" description="This website asked to remove a saved record. This action cannot be undone. Confirm within two minutes, or the record will be kept."><div className="generated-confirm-actions"><button className="button secondary" onClick={()=>confirmation?.cancel()}>Keep record</button><button className="button primary" onClick={()=>confirmation?.choose(true)}>Delete record</button></div></Modal>
    <Modal open={!!picker} onOpenChange={open=>{if(!open)picker?.cancel()}} title="Add an image" description="Choose an image to save in this space. Large images are resized before upload. Choose within two minutes, or this request will expire."><label className="field">Choose a PNG, JPEG or WebP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)picker?.choose(file);else picker?.cancel()}}/></label><p className="inline-note">Only the file you select is uploaded. Your website receives a saved image reference.</p><button className="button secondary" onClick={()=>picker?.cancel()}>Cancel image selection</button></Modal>
  </div>;
}
