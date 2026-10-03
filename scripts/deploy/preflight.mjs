// Read-only release configuration / existing-ledger check. No provider requests.
// node --env-file=.env scripts/deploy/preflight.mjs [--production] [--database]
import { createRequire } from 'node:module';

const production=process.argv.includes('--production');
const checks=[];
const add=(check,ok)=>checks.push({check,ok:Boolean(ok)});
for(const key of ['DATABASE_URL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GEMINI_API_KEY','ELEVENLABS_API_KEY'])add(`${key} present`,process.env[key]?.trim());
add('live Gemini planner',process.env.AGENT_MODE==='gemini');
add('verified model pinned',process.env.GEMINI_MODEL==='gemini-3.5-flash-lite');
add('Gemini account verified',process.env.GEMINI_FREE_TIER_VERIFIED==='true');
add('ElevenAPI allowance verified',process.env.ELEVENLABS_ALLOWANCE_VERIFIED==='true');
add('Gemini request ceiling preserved',process.env.GEMINI_DAILY_REQUEST_LIMIT==='30');
add('no file budget override',!process.env.GEMINI_BUDGET_FILE);
add('TLS verification enabled',process.env.NODE_TLS_REJECT_UNAUTHORIZED!=='0');
try {
  const dbUrl=new URL(process.env.DATABASE_URL);
  add('PostgreSQL verify-full',/^postgres(?:ql)?:$/.test(dbUrl.protocol)&&dbUrl.searchParams.get('sslmode')==='verify-full');
} catch { add('PostgreSQL verify-full',false); }
try {
  const origin=new URL(process.env.APP_ORIGIN);
  add('app origin',production?origin.href==='https://livingforma.tech/':origin.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(origin.hostname));
} catch { add('app origin',false); }
if(production){add('production mode',process.env.NODE_ENV==='production');add('local identities disabled',process.env.ENABLE_LOCAL_DEMO==='false');}

let quotas;
if(process.argv.includes('--database')&&checks.every(check=>check.ok)){
  const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
  const {Client}=require('pg');
  const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,statement_timeout:10000});
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const gemini=(await client.query("SELECT data FROM lf_provider_budgets WHERE provider='gemini'")).rows[0]?.data;
    const media=(await client.query('SELECT bucket,period,data FROM lf_media_budgets WHERE period=$1',['verified-2026-10-03'])).rows;
    const limits={'elevenlabs-stt-seconds':60,'elevenlabs-tts-characters':1000};
    add('existing Gemini ledger retained',gemini&&Number.isInteger(gemini.requests)&&gemini.requests>=0&&gemini.requests<=30);
    add('existing media ledgers retained',Object.keys(limits).every(bucket=>media.some(row=>row.bucket===bucket&&Number.isInteger(row.data.units)&&row.data.units>=0&&row.data.units<=limits[bucket])));
    quotas={gemini:gemini?{day:gemini.day,reserved:gemini.requests,limit:30}:null,media:media.map(row=>({bucket:row.bucket,period:row.period,reserved:row.data.units,limit:limits[row.bucket]}))};
    await client.query('ROLLBACK');
  } catch { add('database read-only check',false); }
  finally { await client.end().catch(()=>{}); }
}
const passed=checks.every(check=>check.ok);
console.log(JSON.stringify({passed,checks,quotas,note:'No provider calls, ledger writes, or allowance resets. Zero remaining quota must stop generation; preflight success does not mean deployment.'},null,2));
if(!passed)process.exitCode=1;
