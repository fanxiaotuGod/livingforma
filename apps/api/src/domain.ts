import { createHash, randomUUID } from 'node:crypto';
import { validateEvolution, validateValues, type Definition, type Mutation, type Proposal, type Snapshot, type User } from '@livingforma/contracts';
import type { SpaceState, Store, SqlConnection } from '@livingforma/db';

export class ApiProblem extends Error{constructor(public statusCode:number,public code:string,message:string){super(message);}}
export function fail(status:number,code:string,message:string):never{throw new ApiProblem(status,code,message);}
export function roleFor(state:SpaceState,user:User|null):Snapshot['role']{return state.ownerId===user?.id?'owner':user&&(state.space.participation==='authenticated'||state.members.includes(user.id))?'participant':'visitor';}
export function assertRead(state:SpaceState,user:User|null){if(state.space.visibility==='private'&&state.ownerId!==user?.id&&!state.members.includes(user?.id??''))fail(404,'SPACE_NOT_FOUND','This space does not exist or is not accessible.');}
export function requireOwner(state:SpaceState,user:User){assertRead(state,user);if(state.ownerId!==user.id)fail(403,'OWNER_REQUIRED','Only the space owner can change this app.');}
export function projection(state:SpaceState,user:User|null):Snapshot{
  assertRead(state,user);const role=roleFor(state,user);const owner=role==='owner';
  let definition=state.definition?structuredClone(state.definition):null;
  const visible=new Set(state.definition?.entitySchema.fields.filter(field=>owner||field.public).map(field=>field.id));
  if(definition&&!owner){
    definition.entitySchema.fields=definition.entitySchema.fields.filter(field=>visible.has(field.id));
    definition.summary='The app has been updated.';
    const privateRequired=state.definition!.entitySchema.fields.some(field=>!field.public&&field.required&&field.defaultValue===undefined);
    definition.appSpec.actions=definition.appSpec.actions.filter(action=>action.type!=='tool.invoke'&&(!action.fieldId||visible.has(action.fieldId))&&!(privateRequired&&action.type==='record.create'));
    const actions=new Set(definition.appSpec.actions.map(action=>action.id));
    definition.appSpec.components=definition.appSpec.components.filter(component=>component.type!=='tool-result').map(component=>{
      component.fields=component.fields.filter(id=>visible.has(id));component.actionIds=component.actionIds.filter(id=>actions.has(id));
      if(component.groupBy&&!visible.has(component.groupBy))delete component.groupBy;
      if(component.dateField&&!visible.has(component.dateField))delete component.dateField;
      if(component.valueField&&!visible.has(component.valueField))delete component.valueField;
      if(component.sort&&!visible.has(component.sort.field))delete component.sort;
      if(component.emphasis&&!visible.has(component.emphasis.field))delete component.emphasis;
      return component;
    }).filter(component=>!(['cards','list','detail','form'].includes(component.type)&&!component.fields.length)&&!(['calendar-grid','streak'].includes(component.type)&&!component.dateField)&&!(component.type==='kanban'&&!component.groupBy)&&!(component.type==='progress'&&!component.valueField));
  }
  // An owner definition can legitimately contain no public fields or visible components.
  // Represent that audience's empty view with the existing null-definition contract.
  if(!owner&&definition&&(!definition.entitySchema.fields.length||!definition.appSpec.components.length))definition=null;
  const canWrite=!!definition&&!!user&&(owner||role==='participant');
  const actionIds=canWrite?(definition?.appSpec.actions.filter(action=>owner||action.type!=='tool.invoke').map(action=>action.id)??[]):[];
  // Anonymous components retain action bindings as login affordances; no action is executable.
  return {space:state.space,phase:definition?'ready':'unconfigured',definition,records:definition?state.records.map(record=>({...record,values:Object.fromEntries(Object.entries(record.values).filter(([key])=>visible.has(key)))})):[],stateVersion:state.stateVersion,eventCursor:state.eventCursor,role,permissions:{canEdit:owner,canWrite,canUseTools:owner,actionIds},loginRequiredForWrite:!!definition&&!user&&state.space.participation==='authenticated'};
}
function stable(value:unknown):string{if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>`${JSON.stringify(key)}:${stable(v)}`).join(',')}}`;return JSON.stringify(value);}
export const fingerprint=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex');
export async function replay(store:Store,tx:SqlConnection,state:SpaceState,user:User,requestId:string,payload:unknown){const old=await store.request(tx,state.space.id,user.id,requestId);if(old&&old.fingerprint!==fingerprint(payload))fail(409,'REQUEST_ID_CONFLICT','This request ID has already been used for a different action.');return old;}
export function timezoneDay(timezone:string,now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-');}
export function applyMutation(state:SpaceState,user:User,mutation:Mutation){
  const snapshot=projection(state,user);if(!snapshot.permissions.canWrite)fail(403,'WRITE_FORBIDDEN','You cannot write to this space.');
  const definition=state.definition;if(!definition)fail(409,'SPACE_UNCONFIGURED','Create your app before adding records.');
  if(mutation.definitionVersion!==definition.definitionVersion)fail(409,'DEFINITION_CONFLICT','This app has changed. Refresh before trying again.');
  const action=definition.appSpec.actions.find(action=>action.id===mutation.actionId);
  if(!action||!snapshot.permissions.actionIds.includes(action.id)||action.type==='tool.invoke')fail(403,'ACTION_FORBIDDEN','This action is not allowed.');
  if(snapshot.role!=='owner'&&Object.keys(mutation.values).some(key=>!definition.entitySchema.fields.find(field=>field.id===key)?.public))fail(403,'PRIVATE_FIELD','You cannot change private fields.');
  const now=new Date().toISOString();
  if(action.type==='record.create'){
    if(state.records.length>=2000)fail(422,'RECORD_LIMIT','This space can hold up to 2000 records.');
    if(mutation.recordId||mutation.recordVersion)fail(422,'INVALID_ACTION','Creating a record cannot reference an existing record version.');
    const values=validateValues(definition.entitySchema,mutation.values);
    state.records.push({id:`rec_${randomUUID()}`,values,version:1,createdAt:now,updatedAt:now});
  }else{
    const record=state.records.find(record=>record.id===mutation.recordId);if(!record)fail(404,'RECORD_NOT_FOUND','This record does not exist.');
    if(mutation.recordVersion!==record.version)fail(409,'RECORD_CONFLICT','This record has changed. Refresh before trying again.');
    if(action.type==='record.delete')state.records=state.records.filter(row=>row.id!==record.id);
    else if(action.type==='record.update'){const values=validateValues(definition.entitySchema,mutation.values,true);record.values={...record.values,...values};record.version++;record.updatedAt=now;}
    else if(action.type==='record.checkin'){
      if(Object.keys(mutation.values).length)fail(422,'INVALID_ACTION','The server determines the check-in date using the space timezone.');
      const field=definition.entitySchema.fields.find(field=>field.id===action.fieldId);if(field?.type!=='dates')fail(422,'INVALID_ACTION','Check-in requires a dates field.');
      const day=timezoneDay(state.space.timezone);const dates=(record.values[field.id]??[]) as string[];
      record.values[field.id]=dates.includes(day)?dates.filter(date=>date!==day):[...dates,day].sort().slice(-366);record.version++;record.updatedAt=now;
    }
  }
  state.stateVersion++;
}
export function applyProposal(state:SpaceState,proposal:Proposal):Definition{
  const next=validateEvolution(state.definition,{definitionVersion:(state.definition?.definitionVersion??0)+1,entitySchema:proposal.entitySchema,appSpec:proposal.appSpec,summary:proposal.summary});
  // Validate every retained record with the new schema before committing either definitions or defaults.
  let changed=false;
  for(const record of state.records){const values=validateValues(next.entitySchema,record.values);if(fingerprint(values)!==fingerprint(record.values)){record.values=values;record.version++;record.updatedAt=new Date().toISOString();changed=true;}}
  state.definition=next;state.space.title=next.appSpec.title;if(changed)state.stateVersion++;return next;
}
