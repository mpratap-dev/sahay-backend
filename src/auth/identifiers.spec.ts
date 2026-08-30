import { IdentifierError, normalizeEmail, normalizePhone } from './identifiers';

describe('identifiers', () => {
  it('normalizes Indian 10-digit mobiles to E.164', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('919876543210')).toBe('+919876543210');
  });

  it('rejects invalid phones', () => {
    expect(() => normalizePhone('123')).toThrow(IdentifierError);
  });

  it('normalizes email', () => {
    expect(normalizeEmail('  mp1995singh@gmail.com ')).toBe(
      'mp1995singh@gmail.com',
    );
  });

  it('rejects invalid email', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow(IdentifierError);
  });
});
