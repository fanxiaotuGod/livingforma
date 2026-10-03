import { writeFile } from 'node:fs/promises';
import { planProposal, toolAdapter, OPEN_LIBRARY_SPEC, getLastRunEvidence, registeredPiTool, proposeTool } from '../src/index';
import { runGeminiTools } from '../src/pi-runtime';
import type { Definition } from '@livingforma/contracts';
const mode=process.argv[2]??'reading';
const evidence:Record<string,unknown>={at:new Date().toISOString(),mode};
if(mode==='reading'||mode==='habits'||mode==='patch'){
 const current:Definition|null=mode==='patch'?(await import('@livingforma/contracts')).readingDefinition():null;
 const prompt=mode==='reading'?'Create a personal reading app with author, status, progress, a beautiful bookshelf and an add form.':mode==='habits'?'Create a daily habit app with a check-in calendar, streaks, and categories for wellbeing and learning.':'Add an optional 0–5 rating, sort books by rating descending, highlight Reading, and use the ink skin. Preserve all existing fields.';
 const proposal=await planProposal({prompt,current,mode:'gemini'});Object.assign(evidence,{source:proposal.source,title:proposal.appSpec.title,fields:proposal.entitySchema.fields.map(f=>f.id),components:proposal.appSpec.components.map(c=>({id:c.id,type:c.type,sort:c.sort})),capabilityGaps:proposal.capabilityGaps,run:getLastRunEvidence()});
}else if(mode==='tool'){
 const proposed=await proposeTool({prompt:'I want to look up book titles and authors from Open Library.',mode:'gemini'});evidence.proposal={...proposed,spec:proposed.spec?.toolId};evidence.proposalRun=getLastRunEvidence();
 const tested=await toolAdapter.test(OPEN_LIBRARY_SPEC);evidence.liveTest=tested;if(!tested.ok)throw new Error('Live tool test failed.');
 const result=await toolAdapter.invoke(OPEN_LIBRARY_SPEC,{q:'Pride and Prejudice'});evidence.directPi={bookCount:(result.books as unknown[]).length,source:result.source};
 let completed=false;let observed:Record<string,unknown>|undefined;
 const registered=registeredPiTool(OPEN_LIBRARY_SPEC,async(input,signal)=>{observed=await toolAdapter.invoke(OPEN_LIBRARY_SPEC,input,signal);completed=true;return observed;});
 evidence.registeredGeminiRun=await runGeminiTools({prompt:'Search for Pride and Prejudice using the registered Open Library tool.',system:'Call the registered book lookup once with q exactly Pride and Prejudice. This is an explicit Owner-authorized read-only lookup. Do not invent results.',tools:[registered],complete:()=>completed});
 evidence.registeredGeminiResult={bookCount:(observed?.books as unknown[])?.length,source:observed?.source};
}
console.log(JSON.stringify(evidence,null,2));
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(evidence,null,2)+'\n');
