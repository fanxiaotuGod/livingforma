import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, createProviderBudgetStore, type Database } from './index';

let db:Database;let directory:string;
const reservation=(now:number,dailyLimit=30,minuteLimit=5)=>({provider:'gemini' as const,day:new Date(now).toISOString().slice(0,10),now,dailyLimit,minuteLimit});
beforeAll(async()=>{directory=await mkdtemp(join(tmpdir(),'lf-budget-'));db=await createDatabase({dataDir:directory});},30_000);
beforeEach(async()=>{await db.query('DELETE FROM lf_provider_budgets');});
afterAll(async()=>{await db?.close();await rm(directory,{recursive:true,force:true});});
describe('durable provider budget',()=>{
  it('atomically caps concurrent reservations across separate adapters',async()=>{
    const now=Date.parse('2026-10-03T20:00:00Z');const first=createProviderBudgetStore(db);const second=createProviderBudgetStore(db);
    const results=await Promise.allSettled(Array.from({length:10},(_,i)=>(i%2?first:second).reserve(reservation(now,3))));
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(3);
    for(const result of results.filter(result=>result.status==='rejected'))expect(result.reason.message).toBe('FREE_QUOTA_EXHAUSTED');
    expect((await db.query<{data:{requests:number}}>('SELECT data FROM lf_provider_budgets')).rows[0]!.data.requests).toBe(3);
  });
  it('preserves the minute cap across midnight and resets only daily usage',async()=>{
    const before=Date.parse('2026-10-03T23:59:50Z');const budget=createProviderBudgetStore(db);
    for(let i=0;i<5;i++)await budget.reserve(reservation(before));
    await expect(budget.reserve(reservation(before+20_000))).rejects.toThrow('FREE_QUOTA_EXHAUSTED');
    await budget.reserve(reservation(before+60_001));
    expect((await db.query<{data:{day:string;requests:number}}>('SELECT data FROM lf_provider_budgets')).rows[0]!.data).toMatchObject({day:'2026-10-04',requests:1});
  });
  it('keeps failed-call reservations after restart and rejects clock rollback',async()=>{
    const now=Date.parse('2026-10-03T20:00:00Z');await createProviderBudgetStore(db).reserve(reservation(now,1));
    await db.close();db=await createDatabase({dataDir:directory});
    await expect(createProviderBudgetStore(db).reserve(reservation(now+60_001,1))).rejects.toThrow('FREE_QUOTA_EXHAUSTED');
    await expect(createProviderBudgetStore(db).reserve(reservation(now-86_400_000,1))).rejects.toThrow('BUDGET_UNAVAILABLE');
  });
  it('stops on zero budget and rejects impossible or oversized limits',async()=>{
    const budget=createProviderBudgetStore(db);const now=Date.parse('2026-10-03T20:00:00Z');
    await expect(budget.reserve(reservation(now,0))).rejects.toThrow('FREE_QUOTA_EXHAUSTED');
    await expect(budget.reserve(reservation(now,31))).rejects.toThrow('BUDGET_INVALID');
    await expect(budget.reserve({...reservation(now),day:'2026-10-02'})).rejects.toThrow('BUDGET_INVALID');
  });
});
