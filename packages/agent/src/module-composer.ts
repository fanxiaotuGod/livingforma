import {COMPONENT_MANIFESTS, EXTENDED_MODULES, type ComponentSpec, type EntityField, type Proposal} from '@livingforma/contracts';

const aliases:Partial<Record<ComponentSpec['type'],RegExp>>={
  flashcards:/flash\s*cards?|记忆卡|闪卡/i,quiz:/\bquiz\b|测验/i,pomodoro:/pomodoro|番茄钟/i,
  stopwatch:/stopwatch|秒表/i,'breathing-guide':/breathing|呼吸/i,'unit-converter':/unit conversion|单位换算/i,
  'search-panel':/search panel|搜索面板/i,'filter-panel':/filter panel|筛选面板/i,'recipe-scaler':/recipe scal|食谱缩放/i,
};
export function requestedModules(prompt:string) {
  return EXTENDED_MODULES.filter(m=>new RegExp(`\\b${m.id.replaceAll('-','[- ]')}\\b`,'i').test(prompt)||aliases[m.id]?.test(prompt));
}

/** Offline composition adds individual capabilities, never whole application templates. */
export function addRequestedModules(p:Proposal,prompt:string,gaps:string[]) {
  for(const requested of requestedModules(prompt)) {
    let c=p.appSpec.components.find(item=>item.type===requested.id);
    if(!c&&p.appSpec.components.length>=24){if(!gaps.some(g=>g.includes('24 modules')))gaps.push('A page supports up to 24 modules. Remove a module before adding more.');continue;}
    if(!c){
      const schema=p.entitySchema.fields;
      const findOrAdd=(type:EntityField['type'],name:string,label:string,index=0):EntityField=>{
        const existing=schema.filter(f=>f.type===type)[index];if(existing)return existing;
        let id=name,n=2;while(schema.some(f=>f.id===id))id=`${name}_${n++}`;
        const next:EntityField={id,label,type,required:false,public:true,...(type==='enum'?{options:['Planned','In progress','Done'],defaultValue:'Planned'}:type==='boolean'?{defaultValue:false}:type==='dates'?{defaultValue:[]}:{} )};schema.push(next);return next;
      };
      // A candidate can be rejected without leaving partially added schema behind.
      const previous=structuredClone(schema);
      const title=findOrAdd('text','title','Title');
      let id=requested.id as string,n=2;while(p.appSpec.components.some(item=>item.id===id))id=`${requested.id}-${n++}`;
      c={id,type:requested.id,version:1,variant:'default',title:requested.id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),fields:[],actionIds:[],span:'main',size:{columns:requested.defaultColumns}};
      const binding=requested.bindings as readonly string[];
      if(binding.includes('fields'))c.fields=[title.id];
      if(binding.includes('valueField'))c.valueField=findOrAdd('number','amount','Amount').id;
      if(binding.includes('groupBy'))c.groupBy=findOrAdd('enum','category','Category').id;
      if(binding.includes('dateField'))c.dateField=findOrAdd(requested.id==='habit-matrix'?'dates':'date','date','Date').id;
      if(['data-table','record-accordion','comparison-table','export-panel','quick-add'].includes(c.type))c.fields=schema.map(f=>f.id);
      if(['priority-matrix','scatter-plot','budget-breakdown','balance-sheet'].includes(c.type))c.fields=[title.id,findOrAdd('number','amount','Amount').id,findOrAdd('number','comparison','Comparison',1).id];
      if(['flashcards','quiz','text-editor','text-reader','word-counter','markdown-viewer','link-directory'].includes(c.type))c.fields=[title.id,findOrAdd('text',c.type==='link-directory'?'url':'notes',c.type==='link-directory'?'Web address':'Notes',1).id];
      if(['checklist','toggle-panel','milestone-stepper'].includes(c.type))c.fields=[title.id,findOrAdd('boolean','completed','Completed').id];
      if(c.type==='filter-panel')c.fields=[c.groupBy!,...schema.filter(f=>f.type==='boolean').map(f=>f.id)];
      if(c.type==='search-panel')c.fields=schema.map(f=>f.id);
      if(c.type==='habit-matrix'){
        if(!p.appSpec.actions.some(a=>a.type==='record.checkin')){let actionId='checkin',n=2;while(p.appSpec.actions.some(a=>a.id===actionId))actionId=`checkin${n++}`;p.appSpec.actions.push({id:actionId,type:'record.checkin',label:'Check in today',fieldId:c.dateField});}
      }
      c.actionIds=p.appSpec.actions.filter(action=>(requested.actions as readonly string[]).includes(action.type)).map(action=>action.id);
      if(schema.length>40){schema.splice(0,schema.length,...previous);gaps.push('This module needs new fields, but the schema already contains 40 fields.');continue;}
      if(c.type==='goal-meter'||c.type==='inventory-levels')c.config={target:100};
      if(c.type==='pomodoro')c.config={durationSeconds:1500};
      if(c.type==='breathing-guide')c.config={durationSeconds:12};
      if(c.type==='recipe-scaler')c.config={scale:1};
      p.appSpec.components.push(c);
    }
    applyPresentation(c,prompt);
  }
}

function applyPresentation(component:ComponentSpec,prompt:string) {
  const columns=prompt.match(/(?:\bwidth\s*|\b)(\d{1,2})\s*columns?\b/i)?.[1];
  const height=prompt.match(/(?:\bheight\s*|\b)(\d{3})\s*(?:px\s*(?:high|height)?|pixels?\s*high)\b/i)?.[1];
  if(columns&&Number(columns)>=3&&Number(columns)<=12)component.size={...component.size,columns:Number(columns)};
  if(height&&Number(height)>=120&&Number(height)<=960)component.size={columns:component.size?.columns??6,minHeight:Number(height)};
  const density=(['compact','comfortable','spacious'] as const).find(value=>new RegExp(`\\b${value}\\b`,'i').test(prompt));
  if(density)component.config={...component.config,density};
  const seconds=prompt.match(/\b(\d{1,4})\s*seconds?\b/i)?.[1],minutes=prompt.match(/\b(\d{1,3})\s*minutes?\b/i)?.[1],duration=seconds?Number(seconds):minutes?Number(minutes)*60:undefined;
  if(duration!==undefined&&duration>=4&&duration<=7200&&COMPONENT_MANIFESTS.find(m=>m.id===component.type)?.configKeys?.includes('durationSeconds'))component.config={...component.config,durationSeconds:duration};
}
