import {describe,expect,it} from 'vitest';
import {interactionFeedbackReport} from './GenerationStudio';
describe('Owner interaction feedback report',()=>{
  const checked={stage:'checked' as const,sourceRevision:4,repairCount:0};
  it('scopes a bounded functional report to the exact checked or preview revision',()=>{expect(interactionFeedbackReport(checked,'  The image button does not open the chooser.  ')).toEqual({sourceRevision:4,ok:false,errors:['The image button does not open the chooser.']});expect(interactionFeedbackReport({...checked,stage:'preview'},'x'.repeat(500)).errors[0]).toHaveLength(500)});
  it('does not spend the shared attempt on empty or oversized feedback',()=>{for(const text of ['','  ','x'.repeat(501)])expect(()=>interactionFeedbackReport(checked,text)).toThrow('1–500')});
  it('cannot request a second repair or report a running/terminal revision',()=>{expect(()=>interactionFeedbackReport({...checked,repairCount:1},'Try again')).toThrow('one repair');for(const stage of ['queued','planning','writing','validating','repairing','publishing','published','failed','cancelled']as const)expect(()=>interactionFeedbackReport({...checked,stage},'Issue')).toThrow('Wait for a preview');expect(()=>interactionFeedbackReport(null,'Issue')).toThrow('Wait for a preview')});
});
