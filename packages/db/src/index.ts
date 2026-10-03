import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DataRecord, Definition, RegisteredTool, SpaceEvent, Snapshot, User, ProviderBudgetStore, MediaBudgetStore } from '@livingforma/contracts';

export interface SqlConnection { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{rows:T[]}> }
export interface Database extends SqlConnection { kind:'pglite'|'postgres'; transaction<T>(fn:(tx:SqlConnection)=>Promise<T>):Promise<T>; close():Promise<void> }
export async function createDatabase(options:{url?:string;dataDir?:string}={}):Promise<Database>{
  if(options.url){
    const pool=new pg.Pool({connectionString:options.url,max:5});
    // pg removes failed idle clients itself; handling this event prevents an
    // otherwise uncaught background error from terminating the server.
    pool.on('error',()=>{console.warn('An idle database connection was lost and removed from the pool.');});
    const db:Database={kind:'postgres',query:async<T>(sql:string,params?:unknown[])=>({rows:(await pool.query(sql,params)).rows as T[]}),transaction:async fn=>{
      const client=await pool.connect();
      try{await client.query('BEGIN');const value=await fn({query:async<T>(sql:string,params?:unknown[])=>({rows:(await client.query(sql,params)).rows as T[]})});await client.query('COMMIT');return value;}
      catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    },close:()=>pool.end()};
    await migrate(db);return db;
  }
  const dataDir=options.dataDir?resolve(options.dataDir):undefined;
  if(dataDir)await mkdir(dataDir,{recursive:true});
  const engine=new PGlite(dataDir);
  await engine.waitReady;
  const db:Database={kind:'pglite',query:async<T>(sql:string,params?:unknown[])=>engine.query<T>(sql,params),transaction:fn=>engine.transaction(tx=>fn({query:async<T>(sql:string,params?:unknown[])=>tx.query<T>(sql,params)})),close:()=>engine.close()};
  await migrate(db);return db;
}

// Compatible PostgreSQL DDL; each numbered migration is atomic and idempotent.
export async function migrate(db:Database){await db.transaction(async tx=>{
  await tx.query('CREATE TABLE IF NOT EXISTS lf_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  if(!(await tx.query('SELECT version FROM lf_migrations WHERE version=1')).rows.length){
  const statements=[
    'CREATE TABLE lf_users (id text PRIMARY KEY, google_sub text UNIQUE, profile jsonb NOT NULL)',
    'CREATE TABLE lf_sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES lf_users(id), data jsonb NOT NULL, expires_at timestamptz NOT NULL)',
    'CREATE INDEX lf_sessions_expiry ON lf_sessions(expires_at)',
    'CREATE TABLE lf_spaces (id text PRIMARY KEY, slug text UNIQUE NOT NULL, data jsonb NOT NULL)',
    'CREATE TABLE lf_events (space_id text NOT NULL REFERENCES lf_spaces(id) ON DELETE CASCADE, cursor integer NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(space_id,cursor))',
    'CREATE TABLE lf_requests (space_id text NOT NULL REFERENCES lf_spaces(id) ON DELETE CASCADE, user_id text NOT NULL, request_id text NOT NULL, fingerprint text NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(space_id,user_id,request_id))',
    'CREATE TABLE lf_tools (space_id text NOT NULL REFERENCES lf_spaces(id) ON DELETE CASCADE, tool_id text NOT NULL, version integer NOT NULL, data jsonb NOT NULL, PRIMARY KEY(space_id,tool_id,version))',
    'CREATE TABLE lf_tool_runs (id text PRIMARY KEY, space_id text NOT NULL REFERENCES lf_spaces(id) ON DELETE CASCADE, tool_id text NOT NULL, version integer NOT NULL, status text NOT NULL, duration_ms integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now())',
  ];
  for(const sql of statements)await tx.query(sql);
  await tx.query('INSERT INTO lf_migrations(version) VALUES(1)');
  }
  if(!(await tx.query('SELECT version FROM lf_migrations WHERE version=2')).rows.length){
    await tx.query('CREATE TABLE lf_oauth_transactions (state_hash text PRIMARY KEY, data jsonb NOT NULL, expires_at timestamptz NOT NULL)');
    await tx.query('CREATE INDEX lf_oauth_expiry ON lf_oauth_transactions(expires_at)');
    await tx.query('INSERT INTO lf_migrations(version) VALUES(2)');
  }
  if(!(await tx.query('SELECT version FROM lf_migrations WHERE version=3')).rows.length){
    await tx.query('CREATE TABLE lf_provider_budgets (provider text PRIMARY KEY, data jsonb NOT NULL)');
    await tx.query('INSERT INTO lf_migrations(version) VALUES(3)');
  }
  if(!(await tx.query('SELECT version FROM lf_migrations WHERE version=4')).rows.length){
    await tx.query('CREATE TABLE lf_media_budgets (bucket text NOT NULL, period text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(bucket,period))');
    await tx.query('INSERT INTO lf_migrations(version) VALUES(4)');
  }
});}
export type SpaceState={space:Snapshot['space'];ownerId:string;members:string[];definition:Definition|null;records:DataRecord[];stateVersion:number;eventCursor:number};
export class Store {
  constructor(public db:Database){}
  async getSpace(slug:string,tx:SqlConnection=this.db,lock=false):Promise<SpaceState|null>{return (await tx.query<{data:SpaceState}>(`SELECT data FROM lf_spaces WHERE slug=$1${lock?' FOR UPDATE':''}`,[slug])).rows[0]?.data??null;}
  async listSpaces():Promise<SpaceState[]>{return (await this.db.query<{data:SpaceState}>('SELECT data FROM lf_spaces ORDER BY slug')).rows.map(row=>row.data);}
  async insertSpace(state:SpaceState,tx:SqlConnection=this.db){await tx.query('INSERT INTO lf_spaces(id,slug,data) VALUES($1,$2,$3)',[state.space.id,state.space.slug,JSON.stringify(state)]);}
  async saveSpace(state:SpaceState,tx:SqlConnection){await tx.query('UPDATE lf_spaces SET data=$1 WHERE id=$2',[JSON.stringify(state),state.space.id]);}
  async event(state:SpaceState,type:SpaceEvent['type'],tx:SqlConnection){state.eventCursor++;const event:SpaceEvent={id:state.eventCursor,spaceId:state.space.id,type,definitionVersion:state.definition?.definitionVersion??0,stateVersion:state.stateVersion};await tx.query('INSERT INTO lf_events(space_id,cursor,data) VALUES($1,$2,$3)',[state.space.id,event.id,JSON.stringify(event)]);await this.saveSpace(state,tx);return event;}
  async events(spaceId:string,after:number,limit=100):Promise<SpaceEvent[]>{return (await this.db.query<{data:SpaceEvent}>('SELECT data FROM lf_events WHERE space_id=$1 AND cursor>$2 ORDER BY cursor LIMIT $3',[spaceId,after,limit])).rows.map(row=>row.data);}
  async request(tx:SqlConnection,spaceId:string,userId:string,requestId:string):Promise<{fingerprint:string;result:unknown}|null>{return (await tx.query<{fingerprint:string;result:unknown}>('SELECT fingerprint,result FROM lf_requests WHERE space_id=$1 AND user_id=$2 AND request_id=$3',[spaceId,userId,requestId])).rows[0]??null;}
  async remember(tx:SqlConnection,spaceId:string,userId:string,requestId:string,fingerprint:string,result:unknown=null){await tx.query('INSERT INTO lf_requests(space_id,user_id,request_id,fingerprint,result) VALUES($1,$2,$3,$4,$5)',[spaceId,userId,requestId,fingerprint,JSON.stringify(result)]);}
  async getUser(id:string):Promise<User|null>{return (await this.db.query<{profile:User}>('SELECT profile FROM lf_users WHERE id=$1',[id])).rows[0]?.profile??null;}
  async upsertGoogleUser(identity:{sub:string;name:string;email?:string;picture?:string}):Promise<User>{
    // Unique Google subject makes concurrent callbacks resolve to the same internal identity.
    const user:User={id:`usr_${randomUUID()}`,name:identity.name,...(identity.email?{email:identity.email}:{}),...(identity.picture?{avatarUrl:identity.picture}:{})};
    const result=await this.db.query<{profile:User}>(`INSERT INTO lf_users(id,google_sub,profile) VALUES($1,$2,$3) ON CONFLICT(google_sub) DO UPDATE SET profile=EXCLUDED.profile || jsonb_build_object('id',lf_users.id) RETURNING profile`,[user.id,identity.sub,JSON.stringify(user)]);return result.rows[0]!.profile;
  }
  async putUser(user:User){await this.db.query('INSERT INTO lf_users(id,profile) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET profile=EXCLUDED.profile',[user.id,JSON.stringify(user)]);return user;}
  async getTools(spaceId:string):Promise<RegisteredTool[]>{return (await this.db.query<{data:RegisteredTool}>('SELECT data FROM lf_tools WHERE space_id=$1 ORDER BY tool_id,version',[spaceId])).rows.map(row=>row.data);}
  async getTool(spaceId:string,toolId:string,version:number,tx:SqlConnection=this.db):Promise<RegisteredTool|null>{return (await tx.query<{data:RegisteredTool}>('SELECT data FROM lf_tools WHERE space_id=$1 AND tool_id=$2 AND version=$3',[spaceId,toolId,version])).rows[0]?.data??null;}
  async putTool(spaceId:string,tool:RegisteredTool,tx:SqlConnection=this.db){await tx.query('INSERT INTO lf_tools(space_id,tool_id,version,data) VALUES($1,$2,$3,$4) ON CONFLICT(space_id,tool_id,version) DO UPDATE SET data=EXCLUDED.data',[spaceId,tool.spec.toolId,tool.spec.toolVersion,JSON.stringify(tool)]);}
  async auditTool(spaceId:string,toolId:string,version:number,status:'ok'|'failed',durationMs:number,tx:SqlConnection=this.db){await tx.query('INSERT INTO lf_tool_runs(id,space_id,tool_id,version,status,duration_ms) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),spaceId,toolId,version,status,Math.max(0,Math.round(durationMs))]);}
}

/** Reserve before every provider request. A successful reservation is never refunded. */
export function createProviderBudgetStore(db:Database):ProviderBudgetStore {
  return {async reserve(input){
    const {provider,day,now,dailyLimit,minuteLimit}=input;
    if(provider!=='gemini'||!Number.isFinite(now)||now<0||new Date(now).toISOString().slice(0,10)!==day||!Number.isInteger(dailyLimit)||dailyLimit<0||dailyLimit>30||!Number.isInteger(minuteLimit)||minuteLimit<0||minuteLimit>5)throw new Error('BUDGET_INVALID');
    await db.transaction(async tx=>{
      const initial={day,requests:0,recent:[] as number[]};
      await tx.query('INSERT INTO lf_provider_budgets(provider,data) VALUES($1,$2) ON CONFLICT(provider) DO NOTHING',[provider,JSON.stringify(initial)]);
      const previous=(await tx.query<{data:{day:string;requests:number;recent:number[]}}>('SELECT data FROM lf_provider_budgets WHERE provider=$1 FOR UPDATE',[provider])).rows[0]!.data;
      if(!previous||typeof previous.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(previous.day)||previous.day>day||!Number.isInteger(previous.requests)||previous.requests<0||!Array.isArray(previous.recent)||previous.recent.some(time=>!Number.isFinite(time)))throw new Error('BUDGET_UNAVAILABLE');
      // Keep the rolling minute window across UTC midnight; only the daily count resets.
      const recent=previous.recent.filter(time=>time>now-60_000);
      const requests=previous.day===day?previous.requests:0;
      if(requests>=dailyLimit||recent.length>=minuteLimit)throw new Error('FREE_QUOTA_EXHAUSTED');
      await tx.query('UPDATE lf_provider_budgets SET data=$1 WHERE provider=$2',[JSON.stringify({day,requests:requests+1,recent:[...recent,now]}),provider]);
    });
  }};
}

/** A manually verified allowance period never resets on date changes or host restarts. */
export function createMediaBudgetStore(db:Database,options:{verifiedPeriod?:string}={}):MediaBudgetStore {
  const verifiedPeriod=options.verifiedPeriod??'verified-2026-10-03';
  return {async reserve(input){
    const {bucket,period,units,limit,minuteRequestLimit,now}=input;
    const maximum=bucket==='elevenlabs-stt-seconds'?60:bucket==='elevenlabs-tts-characters'?1000:0;
    if(!maximum||period!==verifiedPeriod||!Number.isFinite(now)||now<0||!Number.isInteger(units)||units<=0||!Number.isInteger(limit)||limit<0||limit>maximum||!Number.isInteger(minuteRequestLimit)||minuteRequestLimit<0||minuteRequestLimit>3)throw new Error('BUDGET_INVALID');
    await db.transaction(async tx=>{
      await tx.query('INSERT INTO lf_media_budgets(bucket,period,data) VALUES($1,$2,$3) ON CONFLICT(bucket,period) DO NOTHING',[bucket,period,JSON.stringify({units:0,recent:[]})]);
      const previous=(await tx.query<{data:{units:number;recent:number[]}}>('SELECT data FROM lf_media_budgets WHERE bucket=$1 AND period=$2 FOR UPDATE',[bucket,period])).rows[0]!.data;
      if(!previous||!Number.isInteger(previous.units)||previous.units<0||!Array.isArray(previous.recent)||previous.recent.some(time=>!Number.isFinite(time)))throw new Error('BUDGET_UNAVAILABLE');
      const recent=previous.recent.filter(time=>time>now-60_000);
      if(previous.units+units>limit||recent.length>=minuteRequestLimit)throw new Error('FREE_QUOTA_EXHAUSTED');
      await tx.query('UPDATE lf_media_budgets SET data=$1 WHERE bucket=$2 AND period=$3',[JSON.stringify({units:previous.units+units,recent:[...recent,now]}),bucket,period]);
    });
  }};
}
