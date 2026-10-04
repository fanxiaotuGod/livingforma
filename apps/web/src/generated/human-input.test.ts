import {afterEach,describe,expect,it,vi} from 'vitest';
import {GENERATED_BRIDGE_LIMITS} from '@livingforma/contracts';
import {createHumanChoice} from './human-input';
afterEach(()=>vi.useRealTimers());
describe('bounded host human choice',()=>{
 it('keeps a choice alive beyond the ordinary request timeout',async()=>{vi.useFakeTimers();const choice=createHumanChoice<string>();await vi.advanceTimersByTimeAsync(GENERATED_BRIDGE_LIMITS.requestMs+1);choice.choose('selected');expect(await choice.result).toEqual({status:'selected',value:'selected'});expect(vi.getTimerCount()).toBe(0)});
 it('expires once at 120 seconds and ignores late files or approval',async()=>{vi.useFakeTimers();const choice=createHumanChoice<boolean>();await vi.advanceTimersByTimeAsync(GENERATED_BRIDGE_LIMITS.humanChoiceMs);expect(await choice.result).toEqual({status:'expired'});choice.choose(true);choice.cancel();expect(await choice.result).toEqual({status:'expired'});expect(vi.getTimerCount()).toBe(0)});
 it('honors the absolute deadline even if a background timer did not run',async()=>{vi.useFakeTimers();const choice=createHumanChoice<string>();vi.setSystemTime(Date.now()+GENERATED_BRIDGE_LIMITS.humanChoiceMs+1);choice.choose('late');expect(await choice.result).toEqual({status:'expired'});expect(vi.getTimerCount()).toBe(0)});
 it('cancels on dismissal/cleanup and later selection cannot restore it',async()=>{vi.useFakeTimers();const choice=createHumanChoice<string>();choice.cancel();choice.choose('late');expect(await choice.result).toEqual({status:'cancelled'});expect(vi.getTimerCount()).toBe(0)});
});
