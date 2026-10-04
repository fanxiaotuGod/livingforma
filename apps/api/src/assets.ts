import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AuthApi } from '@livingforma/auth';
import type { Store, SpaceState, SqlConnection } from '@livingforma/db';
import { assertRead, fail, projection } from './domain';

const MAX_BYTES=512*1024, SPACE_BYTES=20*1024*1024;
const uploadSchema=z.object({mimeType:z.enum(['image/png','image/jpeg','image/webp']),dataBase64:z.string().min(1).max(Math.ceil(MAX_BYTES/3)*4)}).strict();
const invalid=()=>fail(422,'INVALID_IMAGE','Choose a valid PNG, JPEG or WebP image, at most 4096 pixels per side.');
export function validateRaster(mimeType:string,encoded:string){
  if(encoded.length>Math.ceil(MAX_BYTES/3)*4)fail(413,'IMAGE_TOO_LARGE','Images can be at most 512 KiB.');
  if(encoded.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))invalid();
  const b=Buffer.from(encoded,'base64');if(!b.length||b.length>MAX_BYTES||b.toString('base64')!==encoded)invalid();
  let width=0,height=0;
  if(mimeType==='image/png'){
    if(b.length<45||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.readUInt32BE(8)!==13||b.toString('ascii',12,16)!=='IHDR')invalid();
    width=b.readUInt32BE(16);height=b.readUInt32BE(20);let offset=8,ended=false,hasData=false;
    while(offset+12<=b.length){const size=b.readUInt32BE(offset),type=b.toString('ascii',offset+4,offset+8);if(size>b.length-offset-12)invalid();if(type==='IDAT')hasData=true;offset+=size+12;if(type==='IEND'){if(size||offset!==b.length)invalid();ended=true;break;}}
    if(!ended||!hasData)invalid();
  }else if(mimeType==='image/jpeg'){
    if(b.length<16||b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)invalid();
    let offset=2,hasScan=false;
    while(offset+4<=b.length){if(b[offset++]!==255)invalid();while(b[offset]===255)offset++;const marker=b[offset++];if(marker===217)break;if(marker===1||(marker!>=208&&marker!<=215))continue;if(offset+2>b.length)invalid();const length=b.readUInt16BE(offset);if(length<2||offset+length>b.length)invalid();if(marker===218){hasScan=true;break;}if([192,193,194].includes(marker!)){if(length<8||!b[offset+7]||length!==8+3*b[offset+7]!)invalid();const h=b.readUInt16BE(offset+3),w=b.readUInt16BE(offset+5);if(!h||!w||h>4096||w>4096||(width&&(width!==w||height!==h)))invalid();height=h;width=w;}offset+=length;}
    if(!hasScan)invalid();
  }else if(mimeType==='image/webp'){
    if(b.length<26||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP'||b.readUInt32LE(4)!==b.length-8)invalid();
    let offset=12,canvasWidth=0,canvasHeight=0,images=0;
    while(offset+8<=b.length){const kind=b.toString('ascii',offset,offset+4),size=b.readUInt32LE(offset+4),data=offset+8;if(size>b.length-data)invalid();
      if(kind==='VP8X'){if(size!==10||(b[data]!&2))invalid();canvasWidth=1+b.readUIntLE(data+4,3);canvasHeight=1+b.readUIntLE(data+7,3);if(canvasWidth>4096||canvasHeight>4096)invalid();}
      else if(kind==='VP8L'){if(size<5||b[data]!==47)invalid();const bits=b.readUInt32LE(data+1);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;images++;}
      else if(kind==='VP8 '){if(size<10||b.subarray(data+3,data+6).toString('hex')!=='9d012a')invalid();width=b.readUInt16LE(data+6)&0x3fff;height=b.readUInt16LE(data+8)&0x3fff;images++;}
      else if(kind==='ANIM'||kind==='ANMF')invalid();
      offset=data+size+(size%2);
    }
    if(offset!==b.length||images!==1||(canvasWidth&&(width!==canvasWidth||height!==canvasHeight)))invalid();
  }else invalid();
  if(!width||!height||width>4096||height>4096)invalid();return b.length;
}

export async function assertArtifactAssets(store:Store,state:SpaceState,ids:string[],tx:SqlConnection=store.db){
  for(const id of ids)if(!(await tx.query('SELECT id FROM lf_assets WHERE id=$1 AND space_id=$2',[id,state.space.id])).rows.length)fail(422,'ASSET_NOT_FOUND','A referenced image does not belong to this space.');
}
export function registerAssets(app:FastifyInstance,{store,auth}:{store:Store;auth:AuthApi}){
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/assets',{bodyLimit:Math.ceil(MAX_BYTES/3)*4+1024,config:{rateLimit:{max:12,timeWindow:'1 minute'}}},async(request,reply)=>{
    const user=await auth.requireUser(request);await auth.verifyCsrf(request);const input=uploadSchema.parse(request.body);const bytes=validateRaster(input.mimeType,input.dataBase64);
    const result=await store.db.transaction(async tx=>{
      const state=await store.getSpace(request.params.slug,tx,true);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');assertRead(state,user);
      // Empty owner spaces can collect explicit assets before their first generated definition.
      if(state.ownerId!==user.id&&!projection(state,user).permissions.canWrite)fail(403,'WRITE_FORBIDDEN','You cannot add images to this space.');
      const size=Number((await tx.query<{bytes:string}>('SELECT COALESCE(SUM(bytes),0) AS bytes FROM lf_assets WHERE space_id=$1',[state.space.id])).rows[0]!.bytes);
      if(size+bytes>SPACE_BYTES)fail(413,'ASSET_QUOTA','This space has reached its 20 MiB image allowance.');
      const assetId=`asset_${randomUUID()}`;await tx.query('INSERT INTO lf_assets(id,space_id,user_id,mime_type,bytes,data_base64) VALUES($1,$2,$3,$4,$5,$6)',[assetId,state.space.id,user.id,input.mimeType,bytes,input.dataBase64]);return {assetId,dataUrl:`data:${input.mimeType};base64,${input.dataBase64}`};
    });return reply.code(201).send(result);
  });
  app.get<{Params:{slug:string;id:string}}>('/api/spaces/:slug/assets/:id',async request=>{
    const {user}=await auth.getSession(request);const state=await store.getSpace(request.params.slug);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');assertRead(state,user);
    const asset=(await store.db.query<{id:string;user_id:string;mime_type:string;data_base64:string}>('SELECT id,user_id,mime_type,data_base64 FROM lf_assets WHERE id=$1 AND space_id=$2',[request.params.id,state.space.id])).rows[0];
    if(!asset)fail(404,'ASSET_NOT_FOUND','This image is not available.');
    if(user?.id!==state.ownerId&&user?.id!==asset.user_id){
      const fields=new Set(state.definition?.entitySchema.fields.filter(f=>f.public).map(f=>f.id));
      const referenced=state.records.some(record=>Object.entries(record.values).some(([key,value])=>fields.has(key)&&value===asset.id));
      const artifact=(await store.db.query("SELECT version FROM lf_definition_versions WHERE space_id=$1 AND data->'appSpec'->'generated'->'assetIds' ? $2 LIMIT 1",[state.space.id,asset.id])).rows.length>0;
      if(!referenced&&!artifact)fail(404,'ASSET_NOT_FOUND','This image has not been published.');
    }
    return {assetId:asset.id,dataUrl:`data:${asset.mime_type};base64,${asset.data_base64}`};
  });
}
