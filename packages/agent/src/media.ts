import { MEDIA_LIMITS, type MediaAdapter, type MediaBudgetStore } from '@livingforma/contracts';
import { describeImage, visionConfigured, PlannerError } from './pi-runtime';

export const MEDIA_ALLOWANCE_PERIOD='verified-2026-10-03';
export const SPEECH_VOICE_ID='SAz9YHcvj6GT2YYXdXww';
export const SPEECH_MODEL='eleven_flash_v2_5';
const speechOrigin='https://api.elevenlabs.io';
const invalid=(message:string):never=>{throw new PlannerError('INVALID_MEDIA',message);};

/** Strict browser-generated PCM WAV; no compressed payload or duration supplied by a client is trusted. */
export function validateWav(audio:Uint8Array,mimeType:string):{seconds:number;dataBytes:number} {
  if(mimeType!=='audio/wav'||audio.byteLength<44||audio.byteLength>MEDIA_LIMITS.maxAudioBytes)invalid('Use a PCM WAV recording of up to 20 seconds.');
  const bytes=Buffer.from(audio.buffer,audio.byteOffset,audio.byteLength);
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.readUInt32LE(4)!==bytes.length-8)invalid('The WAV container is invalid.');
  let fmt=false,dataBytes=0,offset=12;
  while(offset+8<=bytes.length){
    const id=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8,end=start+size;
    if(end>bytes.length)invalid('The WAV data is truncated.');
    if(id==='fmt '){
      if(fmt||size!==16||dataBytes)invalid('Use a standard PCM WAV recording.');
      if(bytes.readUInt16LE(start)!==1||bytes.readUInt16LE(start+2)!==1||bytes.readUInt32LE(start+4)!==16000||bytes.readUInt32LE(start+8)!==32000||bytes.readUInt16LE(start+12)!==2||bytes.readUInt16LE(start+14)!==16)invalid('Audio must be 16 kHz, mono, 16-bit PCM WAV.');
      fmt=true;
    }else if(id==='data'){
      if(!fmt||dataBytes||size%2!==0||size<3200||size>20*32000)invalid('Record between 0.1 and 20 seconds of audio.');dataBytes=size;
    }else invalid('Unsupported WAV chunk. Please record again in this app.');
    offset=end+(size%2);
  }
  if(!fmt||!dataBytes||offset!==bytes.length)invalid('The WAV container is incomplete.');
  return {seconds:dataBytes/32000,dataBytes};
}

export function validateJpeg(image:Uint8Array,mimeType:string):void {
  const b=Buffer.from(image.buffer,image.byteOffset,image.byteLength);
  if(mimeType!=='image/jpeg'||b.length<20||b.length>MEDIA_LIMITS.maxImageBytes||b[0]!==0xff||b[1]!==0xd8||b.at(-2)!==0xff||b.at(-1)!==0xd9)invalid('Use a JPEG camera frame smaller than 400 kB.');
  let offset=2,dimensions=false,scan=false;
  while(offset+4<=b.length){
    if(b[offset]!==0xff)invalid('The JPEG frame is invalid.');
    while(b[offset]===0xff)offset++;if(offset+3>=b.length)invalid('The JPEG frame is truncated.');const marker=b[offset++];
    if(marker===0xda){scan=true;break;}
    const size=b.readUInt16BE(offset);if(size<2||offset+size>b.length)invalid('The JPEG frame is truncated.');
    if([0xc0,0xc1,0xc2].includes(marker)){
      if(dimensions||size<8)invalid('The JPEG frame has invalid dimensions.');
      const height=b.readUInt16BE(offset+3),width=b.readUInt16BE(offset+5);
      if(!width||!height||width>2048||height>2048)invalid('Camera frames must be at most 2048 by 2048 pixels.');dimensions=true;
    }
    offset+=size;
  }
  if(!dimensions||!scan)invalid('The JPEG frame has no supported dimensions.');
}

export async function boundedBody(response:Response,maximum:number,signal:AbortSignal):Promise<Uint8Array> {
  if(Number(response.headers.get('content-length')??0)>maximum)throw new PlannerError('MEDIA_RESPONSE_TOO_LARGE','The media service response was too large.');
  if(!response.body)throw new PlannerError('MEDIA_EMPTY_RESPONSE','The media service returned no content.');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  try{
    for(;;){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maximum)throw new PlannerError('MEDIA_RESPONSE_TOO_LARGE','The media service response was too large.');chunks.push(value);}
    signal.throwIfAborted();const joined=new Uint8Array(size);let at=0;for(const chunk of chunks){joined.set(chunk,at);at+=chunk.length;}return joined;
  }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}

type MediaOptions={budgetStore:MediaBudgetStore;fetch?:typeof fetch;describe?:typeof describeImage};
export function createMediaAdapter(options:MediaOptions):MediaAdapter {
  const http=options.fetch??fetch,describe=options.describe??describeImage;
  const hasSpeech=()=>!!process.env.ELEVENLABS_API_KEY&&process.env.ELEVENLABS_ALLOWANCE_VERIFIED==='true'&&!!options.budgetStore;
  function ensureSpeech(){if(!hasSpeech())throw new PlannerError('MEDIA_UNAVAILABLE','Speech requires a verified included allowance and durable budget.');}
  async function preflight(signal:AbortSignal){
    ensureSpeech();signal.throwIfAborted();
    const response=await http(`${speechOrigin}/v1/user/subscription`,{headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY!},redirect:'error',signal});
    if(!response.ok)throw new PlannerError('ALLOWANCE_UNAVAILABLE','Speech allowance could not be verified. Please use text.');
    const raw=await boundedBody(response,32_768,signal);let value:Record<string,unknown>;
    try{value=JSON.parse(new TextDecoder().decode(raw));}catch{throw new PlannerError('ALLOWANCE_UNAVAILABLE','Speech allowance could not be verified. Please use text.');}
    if(!value||Array.isArray(value)||value.can_extend_character_limit!==false||value.allowed_to_extend_character_limit!==false||typeof value.character_count!=='number'||typeof value.character_limit!=='number'||!Number.isFinite(value.character_count)||!Number.isFinite(value.character_limit)||value.character_count<0||value.character_count>=value.character_limit)throw new PlannerError('FREE_QUOTA_EXHAUSTED','The included speech allowance is unavailable. No paid fallback is enabled.');
  }
  async function reserve(bucket:'elevenlabs-stt-seconds'|'elevenlabs-tts-characters',units:number,signal:AbortSignal){
    signal.throwIfAborted();try{await options.budgetStore.reserve({bucket,period:MEDIA_ALLOWANCE_PERIOD,units,limit:bucket==='elevenlabs-stt-seconds'?60:1000,minuteRequestLimit:3,now:Date.now()});}catch{throw new PlannerError('FREE_QUOTA_EXHAUSTED','The verified speech allowance budget is exhausted or unavailable. Please use text.');}signal.throwIfAborted();
  }
  function providerError(status:number):never{throw new PlannerError(status===429||status===402?'FREE_QUOTA_EXHAUSTED':'MEDIA_PROVIDER_FAILED',status===429||status===402?'The speech service limit has been reached. Please use text.':'The speech service could not complete this request. Please use text.');}
  return {
    capabilities:()=>({canTranscribe:hasSpeech(),canSpeak:hasSpeech(),canObserve:visionConfigured()}),
    transcribe:async({audio,mimeType,signal})=>{
      const {seconds}=validateWav(audio,mimeType);ensureSpeech();signal.throwIfAborted();const started=Date.now(),bounded=AbortSignal.any([signal,AbortSignal.timeout(25_000)]);
      await preflight(bounded);await reserve('elevenlabs-stt-seconds',Math.ceil(seconds),bounded);
      const form=new FormData();form.set('model_id','scribe_v2');form.set('file',new Blob([Uint8Array.from(audio)],{type:'audio/wav'}),'recording.wav');form.set('tag_audio_events','false');form.set('diarize','false');
      const response=await http(`${speechOrigin}/v1/speech-to-text`,{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY!},body:form,redirect:'error',signal:bounded});bounded.throwIfAborted();if(!response.ok)providerError(response.status);
      const raw=await boundedBody(response,65_536,bounded);let value:unknown;
      try{value=JSON.parse(new TextDecoder().decode(raw));}catch{throw new PlannerError('MEDIA_INVALID_RESPONSE','The transcription service returned invalid data. Please use text.');}
      const text=value&&typeof value==='object'&&'text' in value&&typeof value.text==='string'?value.text.trim():'';
      if(!text||text.length>4000)throw new PlannerError('MEDIA_INVALID_RESPONSE','No usable transcript was returned. Please try again or use text.');
      return {text,durationMs:Date.now()-started};
    },
    describe:async({image,mimeType,signal})=>{validateJpeg(image,mimeType);signal.throwIfAborted();const result=await describe(image,signal);signal.throwIfAborted();return result;},
    speak:async({text,signal})=>{
      if(!text.trim()||text.length>300)throw new PlannerError('INVALID_MEDIA','Speech descriptions must contain 1–300 characters.');ensureSpeech();signal.throwIfAborted();const started=Date.now(),bounded=AbortSignal.any([signal,AbortSignal.timeout(20_000)]);
      await preflight(bounded);await reserve('elevenlabs-tts-characters',text.length,bounded);
      const response=await http(`${speechOrigin}/v1/text-to-speech/${SPEECH_VOICE_ID}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY!,'Content-Type':'application/json',Accept:'audio/mpeg'},body:JSON.stringify({text,model_id:SPEECH_MODEL,voice_settings:{stability:0.5,similarity_boost:0.75}}),redirect:'error',signal:bounded});bounded.throwIfAborted();if(!response.ok)providerError(response.status);
      if(response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='audio/mpeg')throw new PlannerError('MEDIA_INVALID_RESPONSE','The speech service returned an unexpected format.');
      const audio=await boundedBody(response,600_000,bounded);if(audio.length<32)throw new PlannerError('MEDIA_EMPTY_RESPONSE','The speech service returned empty audio.');
      return {audio,mimeType:'audio/mpeg',durationMs:Date.now()-started};
    },
  };
}
