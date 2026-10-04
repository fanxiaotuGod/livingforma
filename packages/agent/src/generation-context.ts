import { definitionSchema, generatedToolSpecSchema, toolSpecSchema, type Definition, type GeneratedToolManifest, type RegisteredTool } from '@livingforma/contracts';
import { PlannerError } from './pi-runtime';

export const sensitive = /(?:AIza[\w-]*|Bearer\s+[A-Za-z0-9._-]+|(?:api[_-]?key|client[_-]?secret|csrf[_-]?token|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_-]{6,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
export const object = (value:unknown):value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value);

export function modelCurrent(current:Definition|null):Definition|null {
  if(!current)return null;
  // Strict parsing rejects accidental records/session objects. Private defaults never enter model context.
  const copy=definitionSchema.parse(structuredClone(current));
  for(const field of copy.entitySchema.fields)if(!field.public)delete field.defaultValue;
  if(sensitive.test(JSON.stringify(copy)))throw new PlannerError('SENSITIVE_CONTEXT','Remove credentials from the saved website before generating source.');
  return copy;
}

const manifestSchema=generatedToolSpecSchema.omit({source:true,tests:true});
export function modelRegistry(registeredTools:GeneratedToolManifest[]=[],catalog:RegisteredTool[]=[]){
  if(registeredTools.length>100||catalog.length>100)throw new PlannerError('REGISTRY_TOO_LARGE','The tool registry exceeds the generation context limit.');
  // Explicit projection prevents source, fixture values and operational metadata leaking into discovery.
  const generated=registeredTools.map(tool=>manifestSchema.parse({kind:tool.kind,toolId:tool.toolId,toolVersion:tool.toolVersion,name:tool.name,description:tool.description,inputSchema:tool.inputSchema,outputSchema:tool.outputSchema,sideEffects:tool.sideEffects,capabilities:tool.capabilities}));
  const connectors=catalog.filter(tool=>tool.enabled).map(({spec})=>{
    const safe=toolSpecSchema.parse(spec);
    return {toolId:safe.toolId,toolVersion:safe.toolVersion,name:safe.name,description:safe.description,parameters:safe.parameters,responseMap:safe.responseMap,sideEffects:safe.sideEffects};
  });
  const registry={generated,connectors};
  const encoded=JSON.stringify(registry);
  if(encoded.length>80000)throw new PlannerError('REGISTRY_TOO_LARGE','The tool registry exceeds the generation context limit.');
  if(sensitive.test(encoded))throw new PlannerError('SENSITIVE_CONTEXT','Tool metadata contains credentials and cannot enter generation context.');
  return registry;
}
export type ModelRegistry=ReturnType<typeof modelRegistry>;
