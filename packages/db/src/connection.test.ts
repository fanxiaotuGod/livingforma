import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import pg from 'pg';
import { createDatabase } from './index';

afterEach(()=>vi.restoreAllMocks());

it('survives an idle pool error without logging connection details or hiding request failures',async()=>{
  const client={query:vi.fn(async(sql:string)=>({rows:sql.startsWith('SELECT version')?[{version:1}]:[]})),release:vi.fn()};
  const pool=Object.assign(new EventEmitter(),{
    connect:vi.fn(async()=>client),query:vi.fn(async()=>({rows:[{ok:1}]})),end:vi.fn(async()=>{}),
  });
  vi.spyOn(pg,'Pool').mockImplementation(()=>pool as unknown as pg.Pool);
  const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const db=await createDatabase({url:'postgres://fixture.invalid/test'});
  const error=new Error('Network failed; sensitive fixture connection details');
  expect(()=>pool.emit('error',error,client)).not.toThrow();
  expect(warning).toHaveBeenCalledOnce();
  expect(JSON.stringify(warning.mock.calls)).not.toContain(error.message);
  await expect(db.query('SELECT 1')).resolves.toEqual({rows:[{ok:1}]});
  pool.query.mockRejectedValueOnce(error);
  await expect(db.query('SELECT 1')).rejects.toBe(error);
  await db.close();
  expect(pool.end).toHaveBeenCalledOnce();
});
