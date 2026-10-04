import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {siteParameters,generateSite} from './site-generator';
import {generateTool,toolParameters} from './tool-generator';
import {compactProviderSchema,compactToolPayload} from './provider-schema';
import {providerDiagnostic,classifiedProviderError,candidateDiagnostic} from './provider-diagnostics';
import {configureBudgetStore} from './pi-runtime';

const captured=vi.hoisted(()=>({schemas:[] as any[],configs:[] as any[]}));
// Exercise real Pi + real Google SDK payload construction, then stop BEFORE any transport.
vi.mock('@earendil-works/pi-ai/api/google-generative-ai',async original=>{
 const actual=await original<typeof import('@earendil-works/pi-ai/api/google-generative-ai')>();
 return {...actual,stream:(model:any,context:any,options:any)=>actual.stream(model,context,{...options,onPayload:async(payload:any)=>{
  const final=(await options.onPayload?.(payload,model))??payload;
  captured.schemas.push(final.config.tools[0].functionDeclarations[0].parametersJsonSchema);
  captured.configs.push({toolMode:final.config.toolConfig.functionCallingConfig.mode,maxOutputTokens:final.config.maxOutputTokens});
  throw new Error('OFFLINE_CAPTURE_COMPLETE');
 }})};
});
beforeEach(()=>{captured.schemas=[];captured.configs=[];vi.stubEnv('GEMINI_API_KEY','fake-offline-key');vi.stubEnv('GEMINI_FREE_TIER_VERIFIED','true');vi.stubEnv('GEMINI_MODEL','gemini-3.5-flash-lite');configureBudgetStore({reserve:async()=>{}});});
afterEach(()=>{vi.unstubAllEnvs();configureBudgetStore(undefined as never)});

it('captures actual SDK function parameters without sending a provider request',async()=>{
 await expect(generateSite({prompt:'A photo organizer',current:null})).rejects.toThrow();
 await expect(generateTool({prompt:'A reusable calculation',current:null,registeredTools:[]})).rejects.toThrow();
 expect(captured.schemas).toHaveLength(2);expect(captured.schemas[0].properties.artifact.properties.html.type).toBe('string');expect(captured.schemas[1].properties.tool.properties.source.type).toBe('string');
 expect(JSON.stringify(captured.schemas)).not.toMatch(/"maxLength"|"pattern"|"maximum"|"maxItems"/);
 expect(captured.configs).toEqual([{toolMode:'ANY',maxOutputTokens:6000},{toolMode:'ANY',maxOutputTokens:6000}]);
});
it('reduces provider decoding constraints while keeping structural required fields and original strict schemas',()=>{
 const original=JSON.stringify(siteParameters),small=compactProviderSchema(siteParameters) as any;
 expect(small.properties.artifact.properties.html).toEqual({type:'string'});expect(small.properties.entitySchema.properties.fields.items.properties.type.enum).toContain('dates');expect(small.required).toEqual((siteParameters as any).required);
 expect(small.properties.codeTools.items.properties.testsJson.type).toBe('string');expect(JSON.stringify(small)).not.toMatch(/"maxLength"|"pattern"|"maximum"|"maxItems"/);expect(JSON.stringify(siteParameters)).toBe(original);
 expect((siteParameters as any).properties.artifact.properties.html.maxLength).toBe(60000);expect((toolParameters as any).properties.tool.properties.source.maxLength).toBe(32768);
 const named=compactProviderSchema({type:'object',properties:{maxLength:{type:'number',maximum:5}},required:['maxLength']}) as any;expect(named.properties.maxLength).toEqual({type:'number'});
});
it('changes only schema payloads and preserves provider settings and the abort signal',()=>{
 const signal=new AbortController().signal;const payload={model:'fixture',contents:[{parts:[{text:'PRIVATE_CONTEXT'}]}],config:{abortSignal:signal,temperature:0.15,tools:[{functionDeclarations:[{name:'tool',parametersJsonSchema:toolParameters}]}]}};
 const transformed=compactToolPayload(payload) as any;expect(transformed.contents).toBe(payload.contents);expect(transformed.config.abortSignal).toBe(signal);expect(transformed.config.temperature).toBe(0.15);expect(transformed.config.tools[0].functionDeclarations[0].parametersJsonSchema).not.toBe(toolParameters);expect((toolParameters as any).properties.tool.properties.source.maxLength).toBe(32768);
});
it.each([
 ['{"error":{"code":400,"status":"INVALID_ARGUMENT","message":"Request contains an invalid argument."}}','schema','PROVIDER_REQUEST_INVALID'],
 ['{"error":{"code":400,"message":"API key not valid. Please pass a valid API key."}}','configuration','PROVIDER_CONFIGURATION'],
 ['{"error":{"code":400,"message":"Billing must be enabled for this project."}}','configuration','PROVIDER_CONFIGURATION'],
 ['{"error":{"code":400,"message":"User location is not supported."}}','configuration','PROVIDER_CONFIGURATION'],
 ['{"error":{"code":404,"message":"This model is not available for API version v1beta."}}','configuration','PROVIDER_CONFIGURATION'],
 ['{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded."}}','quota','FREE_QUOTA_EXHAUSTED'],
 ['{"error":{"code":503,"status":"UNAVAILABLE","message":"The service is overloaded."}}','unavailable','PROVIDER_UNAVAILABLE'],
])('classifies ordinary safe provider failure %s',(message,category,code)=>{
 const diagnostic=providerDiagnostic(message);expect(diagnostic.category).toBe(category);expect(classifiedProviderError(diagnostic).code).toBe(code);expect(diagnostic.reason).not.toContain('{"');
});
it('redacts known credential values and refuses echoed context/source instead of retaining raw errors',()=>{
 const key='known-secret-123';const diagnostic=providerDiagnostic(JSON.stringify({error:{code:400,message:'Invalid API key '+key+' for https://example.invalid/private?q=secret.'}}),[key]);
 expect(JSON.stringify(diagnostic)).not.toContain(key);expect(JSON.stringify(diagnostic)).not.toContain('example.invalid');expect(diagnostic.reason).toContain('[redacted]');
 for(const message of ['ownerRequest: PRIVATE_CONTEXT','const credential = "private"', '{"private":"context"}','x'.repeat(400)]){
  const result=providerDiagnostic(JSON.stringify({error:{code:400,message}}));expect(result.reason).toBeUndefined();expect(JSON.stringify(result)).not.toContain('PRIVATE_CONTEXT');
 }
});
it('extracts the ordinary reason from nested and array-shaped Google error wrappers',()=>{
 const message='Request contains an invalid argument.';
 for(const wrapped of [
  JSON.stringify([{error:{code:400,status:'INVALID_ARGUMENT',message}}]),
  JSON.stringify({error:{message:JSON.stringify({error:{code:400,status:'INVALID_ARGUMENT',message}})}}),
  '400: '+JSON.stringify({error:{code:400,status:'INVALID_ARGUMENT',message}}),
 ])expect(providerDiagnostic(wrapped).reason).toBe(message);
});
it('retains only known candidate field paths and rule names, never the received arguments',()=>{
 const message='Validation failed for tool "submit_site":\n  - /entitySchema/fields/2/options: Expected array length <= 30\n  - /PRIVATE_FIELD: Expected string\n\nReceived arguments:\n{"source":"PRIVATE_CODE","thinking":"PRIVATE_THINKING","api_key":"PRIVATE_KEY"}';
 const result=candidateDiagnostic('submit_site',message,siteParameters);
 expect(result).toEqual({tool:'submit_site',phase:'arguments',issues:[{path:'entitySchema.fields.2.options',rule:'bound'},{path:'?',rule:'type'}]});
 expect(JSON.stringify(result)).not.toMatch(/PRIVATE|Received/);
 expect(candidateDiagnostic('submit_site',JSON.stringify([{code:'invalid_type',path:['entitySchema','fields',2,'min'],received:'PRIVATE_VALUE'}]),siteParameters).issues).toEqual([{path:'entitySchema.fields.2.min',rule:'invalid_type'}]);
});
