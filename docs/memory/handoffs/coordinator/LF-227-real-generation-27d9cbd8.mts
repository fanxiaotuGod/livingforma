/** Opt-in real-provider acceptance server. Business data stays in local PGlite;
 * the original Neon provider ledger remains authoritative. Never prints secrets.
 * Run only after LF227 is claimed; it serves the current built web application.
 */
import {config} from '../../../../apps/api/node_modules/dotenv/lib/main.js';
import pg from '../../../../packages/db/node_modules/pg/lib/index.js';
import {createDatabase,createProviderBudgetStore,type Database} from '../../../../packages/db/src/index.ts';
import * as agent from '../../../../packages/agent/src/index.ts';
import {createSiteGenerator} from '../../../../packages/agent/src/site-generator.ts';
import {buildApp} from '../../../../apps/api/src/app.ts';
import {createGeneratedToolAdapter} from '../../../../apps/api/src/generated-tool-runtime.ts';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {writeFile} from 'node:fs/promises';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
if(process.env.LF_RUN_REAL_GENERATION!=='true'){
 console.log('Opt-in acceptance server. Set LF_RUN_REAL_GENERATION=true after LF227 is claimed. Real requests consume the existing free allowance.');
 process.exit(0);
}
const coordination=JSON.parse(execFileSync('python3',['scripts/coordination.py','status'],{cwd:root,encoding:'utf8'}));
const coordinator=coordination.sessions.find((session:any)=>session.id==='27d9cbd8-ed2b-4f98-874c-e81f6a6fd28f'&&session.status==='active');
const assignedDiagnostic=coordinator?.task_id==='LF-155'&&coordination.sessions.some((session:any)=>session.role==='agent'&&session.status==='active'&&session.task_id==='LF-230');
if(!coordination.ok||!(coordinator?.task_id==='LF-227'||assignedDiagnostic))throw new Error('LF227 integration or the assigned LF155/LF230 diagnostic must be claimed.');
config({path:resolve(root,'.env'),quiet:true});
if(!process.env.DATABASE_URL||process.env.GEMINI_FREE_TIER_VERIFIED!=='true')throw new Error('The existing durable verified-free provider configuration is required.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2});
pool.on('error',()=>console.warn('The provider ledger connection became unavailable.'));
// Do not call createDatabase(url): unreviewed application migrations must never
// be applied to production just to validate a new generator locally.
const budgetDb:Database={kind:'postgres',query:async(sql,params)=>({rows:(await pool.query(sql,params)).rows}),transaction:async fn=>{
 const client=await pool.connect();try{await client.query('BEGIN');const result=await fn({query:async(sql,params)=>({rows:(await client.query(sql,params)).rows})});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
},close:()=>pool.end()};
const before=await pool.query('SELECT provider,data FROM lf_provider_budgets WHERE provider=$1',['gemini']);
const budget=before.rows[0]?.data,day=new Date().toISOString().slice(0,10),used=budget?.day===day?budget.requests:0;
console.log(JSON.stringify({event:'budget_preflight',day,used,limit:30,model:process.env.GEMINI_MODEL,reset:false}));
if(!Number.isInteger(used)||used>=30){await pool.end();throw new Error('The durable free allowance is exhausted or unverifiable.');}
agent.configureBudgetStore(createProviderBudgetStore(budgetDb));
const port=Number(process.env.LF_REAL_PORT??4347),origin=`http://localhost:${port}`;
// This explicitly opted-in loopback server uses a labelled local test identity.
// Existing Google credentials are never mounted in this acceptance environment.
process.env.ENABLE_LOCAL_DEMO='true';
const db=await createDatabase({dataDir:resolve(process.env.LF_REAL_DATA_DIR??'/tmp/livingforma-real-generation-27d9cbd8')});
const toolGenerator=(agent as any).generateTool as any;
if(typeof toolGenerator!=='function'){await db.close();await pool.end();throw new Error('The accepted generated tool export is not integrated yet.');}
const {app}=await buildApp({db,origin,localDemo:true,planner:agent.planProposal,plannerMode:'local',tools:agent.createToolAdapter(),generatedToolAdapter:createGeneratedToolAdapter(),toolCodeGenerator:toolGenerator,siteGenerator:async input=>{
 const events:unknown[]=[],candidates:unknown[]=[],startedAt=new Date().toISOString();
 const actualSite=createSiteGenerator({onCandidate:candidate=>candidates.push(candidate)});
 try{return await actualSite({...input,onProgress:progress=>{events.push(structuredClone(progress));input.onProgress?.(progress);}});}finally{
  const evidence=agent.getLastRunEvidence();
  // Only the generator's bounded, already-filtered public source/outline events
  // are saved. Never save the request context, record values or model thinking.
  await writeFile(resolve(root,`docs/memory/handoffs/coordinator/LF-227-actual-run-${Date.now()}-27d9cbd8.json`),JSON.stringify({startedAt,scope:'Real Pi/Gemini; isolated business PGlite; labelled local identity; unchanged original provider ledger',events,candidates,evidence},null,2));
  console.log(JSON.stringify({event:'model_run_finished',evidence}));
 }
},staticDir:resolve(root,'apps/web/dist'),logger:false});
let closing=false;
async function close(){if(closing)return;closing=true;await app.close();await pool.end();}
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void close().finally(()=>process.exit(0));});
await app.listen({port,host:'127.0.0.1'});
console.log(JSON.stringify({event:'acceptance_server_ready',origin,database:'isolated-local-pglite',identity:'explicit-local-test-only',providerBudget:'original-neon-ledger',providerCallsOnStartup:0}));
