import { Compile } from 'typebox/compile';
import type { TSchema } from 'typebox';
export type ProviderDiagnostic={category:'quota'|'configuration'|'schema'|'unavailable'|'cancelled'|'output'|'unknown';status?:number;code?:string;signals:string[];reason?:string};

function safeReason(message:string,redactions:readonly string[]):string|undefined{
  let value:unknown=message;
  for(let depth=0;depth<6;depth++){
    if(typeof value==='string'){
      const text=value;
      try{value=JSON.parse(text);continue;}catch{
        const start=text.indexOf('{'),end=text.lastIndexOf('}');
        if(start>0&&end>start){try{value=JSON.parse(text.slice(start,end+1));continue;}catch{/* Not a standard error wrapper. */}}
        break;
      }
    }
    if(Array.isArray(value)&&value.length===1){value=value[0];continue;}
    if(value&&typeof value==='object'){
      if('error'in value){value=value.error;continue;}
      if('message'in value&&typeof value.message==='string'){value=value.message;continue;}
    }
    break;
  }
  let reason=typeof value==='string'?value:undefined;
  if(!reason)return /request contains an invalid argument/i.test(message)?'Request contains an invalid argument.':undefined;
  for(const value of redactions)if(value)reason=reason.split(value).join('[redacted]');
  reason=reason.replace(/AIza[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+/gi,'[redacted]').replace(/https?:\/\/[^\s"'<>]+/gi,'[provider URL]').replace(/\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|csrf[_-]?token)\s*[:=]\s*[^\s,;]+/gi,'[redacted]').trim();
  // Error messages may quote rejected payloads. Never retain those, code or conversation text.
  if(!reason||reason.length>300||/[{}]|<script|ownerRequest|currentDefinition|systemInstruction|repairCandidate|\b(?:const|let|function)\s|PRIVATE KEY|\b(?:role|content|prompt)\s*[:=]/i.test(reason))return undefined;
  return reason.replace(/["'][^"']{48,}["']/g,'[quoted value]').replace(/[\r\n\t]+/g,' ');
}

/** Classify provider failures; never retain its raw message, prompt, source or thinking. */
export function providerDiagnostic(message:string,redactions:readonly string[]=[]):ProviderDiagnostic {
  const text=message.slice(0,16000);
  const statusText=text.match(/(?:status(?: code)?|code|HTTP)["'\s:=]*(400|401|403|404|408|413|422|429|500|502|503|504)\b/i)?.[1];
  const status=statusText?Number(statusText):undefined;
  const code=['INVALID_ARGUMENT','RESOURCE_EXHAUSTED','PERMISSION_DENIED','UNAUTHENTICATED','NOT_FOUND','UNAVAILABLE','DEADLINE_EXCEEDED','INTERNAL'].find(value=>text.includes(value));
  const patterns:Array<[string,RegExp]>=[
    ['schema',/schema|function.?declarations|parametersJsonSchema/i],['complexity',/too (?:many|complex)|complexity|many states|state limit/i],
    ['nesting',/nested|nesting|depth/i],['length',/length|too (?:long|large)|size|bytes/i],['unsupported',/not supported|unsupported|unknown (?:name|field|type)|unrecognized/i],
    ['required',/required|must (?:be|have|contain)/i],['type',/\btype\b|anyOf|oneOf|union/i],['null',/\bnull\b|nullable/i],
    ['enum',/\benum\b/i],['array',/\barray\b|\bitems\b/i],['properties',/properties|property/i],['tool_choice',/tool.?choice|function.?calling/i],
    ['thinking_config',/thinking.?level|thinking.?config|thinking.?budget/i],['quota',/quota|free-use budget|RESOURCE_EXHAUSTED|rate limit/i],
    ['credentials',/api.?key|credential|permission|authentication/i],['busy',/overload|unavailable|try again|busy/i],
    ['cancelled',/abort|cancel|timeout|timed out|deadline/i],['output_limit',/MAX_TOKENS|token limit|maximum output/i],
    ['tool_arguments',/tool arguments|tool call|validate|validation|invalid json/i],['custom_fetch',/custom fetch/i],
    ['generic_invalid_argument',/request contains an invalid argument/i],
    ['billing',/billing|payment|paid (?:tier|plan)/i],['region',/region|location|country/i],['api_version',/api.?version|v1beta|v1alpha/i],
  ];
  const signals=patterns.filter(([,pattern])=>pattern.test(text)).map(([name])=>name);
  const category=signals.includes('quota')||status===429?'quota':status===401||status===403||['credentials','billing','region','api_version'].some(signal=>signals.includes(signal))?'configuration':signals.includes('schema')||status===400||status===422?'schema':signals.includes('cancelled')?'cancelled':signals.includes('busy')||status!==undefined&&status>=500?'unavailable':signals.includes('output_limit')||signals.includes('tool_arguments')?'output':'unknown';
  const reason=safeReason(text,redactions);
  return {category,...(status?{status}:{}),...(code?{code}:{}),signals,...(reason?{reason}:{})};
}

export function classifiedProviderError(diagnostic:ProviderDiagnostic):{code:string;message:string}{
  const messages={
    quota:{code:'FREE_QUOTA_EXHAUSTED',message:'The Gemini free allowance is exhausted or unavailable. No paid fallback is enabled.'},
    configuration:{code:'PROVIDER_CONFIGURATION',message:'The AI provider rejected its configuration. Your current app is unchanged.'},
    schema:{code:'PROVIDER_REQUEST_INVALID',message:'The AI provider rejected the generation request format. Your current app is unchanged.'},
    unavailable:{code:'PROVIDER_UNAVAILABLE',message:'The AI provider is temporarily unavailable. Your current app is unchanged.'},
    cancelled:{code:'ABORTED',message:'AI generation was cancelled or timed out. Your current app is unchanged.'},
    output:{code:'PROVIDER_OUTPUT_INVALID',message:'The AI provider did not return a complete valid candidate. Your current app is unchanged.'},
    unknown:{code:'PROVIDER_FAILED',message:'The AI planner could not complete this request. Your current app is unchanged.'},
  };
  return messages[diagnostic.category];
}

export type CandidateDiagnostic={tool:string;phase:'arguments'|'candidate';issues:Array<{path:string;rule:string}>};
/** Pi includes complete arguments after its error list. Discard that suffix before inspection. */
export function candidateDiagnostic(tool:string,message:string,schema:unknown,argumentsValue?:unknown):CandidateDiagnostic {
  const head=message.split(/Received arguments:/i,1)[0].slice(0,12000),names=new Set<string>();
  const visit=(value:unknown)=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}for(const [key,child]of Object.entries(value)){if(key==='properties'&&child&&typeof child==='object')for(const name of Object.keys(child))names.add(name);visit(child);}};visit(schema);
  const path=(value:unknown)=>{const parts=Array.isArray(value)?value:String(value??'').split(/[./[\]]+/).filter(Boolean);return parts.slice(0,12).map(part=>typeof part==='number'||/^\d+$/.test(String(part))?String(part):names.has(String(part))?String(part):'?').join('.')||'candidate';};
  const issues:Array<{path:string;rule:string}>=[];
  try{const parsed=JSON.parse(head);if(Array.isArray(parsed))for(const issue of parsed.slice(0,8)){if(issue&&typeof issue==='object')issues.push({path:path(issue.path),rule:['invalid_type','invalid_enum_value','invalid_literal','invalid_union','too_small','too_big','unrecognized_keys','invalid_string','custom'].includes(issue.code)?issue.code:'invalid_value'});}}catch{/* TypeBox emits human-readable validation lines. */}
  if(!issues.length)for(const line of head.split('\n').filter(line=>/^\s*-/.test(line)).slice(0,8)){
    const match=line.match(/^\s*-\s*(.*?):\s*(.*)$/);if(!match)continue;const detail=match[2];
    const rule=/required|missing/i.test(detail)?'required':/unexpected|additional/i.test(detail)?'unexpected_property':/length|items|at (?:least|most)|greater|less|maximum|minimum/i.test(detail)?'bound':/pattern|regular expression/i.test(detail)?'pattern':/union|one of|enum|literal/i.test(detail)?'enum_or_union':'type';
    issues.push({path:path(match[1]),rule});
  }
  // Pi 1.0.1 formats TypeBox's removed error.message property as undefined.
  // Recover keyword-only diagnostics from the installed validator, never its input values.
  if(argumentsValue!==undefined&&/Validation failed for tool/i.test(head))try{
    const typed=Compile(schema as TSchema).Errors(argumentsValue);
    for(const issue of issues){const failure=typed.find(error=>path(error.instancePath)===issue.path);if(!failure)continue;
      issue.rule=['minLength','maxLength','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minItems','maxItems','multipleOf'].includes(failure.keyword)?'bound':
        ['enum','const','anyOf','oneOf'].includes(failure.keyword)?'enum_or_union':failure.keyword==='required'?'required':failure.keyword==='additionalProperties'?'unexpected_property':failure.keyword==='pattern'?'pattern':'type';
    }
  }catch{/* Existing field-only diagnostics remain available if the validator itself fails. */}
  return {tool,phase:/Validation failed for tool/i.test(head)?'arguments':'candidate',issues:issues.length?issues:[{path:'candidate',rule:'invalid_value'}]};
}
