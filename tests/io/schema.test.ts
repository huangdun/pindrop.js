import { describe, it, expect } from 'vitest';
import { validatePindropData } from '../../src/io/schema';

describe('validatePindropData', () => {
  const validData = {
    version: 1,
    url: 'http://localhost',
    createdAt: '2026-01-01T00:00:00Z',
    comments: [],
  };

  it('accepts valid data', () => {
    expect(() => validatePindropData(validData)).not.toThrow();
  });

  it('rejects unsupported version', () => {
    expect(() => validatePindropData({ ...validData, version: 99 })).toThrow('Unsupported schema version');
  });

  it('treats missing version as version 1', () => {
    const { version, ...noVersion } = validData;
    expect(() => validatePindropData(noVersion)).not.toThrow();
  });

  it('rejects non-object input', () => {
    expect(() => validatePindropData('hello')).toThrow();
  });

  it('rejects missing comments array', () => {
    const { comments, ...noComments } = validData;
    expect(() => validatePindropData(noComments)).toThrow();
  });

  it('rejects comment missing id', () => {
    const data = { ...validData, comments: [{ text: 'hi', anchor: {} }] };
    expect(() => validatePindropData(data)).toThrow('missing id');
  });

  it('rejects comment missing anchor', () => {
    const data = { ...validData, comments: [{ id: 'c1', text: 'hi' }] };
    expect(() => validatePindropData(data)).toThrow('missing anchor');
  });
});