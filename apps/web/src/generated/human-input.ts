import {GENERATED_BRIDGE_LIMITS} from '@livingforma/contracts';
export type HumanChoiceResult<T>={status:'selected';value:T}|{status:'cancelled'|'expired'};
export type HumanChoice<T>={result:Promise<HumanChoiceResult<T>>;choose:(value:T)=>void;cancel:()=>void};
/** One deadline and one settlement: a delayed native picker cannot revive a choice. */
export function createHumanChoice<T>():HumanChoice<T>{
  let settled=false,complete!:(result:HumanChoiceResult<T>)=>void;
  const deadline=Date.now()+GENERATED_BRIDGE_LIMITS.humanChoiceMs;
  const result=new Promise<HumanChoiceResult<T>>(resolve=>{complete=resolve});
  const settle=(value:HumanChoiceResult<T>)=>{if(settled)return;settled=true;clearTimeout(timer);complete(value)};
  const timer=setTimeout(()=>settle({status:'expired'}),GENERATED_BRIDGE_LIMITS.humanChoiceMs);
  return {result,choose:value=>settle(Date.now()>=deadline?{status:'expired'}:{status:'selected',value}),cancel:()=>settle({status:'cancelled'})};
}
