import { parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('defaults to localhost:3000 when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:3000']);
    expect(parseCorsOrigins('')).toEqual(['http://localhost:3000']);
  });

  it('expands bare ports', () => {
    expect(parseCorsOrigins('3000,59012')).toEqual([
      'http://localhost:3000',
      'http://localhost:59012',
    ]);
  });

  it('passes through full origin URLs', () => {
    expect(parseCorsOrigins('http://127.0.0.1:3000')).toEqual([
      'http://127.0.0.1:3000',
    ]);
  });
});
