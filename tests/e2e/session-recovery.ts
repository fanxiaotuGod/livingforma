/** LF-211 independent regression. Actual HTTP/PGlite/Chrome and explicit local identities.
 * Provider adapters are local fixtures. Only selected real responses are delayed to expose races.
 * No .env, cloud accounts, provider calls or existing application database are used.
 * Build frontend first, then: pnpm exec tsx tests/e2e/session-recovery.ts
 */
import { chromium, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp, type Planner } from '../../apps/api/src/app';
import { createDatabase } from '../../packages/db/src/index';
import { toolSpecSchema, type MediaAdapter, type Session, type Snapshot } from '../../packages/contracts/src/index';
import { planProposal } from '../../packages/agent/src/planner';

process.env.NODE_ENV = 'test'; process.env.ENABLE_LOCAL_DEMO = 'true';
const origin = 'http://localhost:4327';
const output = 'docs/qa/session-recovery';
const caseFilter = process.env.LF_QA_CASE;
await mkdir(output, { recursive: true });
const fixtureAudio = new Uint8Array(await readFile('docs/frontend/browser-evidence/media-fixture-tone.mp3'));
const counts = { planner: 0, tool: 0, describe: 0, transcribe: 0, speech: 0 };
const requests: { method: string; path: string; status: number }[] = [];
const spec = toolSpecSchema.parse({ toolId: 'qa_lookup', toolVersion: 1, name: 'QA lookup', description: 'Local test adapter only', endpointId: 'qa_fixture', method: 'GET', sideEffects: 'none', parameters: [{ name: 'q', type: 'string', required: true }], responseMap: { title: 'title' }, timeoutMs: 10000 });
const planner: Planner = async input => {
  counts.planner++;
  if (input.prompt.includes('QA pending capability')) {
    const proposal = await planProposal({ ...input, prompt: 'Change the palette to sage', mode: 'local' });
    return { ...proposal, toolProposals: [spec] };
  }
  return planProposal({ ...input, mode: 'local' });
};
const media: MediaAdapter = {
  capabilities: () => ({ canTranscribe: true, canObserve: true, canSpeak: true }),
  transcribe: async () => { counts.transcribe++; return { text: 'Private fixture transcript', durationMs: 1 }; },
  describe: async () => { counts.describe++; return { text: 'Private fixture observation', durationMs: 1 }; },
  speak: async () => { counts.speech++; return { audio: fixtureAudio, mimeType: 'audio/mpeg', durationMs: 1 }; },
};
const db = await createDatabase();
let api!: Awaited<ReturnType<typeof buildApp>>;
async function startApi() {
  // A fresh API instance gives each scenario its own real rate limiter and media controller.
  api = await buildApp({ db, closeDatabase: false, origin, localDemo: true, planner, plannerMode: 'local',
    tools: { validate: input => toolSpecSchema.parse(input), test: async () => ({ ok: true, message: 'Local fixture' }), invoke: async () => { counts.tool++; return { title: 'Private fixture tool result' }; } },
    media, staticDir: resolve('apps/web/dist') });
  // buildApp has already booted Fastify; observe actual HTTP without adding a late plugin.
  api.app.server.on('request', (request, reply) => { if (request.method !== 'GET') reply.once('finish', () => requests.push({ method: request.method!, path: request.url!, status: reply.statusCode })); });
  await api.app.listen({ host: '127.0.0.1', port: 4327 });
}
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const checks: { name: string; status: 'pass' | 'fail'; detail?: string; counts?: typeof counts }[] = [];
const errors: string[] = [];
const releaseAll = new Set<() => void>();
function deferred() { let release!: () => void; const promise = new Promise<void>(r => { release = r; }); return { promise, release }; }
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 12000); })]); }
  finally { clearTimeout(timer!); }
}
async function identity(context: BrowserContext): Promise<Session> { return (await context.request.get(`${origin}/api/session`)).json(); }
async function rotate(context: BrowserContext, persona: 'owner' | 'participant') { const response = await context.request.post(`${origin}/auth/local`, { headers: { origin }, data: { persona } }); expect(response.status()).toBe(200); }
async function signOut(context: BrowserContext) { const session = await identity(context); const response = await context.request.post(`${origin}/auth/logout`, { headers: { origin, 'x-csrf-token': session.csrfToken! } }); expect(response.status()).toBe(200); }
const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus')));
const orb = (page: Page) => page.getByRole('button', { name: 'Open the space designer' });
const draft = (page: Page) => page.getByRole('textbox', { name: 'Describe how to change your space' });
async function openDraft(page: Page, text?: string) { await orb(page).click(); await expect(draft(page)).toBeVisible(); if (text !== undefined) await draft(page).fill(text); }
async function snapshot(context: BrowserContext, slug: string): Promise<Snapshot> { return (await context.request.get(`${origin}/api/spaces/${slug}/snapshot`)).json(); }
function posts(path: string) { return requests.filter(r => r.method === 'POST' && r.path === path); }
function delayResponse(page: Page, path: string, options: { method?: string; once?: boolean } = {}) {
  const entered = deferred(), resume = deferred(); let matched = false;
  releaseAll.add(resume.release);
  const handler = async (route: Route) => {
    if ((options.method && route.request().method() !== options.method) || (options.once !== false && matched)) return route.continue();
    matched = true;
    const response = await route.fetch(); entered.release(); await resume.promise;
    try { await route.fulfill({ response }); } catch { /* Cancelling the original fetch is valid. */ }
  };
  return { entered: () => bounded(entered.promise, `actual response ${path}`), release: resume.release, install: () => page.route(`${origin}${path}`, handler), remove: () => page.unroute(`${origin}${path}`, handler) };
}
let sequence = 0;
async function setup(options: { private?: boolean; tool?: boolean; camera?: boolean } = {}) {
  await startApi();
  const n = ++sequence, slug = `z-qa-session-${n}`;
  const state = structuredClone((await api.store.getSpace('reading'))!);
  state.space = { ...state.space, id: `sp_qa_session_${n}`, slug, title: `Session QA ${n}`, visibility: options.private ? 'private' : 'public' };
  state.definition!.appSpec.title = state.space.title;
  state.eventCursor = 0; state.stateVersion = 0;
  state.records[0]!.values.title = options.private ? 'PRIVATE_QA_BOOK' : `Retained QA book ${n}`;
  if (options.tool) {
    state.definition!.appSpec.actions.push({ id: 'qa_query', type: 'tool.invoke', label: 'Look up' });
    state.definition!.appSpec.components.unshift({ id: 'qa-tool', type: 'tool-result', version: 1, variant: 'default', fields: [], actionIds: ['qa_query'], toolRef: { toolId: spec.toolId, toolVersion: 1 }, span: 'full' });
  }
  if (options.camera) state.definition!.appSpec.components.unshift({ id: 'qa-camera', type: 'camera', version: 1, variant: 'default', fields: [], actionIds: [], span: 'full' });
  await api.store.insertSpace(state);
  if (options.tool) await api.store.putTool(state.space.id, { spec, enabled: true, verifiedAt: new Date().toISOString(), invocationCount: 0 }, api.store.db);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['camera', 'microphone'] });
  await context.addInitScript(() => {
    const observed: { calls: number; tracks: MediaStreamTrack[]; plays: number; audio: HTMLAudioElement[] } = { calls: 0, tracks: [], plays: 0, audio: [] };
    (window as any).__qaMedia = observed;
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => { observed.calls++; const stream = await get(options); observed.tracks.push(...stream.getTracks()); return stream; };
    const NativeAudio = window.Audio;
    window.Audio = function (...args: any[]) { const audio = new NativeAudio(...args); observed.audio.push(audio); audio.addEventListener('playing', () => observed.plays++); return audio; } as any;
  });
  await rotate(context, 'owner');
  const page = await context.newPage(); page.setDefaultTimeout(9000); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/s/${slug}`);
  try { await expect(orb(page)).toBeVisible({ timeout: 9000 }); }
  catch (error) { await page.screenshot({ path: `${output}/setup-failed-${n}.png`, fullPage: true }); await writeFile(`${output}/setup-failed-${n}.json`, JSON.stringify({ url: page.url(), body: await page.locator('body').innerText(), sessionUser: (await identity(context)).user?.id }, null, 2)); await context.close(); throw error; }
  return { context, page, slug, state, path: `/api/spaces/${slug}/proposals` };
}
type Fixture = Awaited<ReturnType<typeof setup>>;
async function check(name: string, fn: (fixture: Fixture) => Promise<void>, options: Parameters<typeof setup>[0] = {}) {
  if (caseFilter && !name.includes(caseFilter)) return;
  let fixture: Fixture | undefined;
  const before = { ...counts };
  try { fixture = await setup(options); await fn(fixture); checks.push({ name, status: 'pass', counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v - before[k as keyof typeof counts]])) as typeof counts }); console.log('PASS', name); }
  catch (error) { const detail = (error as Error).message; checks.push({ name, status: 'fail', detail }); console.log('FAIL', name, detail); if (fixture) await fixture.page.screenshot({ path: `${output}/failed-${sequence}.png`, fullPage: true }).catch(() => {}); }
  finally { for (const release of releaseAll) release(); releaseAll.clear(); await fixture?.context.close(); await api?.app.close(); }
}

try {
  await check('Same-owner cookie rotation refreshes CSRF and publishes exactly once', async ({ context, page, slug, path }) => {
    const before = await snapshot(context, slug), initialCalls = counts.planner;
    await openDraft(page, 'Change the palette to sage'); await rotate(context, 'owner');
    await page.getByRole('button', { name: 'Apply changes' }).click();
    await expect.poll(async () => (await snapshot(context, slug)).definition?.definitionVersion).toBe(2);
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'sage');
    expect(posts(path)).toHaveLength(1); expect(posts(path)[0]!.status).toBe(200); expect(counts.planner - initialCalls).toBe(1);
    expect((await snapshot(context, slug)).records).toEqual(before.records); expect(page.url()).toBe(`${origin}/s/${slug}`);
    await openDraft(page); await expect(draft(page)).toHaveValue('');
  });

  for (const next of ['participant', 'anonymous'] as const) await check(`Changed identity to ${next} sends zero proposal POSTs and preserves account-scoped draft`, async ({ context, page, path }) => {
    const text = `Owner draft must survive ${next}`; await openDraft(page, text);
    if (next === 'anonymous') await signOut(context); else await rotate(context, next);
    await page.getByRole('button', { name: 'Apply changes' }).click();
    await expect(orb(page)).toHaveCount(0); expect(posts(path)).toHaveLength(0);
    expect(await page.locator('body').innerText()).not.toContain(text);
    await rotate(context, 'owner'); await focus(page); await expect(orb(page)).toBeVisible(); await openDraft(page); await expect(draft(page)).toHaveValue(text);
  });

  await check('A GET-to-POST rotation race returns real CSRF 403 with no automatic replay', async ({ context, page, path }) => {
    let raced = false; const initialCalls = counts.planner;
    await page.route(`${origin}${path}`, async route => {
      if (raced) return route.continue(); raced = true;
      await rotate(context, 'owner');
      const cookie = (await context.cookies(origin)).map(c => `${c.name}=${c.value}`).join('; ');
      const response = await route.fetch({ headers: { ...route.request().headers(), cookie } });
      expect(response.status()).toBe(403); await route.fulfill({ response });
    });
    const text = 'Change the palette to rose'; await openDraft(page, text); await page.getByRole('button', { name: 'Apply changes' }).click();
    await expect.poll(() => posts(path).length).toBe(1); await expect(page.locator('.owner-orb')).not.toHaveClass(/is-working/);
    await page.waitForTimeout(300); expect(posts(path)).toHaveLength(1); expect(counts.planner - initialCalls).toBe(0);
    if (!(await draft(page).isVisible())) await openDraft(page); await expect(draft(page)).toHaveValue(text);
    await page.getByRole('button', { name: 'Apply changes' }).click(); await expect.poll(() => posts(path).length).toBe(2);
    expect(posts(path).map(p => p.status)).toEqual([403, 200]); expect(counts.planner - initialCalls).toBe(1);
  });

  await check('Delayed proposal completion after navigating away cannot clear its original draft', async ({ page, slug, path }) => {
    const delayed = delayResponse(page, path, { method: 'POST' }); await delayed.install();
    const text = 'Change the palette to sage'; await openDraft(page, text); await page.getByRole('button', { name: 'Apply changes' }).click(); await delayed.entered();
    await page.getByRole('link', { name: 'Between the lines', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/s/reading`); delayed.release(); await page.waitForTimeout(200);
    expect(page.url()).toBe(`${origin}/s/reading`); await page.goto(`${origin}/s/${slug}`); await openDraft(page); await expect(draft(page)).toHaveValue(text);
  });

  await check('Delayed tool approval proposal cannot reopen or reveal output to a changed identity', async ({ context, page, path }) => {
    const delayed = delayResponse(page, path, { method: 'POST' }); await delayed.install();
    await openDraft(page, 'QA pending capability'); await page.getByRole('button', { name: 'Apply changes' }).click(); await delayed.entered();
    await rotate(context, 'participant'); await focus(page); await expect(orb(page)).toHaveCount(0); delayed.release(); await page.waitForTimeout(200);
    await expect(page.getByRole('button', { name: 'Enable tool' })).toHaveCount(0); expect(await page.locator('body').innerText()).not.toContain('Local test adapter only');
    await rotate(context, 'owner'); await focus(page); await openDraft(page); await expect(draft(page)).toHaveValue('QA pending capability');
  });

  await check('Delayed create response cannot navigate or clear the previous account create draft', async ({ context, page, slug }) => {
    const delayed = delayResponse(page, '/api/spaces', { method: 'POST' }); await delayed.install();
    await page.getByRole('button', { name: 'Create a new space' }).click();
    await page.getByLabel('Give it a name').fill('Owner private creation draft');
    await page.getByLabel('What would you like to keep here? (optional)').fill('Create a habit tracker with daily check-ins');
    await page.getByRole('button', { name: 'Create my space' }).click(); await delayed.entered();
    await rotate(context, 'participant'); await focus(page); await expect(orb(page)).toHaveCount(0); delayed.release(); await page.waitForTimeout(200);
    expect(page.url()).toBe(`${origin}/s/${slug}`); expect(await page.locator('body').innerText()).not.toContain('Owner private creation draft');
    await rotate(context, 'owner'); await focus(page); await page.getByRole('button', { name: 'Create a new space' }).click();
    await expect(page.getByLabel('Give it a name')).toHaveValue('Owner private creation draft');
  });

  await check('Older delayed identity GET cannot restore Owner after a newer preflight sees Participant', async ({ context, page, path }) => {
    await openDraft(page, 'Change the palette to rose');
    const delayed = delayResponse(page, '/api/session'); await delayed.install(); await focus(page); await delayed.entered();
    await rotate(context, 'participant'); await page.getByRole('button', { name: 'Apply changes' }).click();
    await expect(orb(page)).toHaveCount(0); delayed.release(); await page.waitForTimeout(200);
    await expect(orb(page)).toHaveCount(0); expect(posts(path)).toHaveLength(0); await expect(page.getByTitle('Local Participant', { exact: true })).toBeVisible();
  });

  await check('Identity change clears a private Owner view even when the new snapshot is 404', async ({ context, page, slug }) => {
    await expect(page.getByRole('button', { name: 'View PRIVATE_QA_BOOK', exact: true })).toBeVisible();
    await rotate(context, 'participant'); await focus(page);
    await expect(orb(page)).toHaveCount(0); await expect(page.getByRole('button', { name: 'View PRIVATE_QA_BOOK', exact: true })).toHaveCount(0);
    expect((await context.request.get(`${origin}/api/spaces/${slug}/snapshot`)).status()).toBe(404);
    expect(await page.locator('body').innerText()).not.toContain('PRIVATE_QA_BOOK');
  }, { private: true });

  await check('Tool invocation refreshes same-owner CSRF once and suppresses a late cross-account result', async ({ context, page, slug }) => {
    const path = `/api/spaces/${slug}/tools/${spec.toolId}/invoke`;
    await page.getByLabel('Book title or author').fill('A local fixture'); await rotate(context, 'owner');
    const delayed = delayResponse(page, path, { method: 'POST' }); await delayed.install();
    await page.getByRole('button', { name: 'QA lookup', exact: true }).click(); await delayed.entered();
    expect(posts(path)).toHaveLength(1); expect(posts(path)[0]!.status).toBe(200);
    await rotate(context, 'participant'); await focus(page); await expect(orb(page)).toHaveCount(0); delayed.release(); await page.waitForTimeout(200);
    expect(await page.locator('body').innerText()).not.toContain('Private fixture tool result');
  }, { tool: true });

  await check('Session rotation stops the camera and ignores a delayed real-host media response', async ({ context, page, slug }) => {
    await page.getByRole('button', { name: 'Start camera', exact: true }).click();
    await expect(page.getByText('Local preview', { exact: true })).toBeVisible();
    await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
    const delayed = delayResponse(page, `/api/spaces/${slug}/media/sessions/*/observe`, { method: 'POST' }); await delayed.install();
    await page.getByRole('button', { name: 'Describe this view', exact: true }).click(); await delayed.entered();
    await rotate(context, 'owner'); await focus(page);
    await expect.poll(() => page.evaluate(() => (window as any).__qaMedia.tracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
    delayed.release(); await page.waitForTimeout(250);
    const devices = await page.evaluate(() => { const d = (window as any).__qaMedia; return { calls: d.calls, plays: d.plays, tracks: d.tracks.map((t: MediaStreamTrack) => t.readyState), audio: d.audio.map((a: HTMLAudioElement) => ({ paused: a.paused, src: a.getAttribute('src') })) }; });
    expect(devices.calls).toBe(1); expect(devices.plays).toBe(0); expect(devices.tracks).toEqual(['ended']);
    expect(devices.audio.every((a: { paused: boolean; src: string | null }) => a.paused && !a.src)).toBe(true);
    expect(await page.locator('body').innerText()).not.toContain('Private fixture observation');
    await writeFile(`${output}/media-stop.json`, JSON.stringify(devices, null, 2));
  }, { camera: true });

  await check('Participant record creation and habit check-in still work after session rotation', async ({ context, page, slug }) => {
    await rotate(context, 'participant'); await page.reload(); await expect(orb(page)).toHaveCount(0);
    const form = page.locator('[data-component-id="add-book"]'); await form.getByLabel(/^Title/).fill('Participant recovered write');
    await rotate(context, 'participant'); await form.locator('button[type=submit]').click();
    await expect(page.getByRole('button', { name: 'View Participant recovered write', exact: true })).toBeVisible(); expect(posts(`/api/spaces/${slug}/actions`)).toHaveLength(1);
    await page.goto(`${origin}/s/habits`); const button = page.locator('.checkin-button').first(); await expect(button).toBeVisible(); const before = await button.getAttribute('aria-pressed');
    await rotate(context, 'participant'); await button.click(); await expect(button).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  });

  await check('Logout after same-owner rotation submits once and leaves anonymous public browsing', async ({ context, page }) => {
    const before = posts('/auth/logout').length;
    await rotate(context, 'owner'); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible(); await expect(orb(page)).toHaveCount(0);
    expect(posts('/auth/logout').length - before).toBe(1); expect((await identity(context)).user).toBeNull();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  await check('A stale Owner logout cannot sign out a newly active Participant account', async ({ context, page }) => {
    const before = posts('/auth/logout').length;
    await rotate(context, 'participant'); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByTitle('Local Participant', { exact: true })).toBeVisible(); await expect(orb(page)).toHaveCount(0);
    expect(posts('/auth/logout').length - before).toBe(0); expect((await identity(context)).user?.id).toBe('user-local-participant');
  });

  await check('Parallel same-user form and tool intents both complete when their session reads arrive out of order', async ({ page, slug }) => {
    const actions = `/api/spaces/${slug}/actions`, invoke = `/api/spaces/${slug}/tools/${spec.toolId}/invoke`;
    const form = page.locator('[data-component-id="add-book"]'); await form.getByLabel(/^Title/).fill('Parallel retained book');
    await page.getByLabel('Book title or author').fill('Parallel local query');
    const delayed = delayResponse(page, '/api/session'); await delayed.install();
    await form.locator('button[type=submit]').click(); await delayed.entered(); expect(posts(actions)).toHaveLength(0);
    await page.getByRole('button', { name: 'QA lookup', exact: true }).click();
    await expect.poll(() => posts(invoke).length).toBe(1); expect(posts(invoke)[0]!.status).toBe(200);
    delayed.release(); await expect(page.getByRole('button', { name: 'View Parallel retained book', exact: true })).toBeVisible();
    expect(posts(actions)).toHaveLength(1); expect(posts(actions)[0]!.status).toBe(200);
  }, { tool: true });

  await check('Same-identity private membership revocation clears the inaccessible view after real 404', async ({ context, page, slug }) => {
    await api.store.db.transaction(async tx => {
      const state = (await api.store.getSpace(slug, tx, true))!;
      state.members = ['user-local-participant']; await api.store.saveSpace(state, tx);
    });
    await rotate(context, 'participant'); await page.reload();
    await expect(page.getByRole('button', { name: 'View PRIVATE_QA_BOOK', exact: true })).toBeVisible();
    const before = await identity(context);
    await api.store.db.transaction(async tx => {
      const state = (await api.store.getSpace(slug, tx, true))!;
      state.members = []; await api.store.saveSpace(state, tx);
    });
    expect((await context.request.get(`${origin}/api/spaces/${slug}/snapshot`)).status()).toBe(404);
    await focus(page);
    await expect(page.getByRole('button', { name: 'View PRIVATE_QA_BOOK', exact: true })).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('PRIVATE_QA_BOOK');
    const after = await identity(context);
    expect(after.user?.id).toBe(before.user?.id); expect(after.csrfToken).toBe(before.csrfToken);
    await expect(page.getByRole('heading', { name: 'A little pause.', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconnect', exact: false })).toBeVisible();
    await page.screenshot({ path: `${output}/membership-revocation.png`, fullPage: true });
  }, { private: true });

  expect(checks.length, 'At least one selected scenario executed').toBeGreaterThan(0);
  expect(errors, 'No browser JavaScript errors').toEqual([]);
} finally {
  for (const release of releaseAll) release();
  await writeFile(`${output}/${caseFilter ? 'targeted-results' : 'results'}.json`, JSON.stringify({ at: new Date().toISOString(), scope: 'Independent local HTTP/PGlite/Chrome, explicit local identity rotation, local provider fixtures. Selected real HTTP responses delayed for races. No real Google/cloud/provider claims.', checks, pageErrors: errors, totals: counts }, null, 2));
  await browser.close(); await api?.app.close(); await db.close();
}
if (checks.some(check => check.status === 'fail') || errors.length) process.exitCode = 1;
