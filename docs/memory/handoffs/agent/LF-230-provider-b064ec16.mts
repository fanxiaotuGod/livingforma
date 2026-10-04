/** Explicitly authorized LF230 reproduction only. No business database migrations. */
import {config} from '../../../../apps/api/node_modules/dotenv/lib/main.js';
import pg from '../../../../packages/db/node_modules/pg/lib/index.js';
import {createProviderBudgetStore,type Database} from '../../../../packages/db/src/index.ts';
import {getLastRunEvidence,configureBudgetStore} from '../../../../packages/agent/src/index.ts';
import {createSiteGenerator} from '../../../../packages/agent/src/site-generator.ts';
import {validateGeneratedArtifact,validateEvolution} from '../../../../packages/contracts/src/index.ts';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const run=process.env.LF230_PROVIDER_RUN;
if(run!=='1'&&run!=='2'&&run!=='3')throw new Error('Set the coordinator-authorized LF230 run number. No provider call was sent.');
const status=JSON.parse(execFileSync('python3',['scripts/coordination.py','status'],{cwd:root,encoding:'utf8'}));
if(!status.ok||!status.sessions.some((s:any)=>s.id==='b064ec16-3675-4fef-b4b7-b5c6ba4f5860'&&s.task_id==='LF-230'))throw new Error('LF230 must be actively claimed.');
config({path:resolve(root,'.env'),quiet:true});
if(!process.env.DATABASE_URL||process.env.GEMINI_FREE_TIER_VERIFIED!=='true')throw new Error('The original durable verified-free configuration is required.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2});
pool.on('error',()=>console.warn('Provider ledger connection unavailable.'));
const db:Database={kind:'postgres',query:async(sql,params)=>({rows:(await pool.query(sql,params)).rows}),transaction:async fn=>{
 const client=await pool.connect();try{await client.query('BEGIN');const value=await fn({query:async(sql,params)=>({rows:(await client.query(sql,params)).rows})});await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
},close:()=>pool.end()};
configureBudgetStore(createProviderBudgetStore(db));
const budget=async()=>{const data=(await pool.query('SELECT data FROM lf_provider_budgets WHERE provider=$1',['gemini'])).rows[0]?.data;return {day:data?.day,requests:data?.requests};};
const before=await budget();if(before.day!==new Date().toISOString().slice(0,10)||!Number.isInteger(before.requests)||before.requests>=30){await pool.end();throw new Error('Original free budget is unavailable.');}
let observedCandidate:unknown;
const generateSite=createSiteGenerator({onCandidate:candidate=>{observedCandidate=candidate}});
const progress:Array<{stage:string;sourceKeys:string[];outline:boolean;tool?:string}>=[];
const evidence:any={run:Number(run),at:new Date().toISOString(),before,model:process.env.GEMINI_MODEL??'gemini-3.5-flash-lite',budget:'original-neon-ledger',businessDatabaseTouched:false};
try{
 const proposal=await generateSite({prompt:'Create Photo Drift, a polished Tinder-like photo decision app in English. Let the Owner upload their own pictures, swipe left or right with keyboard/button alternatives, and persist each picture and decision through the existing record bridge. Show an honest empty state, an undo interaction, and a compact saved collection. Use smooth reduced-motion-aware transitions and a clean mobile layout. This is a photo organizer, not a live dating service.',current:null,onProgress:event=>progress.push({stage:event.stage,sourceKeys:Object.keys(event.source??{}),outline:!!event.ui,...(event.tool?{tool:event.tool.phase}:{})})});
 evidence.proposal=proposal;evidence.sharedChecks={};
 try{validateGeneratedArtifact(proposal.appSpec.generated);validateEvolution(null,{definitionVersion:1,entitySchema:proposal.entitySchema,appSpec:proposal.appSpec,summary:proposal.summary});evidence.sharedChecks={ok:true};}catch{evidence.sharedChecks={ok:false,message:'Host source or definition review is required.'};}
 evidence.ok=true;
}catch(error){evidence.ok=false;evidence.errorCode=error&&typeof error==='object'&&'code'in error?String(error.code):'GENERATION_FAILED';}
finally{
 if(observedCandidate)evidence.observedCandidate=observedCandidate;
 evidence.runtime=getLastRunEvidence();evidence.after=await budget();evidence.progress=progress;
 writeFileSync(resolve(root,'docs/memory/handoffs/agent/LF-230-run-'+run+'-b064ec16.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({run:evidence.run,ok:evidence.ok,errorCode:evidence.errorCode,before:evidence.before,after:evidence.after,runtime:evidence.runtime,sharedChecks:evidence.sharedChecks,progress}));
 await pool.end();
}
