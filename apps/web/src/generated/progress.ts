import {generationOutlineSchema,generationStages,idSchema,type GenerationEvent,type GenerationJob,type GeneratedToolProgress} from '@livingforma/contracts';

/** Progress is a host checkpoint, never a clock-driven approximation. */
export function acceptGenerationEvent(job:GenerationJob,input:unknown):GenerationJob {
  if(['failed','cancelled','published'].includes(job.stage)||!input||typeof input!=='object')return job;
  const value=input as Record<string,unknown>,sequence=value.sequence,revision=value.sourceRevision;
  if(!Number.isInteger(sequence)||Number(sequence)<=(job.events.at(-1)?.sequence??0)||!Number.isInteger(revision)||Number(revision)<job.sourceRevision||typeof value.stage!=='string'||!generationStages.includes(value.stage as GenerationEvent['stage'])||typeof value.message!=='string'||value.message.length>500||typeof value.at!=='string')return job;
  const ui=generationOutlineSchema.safeParse(value.ui),event:GenerationEvent={sequence:Number(sequence),sourceRevision:Number(revision),stage:value.stage as GenerationEvent['stage'],message:value.message,at:value.at};
  if(ui.success)event.ui=ui.data;
  if(value.source&&typeof value.source==='object'){const source:NonNullable<GenerationEvent['source']>={};for(const key of ['html','css','js'] as const){const part=(value.source as Record<string,unknown>)[key];if(typeof part==='string'&&part.length<=(key==='css'?40000:60000))source[key]=part}event.source=source;}
  if(value.tool&&typeof value.tool==='object'){const tool=value.tool as Record<string,unknown>;if(idSchema.safeParse(tool.toolId).success&&typeof tool.name==='string'&&tool.name.length<=80&&['writing','testing','ready','failed'].includes(String(tool.phase)))event.tool={toolId:String(tool.toolId),name:tool.name,phase:tool.phase as GeneratedToolProgress['phase'],...(typeof tool.message==='string'?{message:tool.message.slice(0,500)}:{})};}
  return {...job,...(Number(revision)>job.sourceRevision?{proposal:undefined,toolReports:undefined}:{}),sourceRevision:Number(revision),stage:event.stage,updatedAt:event.at,events:[...job.events,event].slice(-96)};
}
export function latestOutline(job:GenerationJob|null){
  for(const event of [...job?.events??[]].reverse()){if(event.sourceRevision!==job?.sourceRevision)continue;const parsed=generationOutlineSchema.safeParse(event.ui);if(parsed.success)return {outline:parsed.data,sequence:event.sequence};}
  return null;
}
export function newerGeneration(previous:GenerationJob|null,next:GenerationJob){
  if(previous&&(previous.id!==next.id||previous.sourceRevision>next.sourceRevision||(previous.sourceRevision===next.sourceRevision&&(previous.events.at(-1)?.sequence??0)>(next.events.at(-1)?.sequence??0))))return previous;
  return next;
}
