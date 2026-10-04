import { COMPONENT_MANIFESTS, proposalSchema, validateEvolution, type ComponentSpec, type Definition, type EntityField, type Proposal } from '@livingforma/contracts';

import { addRequestedModules, requestedModules } from './module-composer';

// Small, explicit offline rules are a fallback. Component assembly is shared across domains.
const domains = [
  {match:/book|read|书|阅读/i,name:'Book',title:'Between the lines',description:'Books, ideas, and your next chapter.',skin:'linen',fields:[{id:'author',label:'Author',type:'text'},{id:'status',label:'Reading status',type:'enum',options:['To read','Reading','Finished'],defaultValue:'To read'},{id:'progress',label:'Progress',type:'number',min:0,max:100,defaultValue:0}],tags:['books','reading'],primary:'cards'},
  {match:/habit|ritual|check.?in|习惯|打卡/i,name:'Habit',title:'Little by little',description:'Small intentions, steady progress.',skin:'sage',fields:[{id:'category',label:'Category',type:'enum',options:['Wellbeing','Learning','Everyday'],defaultValue:'Everyday'},{id:'target',label:'Weekly goal',type:'number',min:1,max:7,defaultValue:5},{id:'dates',label:'Completed dates',type:'dates',defaultValue:[]}],tags:['habits','time'],primary:'list'},
  {match:/task|project|todo|任务|项目/i,name:'Task',title:'Make room for progress',description:'A clear view of what matters next.',skin:'sand',fields:[{id:'status',label:'Status',type:'enum',options:['Planned','In progress','Done'],defaultValue:'Planned'},{id:'due',label:'Due date',type:'date'},{id:'priority',label:'Priority',type:'number',min:1,max:5,defaultValue:3}],tags:['tasks','projects'],primary:'kanban'},
  {match:/budget|expense|spending|费用|预算/i,name:'Expense',title:'Everyday balance',description:'Keep a thoughtful record of your spending.',skin:'clay',fields:[{id:'amount',label:'Amount',type:'number',min:0,defaultValue:0},{id:'category',label:'Category',type:'enum',options:['Essentials','Experiences','Other'],defaultValue:'Other'},{id:'date',label:'Date',type:'date'}],tags:['analytics','metrics'],primary:'list'},
  {match:/idea|collection|recipe|灵感|收藏/i,name:'Item',title:'Room for ideas',description:'Collect the things worth keeping.',skin:'rose',fields:[{id:'category',label:'Category',type:'enum',options:['New','Exploring','Saved'],defaultValue:'New'},{id:'notes',label:'Notes',type:'text'}],tags:['ideas','collection'],primary:'cards'},
] as const;
const component = (type:ComponentSpec['type'],extra:Partial<ComponentSpec>={}):ComponentSpec => ({id:type,version:1,type,variant:'default',fields:[],actionIds:[],span:'full',...extra});

export function assertProposal(value:unknown,current:Definition|null,source:Proposal['source']):Proposal {
  const proposal=proposalSchema.parse({...value as object,source});
  // Canonicalize only unambiguous binding omissions, never incorrect references or field types.
  const dates=proposal.entitySchema.fields.filter(f=>f.type==='dates');
  if(dates.length===1)for(const action of proposal.appSpec.actions)if(action.type==='record.checkin'&&!action.fieldId)action.fieldId=dates[0].id;
  const dateFields=proposal.entitySchema.fields.filter(f=>f.type==='dates'||f.type==='date');
  if(dateFields.length===1)for(const component of proposal.appSpec.components)if(['calendar-grid','streak'].includes(component.type)&&!component.dateField)component.dateField=dateFields[0].id;
  validateEvolution(current,{entitySchema:proposal.entitySchema,appSpec:proposal.appSpec,summary:proposal.summary,definitionVersion:(current?.definitionVersion??0)+1});
  return proposal;
}

export function localProposal(prompt:string,current:Definition|null):Proposal {
  const gaps:string[]=[];
  const domain=domains.find(d=>d.match.test(prompt));
  let p:Proposal;
  if(current) p=structuredClone({...current,source:'local-rules' as const,capabilityGaps:[]});
  else {
    const d=domain??domains[4];
    const fields:EntityField[]=[{id:'title',label:d.name==='Habit'?'Habit name':'Title',type:'text',required:true,public:true},...d.fields.map(f=>({...structuredClone(f),required:false,public:true}) as EntityField)];
    const date=fields.find(f=>f.type==='dates'),group=fields.find(f=>f.type==='enum'),number=fields.find(f=>f.type==='number');
    const actions:Proposal['appSpec']['actions']=[{id:'add',type:'record.create',label:`Add ${d.name.toLowerCase()}`},{id:'edit',type:'record.update',label:'Edit record'},{id:'remove',type:'record.delete',label:'Delete record'}];
    if(date)actions.push({id:'checkin',type:'record.checkin',label:'Check in today',fieldId:date.id});
    const primary=component(d.primary,{id:'collection',span:'main',title:`Your ${d.name.toLowerCase()}${d.name==='Expense'?'s':'s'}`,fields:fields.map(f=>f.id),actionIds:date?['edit','remove','checkin']:d.primary==='kanban'?['edit']:['edit','remove'],...(d.primary==='cards'?{variant:'cover' as const}:{}),...(d.primary==='kanban'&&group?{groupBy:group.id}:{})});
    const components=[primary,component('counter',{title:`${d.name}s collected`,span:'side'})];
    // Select compatible summaries using manifest tags and available bindings, rather than app templates.
    for(const manifest of COMPONENT_MANIFESTS.filter(m=>m.status==='available'&&m.tags.some(tag=>(d.tags as readonly string[]).includes(tag)))){
      if(manifest.id==='calendar-grid'&&date)components.push(component(manifest.id,{title:'A rhythm taking shape',dateField:date.id,span:'main'}));
      if(manifest.id==='streak'&&date)components.push(component(manifest.id,{title:'Keep the rhythm',dateField:date.id,span:'side'}));
      if(manifest.id==='progress'&&number&&number.id==='progress')components.push(component(manifest.id,{title:'A little further',valueField:number.id,span:'side'}));
      if(manifest.id==='chart'&&group&&d.name==='Expense')components.push(component(manifest.id,{title:'Where it goes',groupBy:group.id,valueField:number?.id,span:'side'}));
    }
    components.push(component('form',{title:'Make a little space',fields:fields.filter(f=>f.type!=='dates').map(f=>f.id),actionIds:['add'],span:'side'}));
    p={entitySchema:{schemaVersion:1,name:d.name,fields},appSpec:{specVersion:1,title:d.title,description:d.description,skin:d.skin,layout:date?'dashboard':d.primary==='cards'?'gallery':'split',actions,components},summary:'Created a reusable component composition.',source:'local-rules',capabilityGaps:[]};
    if(!domain&&!requestedModules(prompt).length)gaps.push('Local mode supports collection, reading, habit, task, and expense composition. Use the configured AI planner for other requests.');
  }
  const fields=p.entitySchema.fields;
  if(/rating|评分/i.test(prompt)){
    if(!fields.some(f=>f.id==='rating'))fields.push({id:'rating',label:'Rating',type:'number',required:false,public:true,min:0,max:5,defaultValue:0});
    for(const c of p.appSpec.components.filter(c=>['cards','list','form','kanban','detail'].includes(c.type)))if(!c.fields.includes('rating'))c.fields.push('rating');
  }
  if(/sort|排序/i.test(prompt)){
    const sortField=fields.find(f=>new RegExp(f.id,'i').test(prompt))?.id??(fields.some(f=>f.id==='rating')?'rating':'title');
    for(const c of p.appSpec.components.filter(c=>['cards','list','kanban'].includes(c.type)))c.sort={field:/rating|评分/i.test(prompt)?'rating':sortField,direction:/ascending|a.to.z|升序/i.test(prompt)?'asc':'desc'};
  }
  if(/highlight|emphasi|突出|强调/i.test(prompt)&&fields.some(f=>f.id==='status'&&f.options?.includes('Reading')))for(const c of p.appSpec.components.filter(c=>c.type==='cards'))c.emphasis={field:'status',equals:'Reading',style:'highlight'};
  const desiredType=requestedModules(prompt).length?null:/kanban|board|看板/i.test(prompt)?'kanban':/compact list|as a list|列表/i.test(prompt)?'list':/cards|gallery|卡片/i.test(prompt)?'cards':null;
  if(desiredType){const c=p.appSpec.components.find(c=>['cards','list','kanban','detail'].includes(c.type));const group=fields.find(f=>f.type==='enum');if(c&&(desiredType!=='kanban'||group)){c.type=desiredType;c.variant=desiredType==='cards'?'cover':'default';delete c.groupBy;if(desiredType==='kanban')c.groupBy=group!.id;const allowed=COMPONENT_MANIFESTS.find(m=>m.id===desiredType)!;c.actionIds=c.actionIds.filter(id=>allowed.actions.includes(p.appSpec.actions.find(a=>a.id===id)!.type));p.appSpec.layout=desiredType==='cards'?'gallery':'split';}else gaps.push('A board requires an enum workflow field.');}
  const skin=(['linen','sage','ink','clay','sand','rose'] as const).find(s=>new RegExp(`\\b${s}\\b`,'i').test(prompt));if(skin)p.appSpec.skin=skin;
  if(/compact|dense|紧凑/i.test(prompt))for(const c of p.appSpec.components){const m=COMPONENT_MANIFESTS.find(m=>m.id===c.type)!;if(m.variants.includes('compact'))c.variant='compact';else if(m.variants.includes('dense'))c.variant='dense';}
  if(/camera|相机/i.test(prompt)){
    if(COMPONENT_MANIFESTS.find(m=>m.id==='camera')?.status==='available'){
      if(!p.appSpec.components.some(c=>c.type==='camera')){
        let id='scene-camera',suffix=1;while(p.appSpec.components.some(c=>c.id===id))id=`scene-camera-${suffix++}`;
        p.appSpec.components.push(component('camera',{id,title:'Around you',span:'full'}));
      }
    }else gaps.push('Camera observation is not yet available in the registered component catalog.');
  }
  addRequestedModules(p,prompt,gaps);
  if(/voice|video|payment|email|weather|map|语音|支付|邮件/i.test(prompt))gaps.push('This request needs a capability that is not yet available in the registered text-planning catalog.');
  if(/search.*book|book.*search|open.?library|查.*书/i.test(prompt))gaps.push('Open Library search requires a tool proposal, validation, and explicit Owner enablement before use.');
  if(/delete.*field|remove.*field|删除.*字段/i.test(prompt))gaps.push('Removing fields is destructive and is not supported by safe evolution.');
  if(current&&gaps.length===0&&JSON.stringify(p.entitySchema)===JSON.stringify(current.entitySchema)&&JSON.stringify(p.appSpec)===JSON.stringify(current.appSpec))gaps.push('Local mode could not apply this change. Try rating, sorting, a registered skin, cards, a list, or a board, or use the configured AI planner.');
  if(current){p.entitySchema.schemaVersion=current.entitySchema.schemaVersion+(JSON.stringify(fields)!==JSON.stringify(current.entitySchema.fields)?1:0);p.summary='Updated the composition while preserving existing fields, records, and URL.';}
  p.capabilityGaps=gaps;delete (p as Partial<Definition>).definitionVersion;
  return assertProposal(p,current,'local-rules');
}
