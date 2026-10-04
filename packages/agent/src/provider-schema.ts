const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const constraints=new Set(['minLength','maxLength','pattern','minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minItems','maxItems','uniqueItems']);

/** A smaller decoding grammar; the original Pi schema and host limits remain authoritative. */
export function compactProviderSchema(schema:unknown):unknown {
  if(Array.isArray(schema))return schema.map(compactProviderSchema);
  if(!object(schema))return schema;
  return Object.fromEntries(Object.entries(schema).filter(([key])=>!constraints.has(key)).map(([key,value])=>[
    key,key==='properties'&&object(value)?Object.fromEntries(Object.entries(value).map(([name,child])=>[name,compactProviderSchema(child)])):compactProviderSchema(value),
  ]));
}

/** Change only function parameter grammars. Do not copy or log prompts, headers or credentials. */
export function compactToolPayload(payload:unknown):unknown {
  if(!object(payload)||!object(payload.config)||!Array.isArray(payload.config.tools))return payload;
  return {...payload,config:{...payload.config,tools:payload.config.tools.map(tool=>{
    if(!object(tool)||!Array.isArray(tool.functionDeclarations))return tool;
    return {...tool,functionDeclarations:tool.functionDeclarations.map(declaration=>{
      if(!object(declaration)||!declaration.parametersJsonSchema)return declaration;
      return {...declaration,parametersJsonSchema:compactProviderSchema(declaration.parametersJsonSchema)};
    })};
  })}};
}
