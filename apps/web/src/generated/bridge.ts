import {idSchema,valueSchema,jsonObjectSchema,type ComponentSpec,type Mutation,type Snapshot} from '@livingforma/contracts';
const methods=['ready','create','update','remove','checkIn','pickImage','image','reportReady','reportError','runTool'] as const;
export type BridgeMethod=typeof methods[number];
export type BridgeRequest={id:string;method:BridgeMethod;params:Record<string,unknown>};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
export function parseBridgeRequest(input:unknown):BridgeRequest{
  if(!object(input)||Object.keys(input).sort().join(',')!=='id,method,params'||JSON.stringify(input).length>65536)throw new Error('Invalid website request.');
  if(typeof input.id!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(input.id)||typeof input.method!=='string'||!methods.includes(input.method as BridgeMethod)||!object(input.params))throw new Error('Invalid website request.');
  const method=input.method as BridgeMethod,params=input.params;
  const keys:Record<BridgeMethod,string[]>={ready:[],create:['values'],update:['recordId','values'],remove:['recordId'],checkIn:['recordId','fieldId'],pickImage:[],image:['assetId'],reportReady:[],reportError:['message'],runTool:['toolId','toolVersion','input']};
  if(Object.keys(params).sort().join(',')!==keys[method].sort().join(','))throw new Error('Unexpected request parameters.');
  if('recordId'in params&&(typeof params.recordId!=='string'||!params.recordId.length||params.recordId.length>100))throw new Error('Invalid record.');
  if(method==='runTool'){idSchema.parse(params.toolId);if(!Number.isSafeInteger(params.toolVersion)||Number(params.toolVersion)<1)throw new Error('Invalid tool version.');jsonObjectSchema.parse(params.input);}
  if('fieldId'in params)idSchema.parse(params.fieldId);
  if('values'in params){if(!object(params.values)||Object.keys(params.values).length>40)throw new Error('Invalid field values.');for(const [key,value]of Object.entries(params.values)){idSchema.parse(key);valueSchema.parse(value)}}
  if('assetId'in params&&(typeof params.assetId!=='string'||!/^asset_[a-zA-Z0-9_-]{1,80}$/.test(params.assetId)))throw new Error('Invalid image reference.');
  if('message'in params&&(typeof params.message!=='string'||params.message.length>500))throw new Error('Invalid diagnostic.');
  return {id:input.id,method,params};
}
export function frameState(snapshot:Snapshot,spec:ComponentSpec,preview=false){
  const definition=snapshot.definition;
  const fields=(definition?.entitySchema.fields??[]).filter(field=>field.public&&spec.fields.includes(field.id));
  const ids=new Set(fields.map(field=>field.id));
  const bindings=definition?.appSpec.components.find(component=>component.id===spec.id&&component.type==='generated-site')?.toolBindings??[];
  const privateRequired=definition?.entitySchema.fields.some(field=>!field.public&&field.required&&field.defaultValue===undefined);
  const actions=(definition?.appSpec.actions??[]).filter(action=>spec.actionIds.includes(action.id)&&(action.type!=='tool.invoke'||bindings.some(binding=>binding.actionId===action.id))&&(!action.fieldId||ids.has(action.fieldId))&&!(privateRequired&&action.type==='record.create'));
  const allowed=new Set(actions.map(action=>action.id));
  return {
    records:snapshot.records.map(record=>({id:record.id,version:record.version,createdAt:record.createdAt,updatedAt:record.updatedAt,values:Object.fromEntries(Object.entries(record.values).filter(([key])=>ids.has(key)))})),
    toolBindings:bindings.filter(binding=>actions.some(action=>action.id===binding.actionId)).map(({actionId,toolId,toolVersion,kind})=>({actionId,toolId,toolVersion,kind})),
    schema:{schemaVersion:definition?.entitySchema.schemaVersion??1,name:definition?.entitySchema.name??'Records',fields},actions,role:snapshot.role,
    permissions:{canWrite:!preview&&snapshot.permissions.canWrite,canEdit:false,canUseTools:!preview&&snapshot.permissions.canUseTools&&bindings.some(binding=>snapshot.permissions.actionIds.includes(binding.actionId)),actionIds:preview?[]:snapshot.permissions.actionIds.filter(id=>allowed.has(id)&&(snapshot.permissions.canUseTools||!bindings.some(binding=>binding.actionId===id)))},preview,
  };
}
export function bridgeMutation(input:BridgeRequest,snapshot:Snapshot,spec:ComponentSpec):Omit<Mutation,'requestId'|'definitionVersion'>{
  const state=frameState(snapshot,spec);
  const types:Partial<Record<BridgeMethod,string>>={create:'record.create',update:'record.update',remove:'record.delete',checkIn:'record.checkin'};
  const action=state.actions.find(action=>action.type===types[input.method]&&state.permissions.actionIds.includes(action.id)&&(input.method!=='checkIn'||action.fieldId===input.params.fieldId));
  if(!state.permissions.canWrite||!action)throw new Error('This action is not available in this website.');
  const publicFields=new Set(state.schema.fields.map(field=>field.id));
  const values=(input.params.values??{}) as Mutation['values'];
  if(Object.keys(values).some(id=>!publicFields.has(id)))throw new Error('Only fields shared with this website can be changed.');
  const record=input.method==='create'?undefined:snapshot.records.find(record=>record.id===input.params.recordId);
  if(input.method!=='create'&&!record)throw new Error('This record is no longer available.');
  return {actionId:action.id,...(record?{recordId:record.id,recordVersion:record.version}:{}),values};
}

/** Resolve the endpoint from the current authoritative definition, never frame input. */
export function bridgeToolRequest(input:BridgeRequest,snapshot:Snapshot,spec:ComponentSpec){
  if(input.method!=='runTool'||!snapshot.definition)throw new Error('This tool request is unavailable.');
  if(!snapshot.permissions.canUseTools)throw new Error('Your account cannot use this tool.');
  const current=snapshot.definition.appSpec.components.find(component=>component.id===spec.id&&component.type==='generated-site');
  const matches=current?.toolBindings?.filter(binding=>binding.toolId===input.params.toolId&&binding.toolVersion===input.params.toolVersion)??[];
  if(matches.length!==1)throw new Error('This exact tool version is not connected to this website.');
  const binding=matches[0]!;
  if(!snapshot.permissions.canUseTools||!snapshot.permissions.actionIds.includes(binding.actionId)||!current?.actionIds.includes(binding.actionId)||!snapshot.definition.appSpec.actions.some(action=>action.id===binding.actionId&&action.type==='tool.invoke'))throw new Error('Your account cannot use this tool.');
  const params=jsonObjectSchema.parse(input.params.input),prefix=binding.kind==='generated'?'code-tools':'tools';
  return {path:`/api/spaces/${encodeURIComponent(snapshot.space.slug)}/${prefix}/${encodeURIComponent(binding.toolId)}/invoke`,body:{definitionVersion:snapshot.definition.definitionVersion,componentId:current.id,actionId:binding.actionId,toolVersion:binding.toolVersion,input:params},toolId:binding.toolId,toolVersion:binding.toolVersion};
}
