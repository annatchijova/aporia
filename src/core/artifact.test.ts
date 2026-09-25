import { describe, expect, it } from 'vitest';
import { decodeImageBase64 } from './artifact';

describe('image artifact boundary', () => {
  it('accepts a PNG whose bytes match its declared MIME type', () => {
    expect(decodeImageBase64('iVBORw0KGgo=', 'image/png')).toMatchObject({ mimeType: 'image/png', byteLength: 8 });
  });

  it('rejects MIME spoofing before provider access', () => {
    expect(() => decodeImageBase64('iVBORw0KGgo=', 'image/jpeg')).toThrow('does not match');
  });

  it('rejects malformed base64', () => {
    expect(() => decodeImageBase64('not base64!', 'image/png')).toThrow('invalid image encoding');
  });
});
