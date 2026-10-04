import {z} from 'zod';
import {parse} from 'acorn';
import type {Definition,Proposal,RegisteredTool} from './index';
import type {GeneratedToolManifest,GeneratedToolProgress,GeneratedToolTestReport} from './generated-tools';

export const generationOutlineSchema=z.object({version:z.literal(1),title:z.string().max(120).optional(),layout:z.enum(['flow','split','grid']),skin:z.enum(['linen','sage','ink','clay','sand','rose']).optional(),sections:z.array(z.object({id:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/),kind:z.enum(['hero','collection','form','metrics','chart','media','content']),label:z.string().max(80).optional(),columns:z.number().int().min(3).max(12).optional(),items:z.number().int().min(1).max(8).optional()}).strict()).min(1).max(24)}).strict().refine(value=>new Set(value.sections.map(section=>section.id)).size===value.sections.length,'Outline section IDs must be unique.');
export type GenerationOutline=z.infer<typeof generationOutlineSchema>;

/** Browser-only source. These strings are never imported or evaluated by the API. */
export const generatedArtifactSchema=z.object({
  format:z.literal('html-v1'),bridgeVersion:z.literal(1),
  html:z.string().min(1).max(60000),css:z.string().max(40000),js:z.string().max(60000),
  assetIds:z.array(z.string().regex(/^asset_[a-zA-Z0-9_-]{1,80}$/)).max(40).default([]),
}).strict();
export type GeneratedArtifact=z.infer<typeof generatedArtifactSchema>;
export const generationStages=['queued','planning','writing','validating','repairing','preview','checked','publishing','published','failed','cancelled'] as const;
export type GenerationStage=typeof generationStages[number];
export type GenerationEvent={sequence:number;stage:GenerationStage;message:string;at:string;sourceRevision:number;source?:Partial<Pick<GeneratedArtifact,'html'|'css'|'js'>>;ui?:GenerationOutline;tool?:GeneratedToolProgress};
export type GenerationJob={id:string;spaceId:string;slug:string;requestId:string;baseDefinitionVersion:number;sourceRevision:number;stage:GenerationStage;prompt:string;createdAt:string;updatedAt:string;events:GenerationEvent[];proposal?:Proposal;error?:string;repairCount:number;publishedVersion?:number;toolReports?:Array<{toolId:string;toolVersion:number;name:string;report:GeneratedToolTestReport}>};
export const generationRequestSchema=z.object({prompt:z.string().trim().min(1).max(4000),baseDefinitionVersion:z.number().int().nonnegative(),requestId:z.string().uuid()}).strict();
export const generationPreviewSchema=z.object({sourceRevision:z.number().int().positive(),ok:z.boolean(),errors:z.array(z.string().max(500)).max(8).default([])}).strict();
export const generationPublishSchema=z.object({sourceRevision:z.number().int().positive(),requestId:z.string().uuid()}).strict();
export type SiteGenerationProgress={stage:'planning'|'writing'|'validating'|'repairing';message:string;source?:Partial<Pick<GeneratedArtifact,'html'|'css'|'js'>>;ui?:GenerationOutline;tool?:GeneratedToolProgress};
export type SiteGenerator=(input:{prompt:string;current:Definition|null;signal?:AbortSignal;onProgress?:(event:SiteGenerationProgress)=>void;repair?:{proposal:Proposal;errors:string[]};registeredTools?:GeneratedToolManifest[];registeredCatalogTools?:RegisteredTool[]})=>Promise<Proposal>;
export type DefinitionVersionSummary={definitionVersion:number;summary:string;createdAt:string;generated:boolean};


export class GeneratedSourceError extends Error {
  constructor(public diagnostics:string[]){super(diagnostics.join(' '));this.name='GeneratedSourceError'}
}
/** Parse and inspect only: no generated JavaScript executes in this process.
 * Browser response sandbox/CSP and the host bridge remain the security boundary.
 */
export function validateGeneratedArtifact(input:unknown):GeneratedArtifact {
  const result=generatedArtifactSchema.safeParse(input);
  if(!result.success)throw new GeneratedSourceError(['Source must contain bounded html, css and js fields in html-v1 format.']);
  const source=result.data,errors:string[]=[];
  if(/<\s*(script|iframe|frame|object|embed|base|meta|link|style|html|head)\b/i.test(source.html))errors.push('HTML must be body content only, without scripts, frames, metadata or external dependencies. Put JavaScript in js and styles in css.');
  // Inspect attribute names, not visible text or quoted attribute values. The
  // browser sanitizer removes inline handlers; reject them here for repair.
  const markup=source.html.replace(/<!--[\s\S]*?(?:-->|$)/g,'');
  for(const tag of markup.matchAll(/<[a-z][\w:-]*\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)){
    for(const attribute of tag[1]!.matchAll(/([^\s=\/'"<>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g)){
      if(/^on[a-z]+$/i.test(attribute[1]!))errors.push('HTML inline event handlers are unavailable. Attach listeners with addEventListener in js.');
    }
  }
  if(/<\/\s*script/i.test(source.js)||/<\/\s*style/i.test(source.css))errors.push('Source cannot contain closing script/style tags.');
  if(/@import\b/i.test(source.css))errors.push('External CSS imports are unavailable. Include styles directly.');
  if(/AIza[0-9A-Za-z_-]{35}/.test([source.html,source.css,source.js].join('')))errors.push('Credentials must not be included in generated source.');
  const forbidden=new Set(['eval','Function','fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','importScripts','RTCPeerConnection','webkitRTCPeerConnection','openDatabase','indexedDB','localStorage','sessionStorage']);
  try {
    const ast=parse(source.js,{ecmaVersion:'latest',sourceType:'script'});
    const queue:unknown[]=[ast];let nodes=0;
    while(queue.length){
      const value=queue.pop();if(!value||typeof value!=='object')continue;
      if(++nodes>30000){errors.push('The script is too complex. Keep the implementation concise.');break;}
      const node=value as Record<string,unknown>;
      if(node.type==='Identifier'&&forbidden.has(String(node.name)))errors.push(`Use the LivingForma bridge instead of ${String(node.name)}.`);
      if(node.type==='ImportExpression')errors.push('External JavaScript imports are unavailable. Write self-contained browser code.');
      if(node.type==='MemberExpression'){
        const object=node.object as Record<string,unknown>,property=node.property as Record<string,unknown>;
        const name=property?.type==='Identifier'&&!node.computed?property.name:property?.type==='Literal'?property.value:undefined;
        if(object?.type==='Identifier'&&['window','globalThis','self','document','parent','top','navigator'].includes(String(object.name))&&['location','cookie','domain','parent','top','opener','sendBeacon','serviceWorker','credentials','permissions','mediaDevices','geolocation'].includes(String(name)))errors.push('Use the LivingForma bridge for host, navigation and device capabilities.');
      }
      for(const [key,child]of Object.entries(node))if(!['start','end','loc','range'].includes(key)){if(Array.isArray(child))queue.push(...child);else if(child&&typeof child==='object')queue.push(child)}
    }
  }catch(error){errors.push(`JavaScript syntax: ${error instanceof Error?error.message:'Unable to parse source.'}`)}
  if(errors.length)throw new GeneratedSourceError([...new Set(errors)].slice(0,8));
  return source;
}
