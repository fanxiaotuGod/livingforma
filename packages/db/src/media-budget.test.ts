import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, createMediaBudgetStore, type Database } from './index';

let db:Database;let directory:string;
const reserveInput=(units:number,now=Date.parse('2026-10-03T20:00:00Z'))=>({bucket:'elevenlabs-stt-seconds' as const,period:'verified-2026-10-03',units,limit:60,minuteRequestLimit:3,now});
beforeAll(async()=>{directory=await mkdtemp(join(tmpdir(),'lf-media-budget-'));db=await createDatabase({dataDir:directory});},30_000);
beforeEach(async()=>{await db.query('DELETE FROM lf_media_budgets');});
afterAll(async()=>{await db?.close();await rm(directory,{recursive:true,force:true});});
describe('non-resetting media allowance',()=>{
  it('reserves units atomically across adapters and does not overshoot the verified allowance',async()=>{
    const first=createMediaBudgetStore(db),second=createMediaBudgetStore(db);const results=await Promise.allSettled(Array.from({length:8},(_,i)=>(i%2?first:second).reserve(reserveInput(20))));
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(3);expect((await db.query<{data:{units:number}}>('SELECT data FROM lf_media_budgets')).rows[0]!.data.units).toBe(60);
  });
  it('limits each bucket to three starts a minute independently of units',async()=>{
    const budget=createMediaBudgetStore(db);for(let i=0;i<3;i++)await budget.reserve(reserveInput(1));await expect(budget.reserve(reserveInput(1))).rejects.toThrow('FREE_QUOTA_EXHAUSTED');
    await budget.reserve(reserveInput(1,reserveInput(1).now+60_001));
    await budget.reserve({...reserveInput(1),bucket:'elevenlabs-tts-characters',units:100,limit:1000});
    expect((await db.query('SELECT * FROM lf_media_budgets')).rows).toHaveLength(2);
  });
  it('keeps consumed allowance through midnight and disk restart, including failed-call reservations',async()=>{
    const before=Date.parse('2026-10-03T23:59:00Z');await createMediaBudgetStore(db).reserve(reserveInput(60,before));await db.close();db=await createDatabase({dataDir:directory});
    await expect(createMediaBudgetStore(db).reserve(reserveInput(1,before+86_400_000))).rejects.toThrow('FREE_QUOTA_EXHAUSTED');
  });
  it('rejects an unverified new period, invalid units and raised limits instead of resetting counters',async()=>{
    const budget=createMediaBudgetStore(db);await expect(budget.reserve({...reserveInput(1),period:'2026-10-04'})).rejects.toThrow('BUDGET_INVALID');
    await expect(budget.reserve(reserveInput(0))).rejects.toThrow('BUDGET_INVALID');await expect(budget.reserve({...reserveInput(1),limit:61})).rejects.toThrow('BUDGET_INVALID');await expect(budget.reserve({...reserveInput(1),minuteRequestLimit:4})).rejects.toThrow('BUDGET_INVALID');
  });
});
