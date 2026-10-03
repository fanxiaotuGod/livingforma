import { validateDefinition, type Definition, type DataRecord } from './index';

export function readingDefinition():Definition{return validateDefinition({
  definitionVersion:1,summary:'A quiet space for your next chapter.',
  entitySchema:{schemaVersion:1,name:'Book',fields:[
    {id:'title',label:'Title',type:'text',required:true},{id:'author',label:'Author',type:'text'},
    {id:'status',label:'Reading status',type:'enum',options:['To read','Reading','Finished'],defaultValue:'To read'},
    {id:'progress',label:'Progress',type:'number',min:0,max:100,defaultValue:0},
    {id:'notes',label:'Notes',type:'text'},
  ]},
  appSpec:{specVersion:1,title:'Between the lines',description:'A place for the books you love, the thoughts you keep, and your next chapter.',skin:'linen',layout:'gallery',
    actions:[{id:'add',type:'record.create',label:'Add a book'},{id:'edit',type:'record.update',label:'Update record'},{id:'remove',type:'record.delete',label:'Delete record'}],
    components:[{id:'books',type:'cards',version:1,title:'Your bookshelf',variant:'cover',fields:['title','author','status','progress','notes'],actionIds:['edit','remove'],span:'main',emphasis:{field:'status',equals:'Reading',style:'highlight'}},{id:'total',type:'counter',version:1,title:'Books collected',span:'side'},{id:'reading-progress',type:'progress',version:1,title:'A little further',valueField:'progress',span:'side'},{id:'add-book',type:'form',version:1,title:'Make room for your next read',fields:['title','author','status'],actionIds:['add'],span:'side'}]}
});}
export function habitDefinition():Definition{return validateDefinition({definitionVersion:1,summary:'Small steps, meaningful days.',entitySchema:{schemaVersion:1,name:'Habit',fields:[{id:'title',label:'Habit name',type:'text',required:true},{id:'category',label:'Category',type:'enum',options:['Wellbeing','Learning','Everyday'],defaultValue:'Everyday'},{id:'target',label:'Weekly goal',type:'number',min:1,max:7,defaultValue:5},{id:'dates',label:'Completed dates',type:'dates',defaultValue:[]}]},appSpec:{specVersion:1,title:'Little by little',description:'Small intentions. Steady progress. A little closer to the life you want.',skin:'sage',layout:'dashboard',actions:[{id:'add',type:'record.create',label:'Add a habit'},{id:'edit',type:'record.update',label:'Edit habit'},{id:'checkin',type:'record.checkin',label:'Check in today',fieldId:'dates'},{id:'remove',type:'record.delete',label:'Delete habit'}],components:[{id:'habits',type:'list',version:1,title:'Your daily rituals',variant:'comfortable',fields:['title','category','target','dates'],actionIds:['checkin','edit','remove'],span:'main'},{id:'calendar',type:'calendar-grid',version:1,title:'A rhythm taking shape',dateField:'dates',span:'main'},{id:'streak',type:'streak',version:1,title:'Keep the rhythm',dateField:'dates',span:'side'},{id:'total',type:'counter',version:1,title:'Growing habits',span:'side'},{id:'new-habit',type:'form',version:1,title:'Start something small',fields:['title','category','target'],actionIds:['add'],span:'side'}]}});}
export function exampleRecords(kind:'reading'|'habits'):DataRecord[]{
  const now=new Date().toISOString();
  const rows=kind==='reading'?[{title:'Siddhartha',author:'Hermann Hesse',status:'Reading',progress:64,notes:'Wisdom is something we find through experience.'},{title:'Invisible Cities',author:'Italo Calvino',status:'Reading',progress:32,notes:''},{title:'Atomic Habits',author:'James Clear',status:'Finished',progress:100,notes:'Every small action is a vote for the person you want to become.'},{title:'The Power of Now',author:'Eckhart Tolle',status:'To read',progress:0,notes:''}]:[{title:'Read for 20 minutes',category:'Learning',target:5,dates:[]},{title:'Take a walk outside',category:'Wellbeing',target:7,dates:[]},{title:'Write a few lines',category:'Everyday',target:5,dates:[]}];
  return rows.map((values,i)=>({id:`record-${kind}-${i+1}`,values,version:1,createdAt:now,updatedAt:now} as DataRecord));
}
