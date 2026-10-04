import {z} from 'zod';
import {parse} from 'acorn';

const stableId=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/).refine(value=>!['__proto__','constructor','prototype'].includes(value),'Reserved identifier');
export type JsonValue=null|boolean|number|string|JsonValue[]|{[key:string]:JsonValue};
export type JsonObject={[key:string]:JsonValue};
export function isBoundedJson(input:unknown,maxBytes=65536):input is JsonValue{
  const queue:Array<{value:unknown;depth:number}>=[{value:input,depth:0}];let nodes=0;
  while(queue.length){const {value,depth}=queue.pop()!;if(++nodes>5000||depth>8)return false;
    if(value===null||typeof value==='boolean')continue;
    if(typeof value==='number'){if(!Number.isFinite(value))return false;continue;}
    if(typeof value==='string'){if(value.length>20000)return false;continue;}
    if(!value||typeof value!=='object')return false;
    if(Array.isArray(value)){if(value.length>2000)return false;for(const child of value)queue.push({value:child,depth:depth+1});continue;}
    if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return false;
    const entries=Object.entries(value);if(entries.length>100)return false;
    for(const [key,child]of entries){if(key.length>100||['__proto__','constructor','prototype'].includes(key))return false;queue.push({value:child,depth:depth+1});}
  }
  try{return new TextEncoder().encode(JSON.stringify(input)).byteLength<=maxBytes}catch{return false}
}
export const jsonValueSchema=z.custom<JsonValue>(isBoundedJson,'Expected bounded JSON data.');
export const jsonObjectSchema=z.custom<JsonObject>(value=>isBoundedJson(value)&&!!value&&typeof value==='object'&&!Array.isArray(value),'Expected a bounded JSON object.');
export type ToolJsonSchema=
 |{type:'object';properties:Record<string,ToolJsonSchema>;required?:string[];additionalProperties:false}
 |{type:'array';items:ToolJsonSchema;maxItems?:number}
 |{type:'string';maxLength?:number;enum?:string[]}
 |{type:'number';minimum?:number;maximum?:number}
 |{type:'boolean'}|{type:'null'};
const schemaNode:z.ZodType<ToolJsonSchema>=z.lazy(()=>z.union([
  z.object({type:z.literal('object'),properties:z.record(stableId,schemaNode).refine(p=>Object.keys(p).length<=32),required:z.array(stableId).max(32).optional(),additionalProperties:z.literal(false)}).strict(),
  z.object({type:z.literal('array'),items:schemaNode,maxItems:z.number().int().min(0).max(2000).optional()}).strict(),
  z.object({type:z.literal('string'),maxLength:z.number().int().min(0).max(20000).optional(),enum:z.array(z.string().max(1000)).min(1).max(30).optional()}).strict(),
  z.object({type:z.literal('number'),minimum:z.number().finite().optional(),maximum:z.number().finite().optional()}).strict(),
  z.object({type:z.literal('boolean')}).strict(),z.object({type:z.literal('null')}).strict(),
]));
export const toolJsonSchema=z.unknown().superRefine((value,context)=>{if(!isBoundedJson(value,20000))context.addIssue({code:'custom',message:'The schema is too large or deeply nested.'})}).pipe(schemaNode).superRefine((value,context)=>{
  const pending=[value];let count=0;while(pending.length){const node=pending.pop()!;if(++count>128){context.addIssue({code:'custom',message:'The schema has too many nodes.'});return;}
    if(node.type==='object'){if(node.required?.some(key=>!(key in node.properties))||new Set(node.required).size!==(node.required?.length??0))context.addIssue({code:'custom',message:'Required properties must be unique and declared.'});pending.push(...Object.values(node.properties));}
    if(node.type==='array')pending.push(node.items);
    if(node.type==='number'&&node.minimum!==undefined&&node.maximum!==undefined&&node.minimum>node.maximum)context.addIssue({code:'custom',message:'Invalid numeric bounds.'});
  }
});
export function validateToolJson(schema:ToolJsonSchema,input:unknown):JsonValue{
  if(!isBoundedJson(input))throw new Error('Tool data exceeds the JSON limits.');
  const validate=(rule:ToolJsonSchema,value:JsonValue,path:string)=>{
    if(rule.type==='object'){
      if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${path} must be an object.`);
      for(const key of rule.required??[])if(!Object.prototype.hasOwnProperty.call(value,key))throw new Error(`${path}.${key} is required.`);
      for(const [key,child]of Object.entries(value)){if(!Object.prototype.hasOwnProperty.call(rule.properties,key))throw new Error(`${path}.${key} is not declared.`);validate(rule.properties[key]!,child,`${path}.${key}`)}return;
    }
    if(rule.type==='array'){if(!Array.isArray(value)||value.length>(rule.maxItems??2000))throw new Error(`${path} must be a bounded array.`);value.forEach((child,i)=>validate(rule.items,child,`${path}[${i}]`));return;}
    if(rule.type==='string'){if(typeof value!=='string'||value.length>(rule.maxLength??20000)||rule.enum&&!rule.enum.includes(value))throw new Error(`${path} must be a valid string.`);return;}
    if(rule.type==='number'){if(typeof value!=='number'||!Number.isFinite(value)||rule.minimum!==undefined&&value<rule.minimum||rule.maximum!==undefined&&value>rule.maximum)throw new Error(`${path} must be a valid number.`);return;}
    if(rule.type==='boolean'&&typeof value!=='boolean'||rule.type==='null'&&value!==null)throw new Error(`${path} must be ${rule.type}.`);
  };validate(schema,input,'value');return input;
}
export const toolBindingSchema=z.object({actionId:stableId,toolId:stableId,toolVersion:z.number().int().positive(),kind:z.enum(['generated','catalog'])}).strict();
export type ToolBinding=z.infer<typeof toolBindingSchema>;
export const toolConnectorSchema=z.object({toolId:stableId,toolVersion:z.number().int().positive()}).strict();
export const generatedToolSpecSchema=z.object({
  kind:z.literal('code-js-v1'),toolId:stableId,toolVersion:z.number().int().positive(),name:z.string().min(1).max(80),description:z.string().max(500),
  source:z.string().min(1).max(32768),inputSchema:toolJsonSchema.refine(s=>s.type==='object','Input must be an object schema.'),outputSchema:toolJsonSchema.refine(s=>s.type==='object','Output must be an object schema.'),
  sideEffects:z.literal('none'),capabilities:z.object({publicRecordFields:z.array(stableId).max(40).default([]),connectors:z.array(toolConnectorSchema).max(4).default([])}).strict(),
  tests:z.array(z.object({name:z.string().min(1).max(100),input:jsonObjectSchema,expected:jsonObjectSchema,
    records:z.array(z.object({id:z.string().min(1).max(100),version:z.number().int().positive().default(1),values:jsonObjectSchema}).strict()).max(20).optional(),
    connectorResults:z.array(z.object({toolId:stableId,toolVersion:z.number().int().positive(),input:jsonObjectSchema,result:jsonObjectSchema}).strict()).max(4).optional(),
  }).strict()).min(2).max(5),
}).strict();
export type GeneratedToolSpec=z.infer<typeof generatedToolSpecSchema>;
export type GeneratedToolManifest=Omit<GeneratedToolSpec,'source'|'tests'>;
export type GeneratedToolTestReport={ok:boolean;results:Array<{name:string;ok:boolean;message:string}>};
export type RegisteredGeneratedTool={spec:GeneratedToolSpec;enabled:boolean;verifiedAt:string;sourceDigest:string;testReport:GeneratedToolTestReport;invocationCount:number};
export type GeneratedToolProgress={toolId:string;name:string;phase:'writing'|'testing'|'ready'|'failed';message?:string};
export type GeneratedToolBroker={readRecords:(input:{fields:string[];limit?:number})=>Promise<JsonObject[]>;callConnector:(input:{toolId:string;toolVersion:number;input:JsonObject})=>Promise<JsonObject>};
export type GeneratedToolAdapter={validate:(input:unknown)=>GeneratedToolSpec;test:(spec:GeneratedToolSpec,signal?:AbortSignal)=>Promise<GeneratedToolTestReport>;invoke:(spec:GeneratedToolSpec,input:JsonObject,options:{broker:GeneratedToolBroker;signal?:AbortSignal})=>Promise<JsonObject>};
export const GENERATED_TOOL_LIMITS={heapBytes:32*1024*1024,stackBytes:256*1024,timeoutMs:4000,startupTimeoutMs:8000,totalTimeoutMs:12000,maxConcurrent:1,maxBrokerCalls:8,maxSourceBytes:32768,maxPayloadBytes:65536} as const;
export function validateGeneratedTool(input:unknown):GeneratedToolSpec{
  const spec=generatedToolSpecSchema.parse(input);
  if(new TextEncoder().encode(spec.source).byteLength>GENERATED_TOOL_LIMITS.maxSourceBytes)throw new Error('Tool source exceeds the byte limit.');
  const ast=parse(spec.source,{ecmaVersion:'latest',sourceType:'script'}) as unknown as {body:Array<{type:string;id?:{name:string};params?:unknown[]}>};
  const runs=ast.body.filter(node=>node.type==='FunctionDeclaration'&&node.id?.name==='run');
  if(runs.length!==1||runs[0]!.params?.length!==2)throw new Error('Declare exactly one function run(input, api). It may be async.');
  if(new Set(spec.capabilities.publicRecordFields).size!==spec.capabilities.publicRecordFields.length||new Set(spec.capabilities.connectors.map(c=>`${c.toolId}:${c.toolVersion}`)).size!==spec.capabilities.connectors.length)throw new Error('Capabilities must be unique.');
  for(const test of spec.tests){validateToolJson(spec.inputSchema,test.input);validateToolJson(spec.outputSchema,test.expected)}
  return spec;
}
export function generatedToolManifest(spec:GeneratedToolSpec):GeneratedToolManifest{const {source:_,tests:__,...manifest}=spec;return manifest}
export type GeneratedToolProposal={spec:GeneratedToolSpec|null;reuse:{toolId:string;toolVersion:number}|null;summary:string;source:'gemini'};
export type GeneratedToolGenerator=(input:{prompt:string;current:import('./index').Definition|null;registeredTools:GeneratedToolManifest[];registeredCatalogTools?:import('./index').RegisteredTool[];signal?:AbortSignal;onProgress?:(event:import('./generated').SiteGenerationProgress)=>void})=>Promise<GeneratedToolProposal>;
export const generatedToolInvocationSchema=z.object({requestId:z.string().uuid(),definitionVersion:z.number().int().positive(),componentId:stableId,actionId:stableId,toolVersion:z.number().int().positive(),input:jsonObjectSchema}).strict();
