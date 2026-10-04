import { z } from 'zod';
import {generatedArtifactSchema} from './generated';
import {generatedToolSpecSchema,toolBindingSchema} from './generated-tools';
export * from './generated';
export * from './generated-tools';
import { EXTENDED_COMPONENT_TYPES, EXTENDED_MODULES } from './module-catalog';
export { EXTENDED_MODULES } from './module-catalog';

export const idSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/).refine(v=>!['__proto__','constructor','prototype'].includes(v),'Reserved identifier');
export const valueSchema = z.union([z.string().max(10000), z.number().finite(), z.boolean(), z.array(z.string().max(100)).max(366), z.null()]);
export type FieldValue = z.infer<typeof valueSchema>;
export const fieldSchema = z.object({
  id: idSchema, label: z.string().min(1).max(80), type: z.enum(['text','number','enum','boolean','date','dates']),
  required: z.boolean().default(false), public: z.boolean().default(true),
  options: z.array(z.string().min(1).max(80)).max(30).optional(), defaultValue: valueSchema.optional(),
  min: z.number().optional(), max: z.number().optional(),
}).strict();
export const entitySchemaSchema = z.object({schemaVersion:z.number().int().positive(), name:z.string().max(80), fields:z.array(fieldSchema).min(1).max(40)}).strict();
export const componentTypes = ['form','cards','list','counter','progress','calendar-grid','streak','chart','kanban','detail','tool-result','camera','generated-site',...EXTENDED_COMPONENT_TYPES] as const;
export const skinSchema = z.enum(['linen','sage','ink','clay','sand','rose']);
export const moduleSizeSchema=z.object({columns:z.number().int().min(3).max(12),minHeight:z.number().int().min(120).max(960).optional()}).strict();
export const moduleConfigSchema=z.object({
  showHeader:z.boolean().optional(),density:z.enum(['compact','comfortable','spacious']).optional(),
  limit:z.number().int().min(1).max(100).optional(),target:z.number().min(0.01).max(1e12).optional(),
  durationSeconds:z.number().int().min(4).max(7200).optional(),precision:z.number().int().min(0).max(4).optional(),
  prefix:z.string().max(16).optional(),suffix:z.string().max(16).optional(),text:z.string().max(5000).optional(),
  bins:z.number().int().min(2).max(20).optional(),scale:z.number().min(0.01).max(100).optional(),step:z.number().min(0.001).max(1e6).optional(),
}).strict();
export const componentSchema = z.object({
  id:idSchema, type:z.enum(componentTypes), version:z.literal(1), title:z.string().max(120).optional(),
  variant:z.enum(['cover','compact','hero','dense','comfortable','default']).default('default'),
  fields:z.array(idSchema).max(40).default([]), actionIds:z.array(idSchema).max(10).default([]),
  span:z.enum(['full','main','side']).default('full'),
  size:moduleSizeSchema.optional(),config:moduleConfigSchema.optional(),
  groupBy:idSchema.optional(), dateField:idSchema.optional(), valueField:idSchema.optional(),
  sort:z.object({field:idSchema,direction:z.enum(['asc','desc'])}).strict().optional(),
  emphasis:z.object({field:idSchema,equals:valueSchema,style:z.enum(['highlight','pin','dim'])}).strict().optional(),
  toolRef:z.object({toolId:idSchema,toolVersion:z.number().int().positive()}).strict().optional(),
  toolBindings:z.array(toolBindingSchema).max(8).optional(),
}).strict();
export const actionSchema=z.object({id:idSchema,type:z.enum(['record.create','record.update','record.delete','record.checkin','tool.invoke']),label:z.string().max(80),fieldId:idSchema.optional()}).strict();
export const appSpecSchema=z.object({
  specVersion:z.literal(1), title:z.string().min(1).max(120), description:z.string().max(500),
  skin:skinSchema, layout:z.enum(['flow','split','gallery','dashboard']),
  components:z.array(componentSchema).min(1).max(24), actions:z.array(actionSchema).max(12),
  generated:generatedArtifactSchema.optional(),
}).strict();
export const definitionSchema=z.object({definitionVersion:z.number().int().positive(),entitySchema:entitySchemaSchema,appSpec:appSpecSchema,summary:z.string().max(500)}).strict();
export type EntityField=z.infer<typeof fieldSchema>;
export type EntitySchema=z.infer<typeof entitySchemaSchema>;
export type ComponentSpec=z.infer<typeof componentSchema>;
export type AppSpec=z.infer<typeof appSpecSchema>;
export type Definition=z.infer<typeof definitionSchema>;
export type Role='visitor'|'participant'|'owner';
export type DataRecord={id:string; values:Record<string,FieldValue>; version:number; createdAt:string; updatedAt:string};
export type User={id:string;name:string;email?:string;avatarUrl?:string};
export type Session={user:User|null;csrfToken:string|null;auth:{googleConfigured:boolean;localDemoAvailable:boolean};mode:'production'|'local'};
export type Permissions={canEdit:boolean;canWrite:boolean;canUseTools:boolean;actionIds:string[]};
export type Snapshot={space:{id:string;slug:string;title:string;timezone:string;visibility:'public'|'private';participation:'authenticated'|'members'};phase:'unconfigured'|'ready';definition:Definition|null;records:DataRecord[];stateVersion:number;eventCursor:number;role:Role;permissions:Permissions;loginRequiredForWrite:boolean};
export const proposalRequestSchema=z.object({prompt:z.string().trim().min(1).max(4000),baseDefinitionVersion:z.number().int().nonnegative(),requestId:z.string().uuid()}).strict();
export type ProposalRequest=z.infer<typeof proposalRequestSchema>;
export const proposalSchema=z.object({entitySchema:entitySchemaSchema,appSpec:appSpecSchema,summary:z.string().max(500),source:z.enum(['gemini','local-rules']),capabilityGaps:z.array(z.string().max(200)).max(10).default([]),toolProposals:z.array(z.lazy(()=>toolSpecSchema)).max(3).optional(),codeToolProposals:z.array(generatedToolSpecSchema).max(3).optional()}).strict();
export type Proposal=z.infer<typeof proposalSchema>;
export type ProposalResponse={snapshot:Snapshot;proposal:Proposal;requiresToolApproval?:boolean};
export const mutationSchema=z.object({requestId:z.string().uuid(),definitionVersion:z.number().int().positive(),actionId:idSchema,recordId:z.string().max(100).optional(),recordVersion:z.number().int().positive().optional(),values:z.record(valueSchema).default({})}).strict();
export type Mutation=z.infer<typeof mutationSchema>;
export const presentationRequestSchema=z.object({requestId:z.string().uuid(),baseDefinitionVersion:z.number().int().positive(),components:z.array(componentSchema).min(1).max(24),layout:appSpecSchema.shape.layout.optional()}).strict();
export type PresentationRequest=z.infer<typeof presentationRequestSchema>;
export type ApiError={error:{code:string;message:string;requestId?:string}};
export type SpaceEvent={id:number;spaceId:string;type:'definition.published'|'records.changed'|'reset.required';definitionVersion:number;stateVersion:number};

// Declarative HTTP recipes only. endpointId resolves in a server-owned allowlist.
export const toolSpecSchema=z.object({
  toolId:idSchema,toolVersion:z.number().int().positive(),name:z.string().min(1).max(80),description:z.string().max(500),
  endpointId:idSchema,method:z.literal('GET'),sideEffects:z.literal('none'),
  parameters:z.array(z.object({name:idSchema,type:z.enum(['string','number']),required:z.boolean()}).strict()).max(12),
  responseMap:z.record(z.string().regex(/^[a-zA-Z0-9_.]{1,150}$/)),timeoutMs:z.number().int().min(100).max(10000),
}).strict();
export type ToolSpec=z.infer<typeof toolSpecSchema>;
export type RegisteredTool={spec:ToolSpec;enabled:boolean;verifiedAt:string;invocationCount:number};
export type ToolProposal={spec:ToolSpec|null;reused:boolean;requiresEnable:boolean;summary:string;source:'gemini'|'local-rules'};
export type ToolResult={toolId:string;toolVersion:number;result:Record<string,unknown>;reused:boolean};
export type ToolAdapter={
  validate(spec:unknown):ToolSpec;
  test(spec:ToolSpec,signal?:AbortSignal):Promise<{ok:boolean;message:string}>;
  invoke(spec:ToolSpec,input:Record<string,unknown>,signal?:AbortSignal):Promise<Record<string,unknown>>;
};
export type ComponentManifest={id:ComponentSpec['type'];version:1;description:string;tags:string[];variants:ComponentSpec['variant'][];bindings:string[];actions:string[];status:'available'|'planned';deviceLocal?:boolean;category?:string;configKeys?:readonly string[];defaultColumns?:number};
export const COMPONENT_MANIFESTS:ComponentManifest[]=[
  {id:'form',version:1,description:'Collect typed records with field validation',tags:['input','collection'],variants:['default','compact'],bindings:['fields'],actions:['record.create'],status:'available'},
  {id:'cards',version:1,description:'Reusable collection with typographic covers, sorting and emphasis',tags:['collection','books','ideas','projects'],variants:['cover','compact','hero','default'],bindings:['fields','sort','emphasis'],actions:['record.update','record.delete'],status:'available'},
  {id:'list',version:1,description:'Compact actionable record collection',tags:['tasks','habits','collection'],variants:['dense','comfortable','default'],bindings:['fields','sort'],actions:['record.update','record.checkin','record.delete'],status:'available'},
  {id:'counter',version:1,description:'Record count or numeric total',tags:['summary','metrics'],variants:['default'],bindings:['valueField'],actions:[],status:'available'},
  {id:'progress',version:1,description:'Numeric progress across records',tags:['reading','goals','metrics'],variants:['default'],bindings:['valueField'],actions:['record.update'],status:'available'},
  {id:'calendar-grid',version:1,description:'Date history and completion calendar',tags:['time','habits','attendance'],variants:['default','compact'],bindings:['dateField'],actions:['record.checkin'],status:'available'},
  {id:'streak',version:1,description:'Consecutive completion days',tags:['habits','time'],variants:['default'],bindings:['dateField'],actions:[],status:'available'},
  {id:'chart',version:1,description:'Distribution by category',tags:['analytics','votes','summary'],variants:['default'],bindings:['groupBy','valueField'],actions:[],status:'available'},
  {id:'kanban',version:1,description:'Records grouped by a workflow field',tags:['projects','reading','tasks'],variants:['default','compact'],bindings:['groupBy','fields'],actions:['record.update'],status:'available'},
  {id:'detail',version:1,description:'Focused record details',tags:['focus','collection'],variants:['default','hero'],bindings:['fields'],actions:['record.update'],status:'available'},
  {id:'tool-result',version:1,description:'Result of an enabled, versioned read-only tool',tags:['external','query'],variants:['default'],bindings:['toolRef'],actions:['tool.invoke'],status:'available'},
  {id:'camera',version:1,description:'Explicit local camera session; requires separately configured media service',tags:['device','vision'],variants:['default'],bindings:[],actions:[],status:'available',deviceLocal:true},
  {id:'generated-site',version:1,description:'An independently generated website with custom HTML, CSS and JavaScript in an isolated browser frame',tags:['generated','custom','interactive'],variants:['default'],bindings:['fields','toolBindings'],actions:['record.create','record.update','record.delete','record.checkin','tool.invoke'],status:'available',defaultColumns:12},
  ...EXTENDED_MODULES.map(m=>({...m,version:1 as const,variants:['default'] as ComponentSpec['variant'][],bindings:[...m.bindings],actions:[...m.actions],tags:[m.category.toLowerCase()],status:'available' as const})),
];

export function validateDefinition(input:unknown):Definition {
  const d=definitionSchema.parse(input);
  const generated=d.appSpec.components.filter(c=>c.type==='generated-site');
  if(generated.length>1||Boolean(generated.length)!==Boolean(d.appSpec.generated))throw new Error('Generated sites require exactly one source artifact and one generated surface');
  const fields=new Map(d.entitySchema.fields.map(f=>[f.id,f]));
  const actions=new Map(d.appSpec.actions.map(a=>[a.id,a]));
  if(fields.size!==d.entitySchema.fields.length||actions.size!==d.appSpec.actions.length||new Set(d.appSpec.components.map(c=>c.id)).size!==d.appSpec.components.length)throw new Error('Duplicate stable ID');
  for(const f of fields.values()){
    if(f.type==='enum'&&(!f.options?.length||new Set(f.options).size!==f.options.length))throw new Error('Enum options required and unique');
    if(f.min!==undefined&&f.max!==undefined&&f.min>f.max)throw new Error('Invalid field bounds');
    if(f.defaultValue!==undefined)validateValues({schemaVersion:1,name:'default',fields:[f]},{[f.id]:f.defaultValue});
  }
  for(const c of d.appSpec.components){
    const m=COMPONENT_MANIFESTS.find(m=>m.id===c.type&&m.version===c.version);
    if(!m||m.status!=='available'||!m.variants.includes(c.variant))throw new Error('Unsupported component or variant');
    const allowedConfig=new Set(['showHeader','density',...(m.configKeys??['limit'])]);
    if(Object.keys(c.config??{}).some(key=>!allowedConfig.has(key)))throw new Error('Unsupported module configuration');
    for(const f of [...c.fields,c.groupBy,c.dateField,c.valueField,c.sort?.field,c.emphasis?.field].filter(Boolean))if(!fields.has(f!))throw new Error('Unknown field binding');
    for(const a of c.actionIds){
      if(!actions.has(a))throw new Error('Unknown action binding');
      if(!m.actions.includes(actions.get(a)!.type))throw new Error('Action unsupported by component');
    }
    if(c.dateField&&!['date','dates'].includes(fields.get(c.dateField)!.type))throw new Error('Calendar requires date field');
    if(c.groupBy&&fields.get(c.groupBy)!.type!=='enum')throw new Error('Grouping requires enum field');
    if(c.valueField&&['counter','progress','chart','metric-grid','line-chart','donut-chart','histogram','leaderboard','rating-input','number-stepper','range-input','goal-meter','inventory-levels','expense-calendar','recipe-scaler'].includes(c.type)&&fields.get(c.valueField)!.type!=='number')throw new Error('Numeric summaries require a number field');
    if(c.type==='tool-result'&&!c.toolRef)throw new Error('Tool results require a registered tool reference');
    if(c.toolRef&&c.type!=='tool-result')throw new Error('Only tool results can bind a tool');
    if(c.toolBindings){
      if(c.type!=='generated-site')throw new Error('Only generated sites can bind multiple tools');
      if(new Set(c.toolBindings.map(b=>b.actionId)).size!==c.toolBindings.length||new Set(c.toolBindings.map(b=>`${b.toolId}:${b.toolVersion}`)).size!==c.toolBindings.length)throw new Error('Tool bindings must be unique');
      for(const binding of c.toolBindings){const bound=actions.get(binding.actionId);if(!c.actionIds.includes(binding.actionId)||bound?.type!=='tool.invoke')throw new Error(`Each tool binding requires a bound tool invocation action. actionId ${JSON.stringify(binding.actionId)} requires an included action with type tool.invoke; found ${bound?.type??'no matching action'}. Add a separate tool.invoke action for the tool and keep record.create for saving records.`);}
    }
    if(c.type==='generated-site')for(const actionId of c.actionIds)if(actions.get(actionId)?.type==='tool.invoke'&&!c.toolBindings?.some(b=>b.actionId===actionId))throw new Error('Generated tool actions require exact version bindings');
  }
  for(const a of actions.values()){
    if(a.fieldId&&!fields.has(a.fieldId))throw new Error('Unknown action field');
    if(a.type==='record.checkin'&&(!a.fieldId||fields.get(a.fieldId)?.type!=='dates'))throw new Error('Check-in requires dates field');
  }
  return d;
}

export function validateEvolution(previous:Definition|null,next:Definition):Definition {
  validateDefinition(next);
  if(next.definitionVersion!==(previous?.definitionVersion??0)+1)throw new Error('Definition version conflict');
  if(previous)for(const old of previous.entitySchema.fields){
    const current=next.entitySchema.fields.find(f=>f.id===old.id);
    if(!current||current.type!==old.type)throw new Error('Destructive field changes are not supported');
    if(old.type==='enum'&&old.options?.some(v=>!current.options?.includes(v)))throw new Error('Existing enum values must be preserved');
    if(old.public!==current.public)throw new Error('Field visibility cannot be changed by a proposal');
    if(!old.required&&current.required)throw new Error('Existing optional fields cannot become required');
    if(current.min!==old.min||current.max!==old.max)throw new Error('Existing field bounds cannot change');
  }
  if(previous)for(const f of next.entitySchema.fields)if(!previous.entitySchema.fields.some(old=>old.id===f.id)&&f.required&&f.defaultValue===undefined)throw new Error('New required fields need a valid default');
  return next;
}

export function validateValues(schema:EntitySchema,values:Record<string,unknown>,partial=false):Record<string,FieldValue>{
  const result:Record<string,FieldValue>={};
  for(const key of Object.keys(values))if(!schema.fields.some(f=>f.id===key))throw new Error('Unknown record field');
  for(const f of schema.fields){
    const value=values[f.id]??(partial?undefined:f.defaultValue);
    if(value===undefined||value===null||value==='') {if(f.required&&(!partial||Object.prototype.hasOwnProperty.call(values,f.id)))throw new Error(`${f.label} is required`);if(value!==undefined)result[f.id]=value as FieldValue;continue;}
    let valid=false;
    if(f.type==='text')valid=typeof value==='string'&&value.length<=10000;
    if(f.type==='enum')valid=typeof value==='string'&&!!f.options?.includes(value);
    if(f.type==='number')valid=typeof value==='number'&&Number.isFinite(value)&&(f.min===undefined||value>=f.min)&&(f.max===undefined||value<=f.max);
    if(f.type==='boolean')valid=typeof value==='boolean';
    const isDate=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
    if(f.type==='date')valid=isDate(value);
    if(f.type==='dates')valid=Array.isArray(value)&&value.length<=366&&value.every(isDate);
    if(!valid)throw new Error(`Invalid value for ${f.label}`);
    result[f.id]=value as FieldValue;
  }
  return result;
}

export * from './examples';

/** Server-owned quota reservation, shared across replicas and restarts. */
export interface ProviderBudgetStore {
  reserve(input: { provider: 'gemini'; day: string; now: number; dailyLimit: number; minuteLimit: number }): Promise<void>;
}

// Media belongs to one explicitly started device session, never a business snapshot.
export const MEDIA_LIMITS = {
  maxAudioBytes: 2_000_000, maxImageBytes: 400_000, maxRecordingSeconds: 20,
  maxSessionSeconds: 300, minimumFrameIntervalMs: 15_000, maxFramesPerSession: 8,
} as const;
export type MediaCapabilities = { canTranscribe: boolean; canObserve: boolean; canSpeak: boolean; limits: typeof MEDIA_LIMITS };
export type MediaSession = { id: string; kind: 'voice' | 'scene'; expiresAt: string; limits: typeof MEDIA_LIMITS };
export type MediaTranscript = { sequence: number; text: string; durationMs: number };
export type MediaObservation = {
  sequence: number; capturedAt: string; text: string; visionMs: number; speechMs: number;
  audioBase64?: string; audioMimeType?: 'audio/mpeg'; speechError?: string;
};
export interface MediaAdapter {
  capabilities(): Omit<MediaCapabilities, 'limits'>;
  transcribe(input: { audio: Uint8Array; mimeType: string; signal: AbortSignal }): Promise<{ text: string; durationMs: number }>;
  describe(input: { image: Uint8Array; mimeType: 'image/jpeg'; signal: AbortSignal }): Promise<{ text: string; durationMs: number }>;
  speak(input: { text: string; signal: AbortSignal }): Promise<{ audio: Uint8Array; mimeType: 'audio/mpeg'; durationMs: number }>;
}

export interface MediaBudgetStore {
  reserve(input: {
    bucket: 'elevenlabs-stt-seconds' | 'elevenlabs-tts-characters';
    period: string; units: number; limit: number; minuteRequestLimit: number; now: number;
  }): Promise<void>;
}

export {GENERATED_BRIDGE_LIMITS} from './generated';
