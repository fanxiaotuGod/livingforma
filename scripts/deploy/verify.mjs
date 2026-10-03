// Read-only post-deploy smoke check; never prints environment or credential values.
const origin=process.argv[2];
if(!origin || !origin.startsWith('https://'))throw new Error('Usage: node scripts/deploy/verify.mjs https://livingforma.tech');
const checks=[];
for(const [path,validate] of [
  ['/api/health',r=>r.ok===true],
  ['/api/session',r=>r.user===null && r.mode==='production' && !r.auth.localDemoAvailable && r.auth.googleConfigured],
]) {
  const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(20000)});
  checks.push({path,ok:response.ok && validate(await response.json())});
}
const blocked=await fetch(new URL('/auth/local',origin),{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({persona:'owner'}),signal:AbortSignal.timeout(20000)});
checks.push({path:'/auth/local',ok:blocked.status===404});
const publicPage=await fetch(origin,{signal:AbortSignal.timeout(20000)});
checks.push({path:'/',ok:publicPage.ok && (publicPage.headers.get('content-type')??'').includes('text/html')});
console.log(JSON.stringify({origin,checks,passed:checks.every(c=>c.ok)},null,2));
if(checks.some(c=>!c.ok))process.exitCode=1;
