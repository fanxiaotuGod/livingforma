import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { MEDIA_LIMITS, readingDefinition, exampleRecords } from '../../../packages/contracts/src/index';
import { validateJpeg, validateWav } from '../../../packages/agent/src/media';
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 1050 }, permissions: ['camera', 'microphone'], reducedMotion: 'reduce' });
const page = await context.newPage(); page.setDefaultTimeout(10000);
const errors: string[] = [], checks: string[] = [], wavEvidence: unknown[] = [], frameEvidence: unknown[] = [];
let sessionCount = 0, deletes = 0, transcripts = 0, observations = 0, proposals = 0, holdVoice = false, holdScene = false;
let releaseVoice: (() => void) | null = null, releaseScene: (() => void) | null = null;
const sound = (await readFile('docs/frontend/browser-evidence/media-fixture-tone.mp3')).toString('base64');
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  const state = window as any; state.__streams = []; state.__deviceCalls = 0; state.__audioPlays = 0; state.__audioElements = []; state.__revokeCount = 0;
  const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async constraints => {
    state.__deviceCalls++;
    if (state.__denyNext) { state.__denyNext = false; throw new DOMException('Fixture permission denied', 'NotAllowedError'); }
    const stream = await get(constraints); state.__streams.push(stream); return stream;
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { if (this instanceof HTMLAudioElement) { state.__audioPlays++; state.__audioElements.push(this); } return play.call(this); };
  const revoke = URL.revokeObjectURL.bind(URL); URL.revokeObjectURL = url => { state.__revokeCount++; revoke(url); };
});
await page.route('**/__media-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@fs/Users/fanhaocheng/project/livingforma/docs/frontend/browser-evidence/media-harness.tsx"></script></body></html>` }));
await page.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  const body = request.method() === 'POST' ? request.postDataJSON() : {};
  try {
    if (path.endsWith('/media')) return await route.fulfill({ json: { canTranscribe: true, canObserve: true, canSpeak: true, limits: MEDIA_LIMITS } });
    if (request.method() === 'DELETE') { deletes++; return await route.fulfill({ status: 204 }); }
    if (path.endsWith('/sessions')) return await route.fulfill({ json: { id: `fixture-${++sessionCount}`, kind: body.kind, expiresAt: new Date(Date.now() + 300000).toISOString(), limits: MEDIA_LIMITS } });
    if (path.endsWith('/transcribe')) {
      transcripts++;
      const audio = Buffer.from(body.audioBase64, 'base64'), valid = validateWav(audio, body.mimeType);
      wavEvidence.push({ bytes: audio.length, ...valid, hasClientDuration: 'durationMs' in body, sequence: body.sequence });
      const held = holdVoice; if (held) await new Promise<void>(resolve => { releaseVoice = resolve; });
      return await route.fulfill({ json: { sequence: body.sequence, text: held ? 'Late transcript must never appear' : 'Add a rating field and sort by rating', durationMs: 120 } });
    }
    if (path.endsWith('/observe')) {
      observations++; const image = Buffer.from(body.imageBase64, 'base64'); validateJpeg(image, body.mimeType);
      frameEvidence.push({ bytes: image.length, sequence: body.sequence, capturedAt: body.capturedAt });
      const held = holdScene; if (held) await new Promise<void>(resolve => { releaseScene = resolve; });
      return await route.fulfill({ json: { sequence: body.sequence, capturedAt: body.capturedAt, text: held ? 'Late scene must never appear' : `Fixture scene ${observations}: a quiet desk and an open book.`, visionMs: 15, speechMs: 10, audioBase64: sound, audioMimeType: 'audio/mpeg' } });
    }
    if (path.endsWith('/proposals')) {
      proposals++; const definition = readingDefinition();
      return await route.fulfill({ json: { snapshot: { definition, records: exampleRecords('reading') }, proposal: { ...definition, source: 'local-rules', capabilityGaps: [] } } });
    }
    return await route.fulfill({ status: 404, json: { error: { message: 'Only fixture media routes are available.' } } });
  } catch (error) { if (!String(error).includes('Target page') && !String(error).includes('Invalid InterceptionId')) throw error; }
});
async function check(name: string, fn: () => Promise<void>) { await fn(); checks.push(name); console.log('PASS', name); }
async function noTracks() { await page.waitForFunction(() => (window as any).__streams.every((stream: MediaStream) => stream.getTracks().every(track => track.readyState === 'ended'))); }
async function openVoice() { await page.getByRole('button', { name: 'Open the space designer' }).click(); await page.getByRole('button', { name: 'Speak your idea' }).waitFor({ state: 'visible' }); }
async function record() { await page.getByRole('button', { name: 'Speak your idea' }).click(); await page.getByRole('button', { name: /Finish recording/ }).waitFor(); await page.waitForTimeout(750); }
async function startCamera() { await page.getByRole('button', { name: 'Start camera', exact: true }).click(); await page.waitForFunction(() => (document.querySelector('video')?.videoWidth || 0) > 0); }
try {
  await page.goto('http://localhost:5173/__media-fixture');
  await check('Mount and incoming definition changes never start devices', async () => { await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor(); await page.getByRole('button', { name: 'Simulate incoming definition' }).click(); if (await page.evaluate(() => (window as any).__deviceCalls) !== 0) throw Error('Device started without gesture'); });
  await check('Real browser recording resamples to server-accepted WAV and becomes a draft only', async () => { await openVoice(); await record(); await page.getByRole('button', { name: /Finish recording/ }).click(); await page.getByText('Added to your draft. Review it, then apply your changes.').waitFor(); await noTracks(); if (proposals !== 0) throw Error('Transcription auto-applied'); if (!await page.getByRole('textbox', { name: 'Describe how to change your space' }).inputValue()) throw Error('Transcript missing'); if (!wavEvidence.length) throw Error('No WAV was parsed'); await page.screenshot({ path: 'docs/frontend/browser-evidence/voice-draft.png' }); await page.getByRole('button', { name: 'Apply changes' }).click(); if (proposals !== 1) throw Error('Explicit Apply did not reach proposal endpoint'); });
  await check('Cancel recording releases tracks and never transcribes', async () => { await openVoice(); await page.getByRole('textbox', { name: 'Describe how to change your space' }).fill('Unsent text stays here'); const previous = transcripts; await record(); await page.getByRole('button', { name: 'Cancel voice recording' }).click(); await noTracks(); if (transcripts !== previous) throw Error('Cancel sent audio'); });
  await check('Closing while transcription is pending aborts and suppresses the late draft', async () => { holdVoice = true; await record(); const previous = transcripts; await page.getByRole('button', { name: /Finish recording/ }).click(); await page.waitForFunction(() => document.body.textContent?.includes('Turning your words into a draft')); for (let i = 0; transcripts === previous && i < 50; i++) await page.waitForTimeout(50); await page.keyboard.press('Escape'); await noTracks(); releaseVoice?.(); holdVoice = false; await page.waitForTimeout(100); await openVoice(); if (await page.getByRole('textbox', { name: 'Describe how to change your space' }).inputValue() !== 'Unsent text stays here') throw Error('Late transcript replaced draft'); await page.keyboard.press('Escape'); });
  await check('Camera preview is explicit and sends no image until Describe', async () => { const before = observations; await startCamera(); if (observations !== before) throw Error('Preview sent a frame'); await page.screenshot({ path: 'docs/frontend/browser-evidence/camera-preview.png' }); await page.getByRole('button', { name: 'Describe this view', exact: true }).click(); await page.getByText(/Fixture scene 1:/).waitFor(); await page.waitForFunction(() => (window as any).__audioPlays > 0); if (!await page.getByRole('button', { name: /Next view in/ }).isDisabled()) throw Error('Frame interval not enforced'); });
  await check('Stop speaking interrupts current audio; Stop camera revokes URLs and releases tracks', async () => { const speaking = page.getByRole('button', { name: 'Stop speaking' }); if (await speaking.count()) await speaking.click(); await page.getByRole('button', { name: 'Stop', exact: true }).click(); await noTracks(); if (await page.evaluate(() => (window as any).__audioElements.some((audio: HTMLAudioElement) => !audio.paused))) throw Error('Audio continues after Stop'); if (await page.evaluate(() => (window as any).__revokeCount) < 1) throw Error('Audio URL not revoked'); });
  await check('A delayed scene result cannot appear or play after Stop', async () => { holdScene = true; await startCamera(); const previous = observations, plays = await page.evaluate(() => (window as any).__audioPlays); await page.getByRole('button', { name: 'Describe this view', exact: true }).click(); for (let i = 0; observations === previous && i < 50; i++) await page.waitForTimeout(50); await page.getByRole('button', { name: 'Stop', exact: true }).click(); await noTracks(); releaseScene?.(); holdScene = false; await page.waitForTimeout(100); if (await page.getByText('Late scene must never appear', { exact: true }).count()) throw Error('Late scene appeared'); if (await page.evaluate(() => (window as any).__audioPlays) !== plays) throw Error('Late scene played'); });
  await check('Device permission denial keeps text available and camera off', async () => { await page.evaluate(() => { (window as any).__denyNext = true; }); await page.getByRole('button', { name: 'Start camera', exact: true }).click(); await page.getByText('Device access was not allowed. You can keep using the text box.').waitFor(); await noTracks(); });
  await check('Unmount, space change and logout all release camera tracks', async () => { await startCamera(); await page.getByRole('button', { name: 'Toggle camera component' }).click(); await noTracks(); await page.getByRole('button', { name: 'Toggle camera component' }).click(); await startCamera(); await page.getByRole('button', { name: 'Switch space' }).click(); await noTracks(); await startCamera(); await page.getByRole('button', { name: 'Sign out fixture' }).click(); await noTracks(); await page.getByText('Only the space owner can start this camera scene. Your camera and microphone are off.').waitFor(); await page.getByRole('button', { name: 'Restore fixture owner' }).click(); });
  await check('Search cards keep text escaped and permit only canonical Open Library links', async () => { const links = page.locator('.tool-book a'); if (await links.count() !== 1 || await links.first().getAttribute('href') !== 'https://openlibrary.org/works/OL123W') throw Error('Unsafe result links'); if (await page.locator('.tool-book script').count()) throw Error('Unsafe result HTML'); });
  await check('Automatic observation respects 15 seconds, one request at a time, eight frames and expiry', async () => { await page.clock.install({ time: new Date() }); await startCamera(); await page.getByLabel('Read descriptions aloud').uncheck(); const start = observations; await page.getByLabel('Describe automatically, at least 15 seconds apart').check(); for (let i = 0; observations === start && i < 50; i++) await page.waitForTimeout(30); if (observations !== start + 1) throw Error('Automatic first frame missing'); await page.clock.fastForward(14999); if (observations !== start + 1) throw Error('Frame sent too early'); await page.clock.fastForward(1); for (let n = 2; n <= 8; n++) { if (n > 2) await page.clock.fastForward(15000); await page.waitForFunction(expected => document.body.textContent?.includes(`${expected} / 8 views sent`), n); } if (observations !== start + 8) throw Error(`Frame cap failed ${observations-start}`); await page.clock.fastForward(15000); if (observations !== start + 8) throw Error('Ninth frame sent'); await page.clock.fastForward(300000); await noTracks(); await page.getByText('This device session expired. Please start again.').waitFor(); });
  if (errors.length) throw Error(errors.join('\n'));
  await writeFile('docs/frontend/browser-evidence/media-results.json', JSON.stringify({ date: new Date().toISOString(), scope: 'Real Chrome virtual camera/microphone, MediaRecorder, AudioContext resampling, JPEG capture and audio player; every API request intercepted as an explicit fixture; no provider calls', checks, wavEvidence, frameEvidence, sessionCount, deletes, errors }, null, 2));
} finally { await browser.close(); }
