import { describe, expect, it } from 'vitest';
import { encodeMonoWav } from './media';
import { safeOpenLibraryUrl } from '../components/ToolResults';
import { validateWav } from '../../../../packages/agent/src/media';

describe('browser media transport', () => {
  it('encodes real sample bytes accepted by the server WAV parser', () => {
    const samples = Float32Array.from({ length: 16000 }, (_, i) => Math.sin(i * .1) * .5);
    const audio = encodeMonoWav(samples);
    expect(validateWav(audio, 'audio/wav')).toEqual({ seconds: 1, dataBytes: 32000 });
  });
  it('clips overdriven and nonfinite samples without corrupting PCM', () => {
    const samples = new Float32Array(16000); samples.set([-2, Number.NaN, 2]);
    const audio = encodeMonoWav(samples), view = new DataView(audio.buffer);
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([-32768, 0, 32767]);
    expect(validateWav(audio, 'audio/wav').seconds).toBe(1);
  });
  it('keeps the maximum 20-second recording within the byte cap', () => {
    const audio = encodeMonoWav(new Float32Array(320000));
    expect(validateWav(audio, 'audio/wav').seconds).toBe(20);
    expect(audio.length).toBe(640044);
  });
});

describe('trusted result links', () => {
  it('allows canonical Open Library record URLs and removes query fragments', () => {
    expect(safeOpenLibraryUrl('https://openlibrary.org/works/OL123W?tracking=test#summary')).toBe('https://openlibrary.org/works/OL123W');
  });
  it('rejects executable, cross-origin, credential-bearing and arbitrary same-origin URLs', () => {
    for (const url of ['javascript:alert(1)', 'https://openlibrary.org.evil.test/works/OL123W', 'https://user@openlibrary.org/works/OL123W', 'http://openlibrary.org/works/OL123W', 'https://openlibrary.org/account/login', 'https://openlibrary.org/works/../../account']) expect(safeOpenLibraryUrl(url)).toBeNull();
  });
});
