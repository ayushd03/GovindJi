import {
  getPasswordValidationMessage,
  isStrongPassword,
  isValidEmail,
} from './authValidation';

describe('authValidation', () => {
  it('accepts strong passwords', () => {
    expect(isStrongPassword('GovindJi@2026')).toBe(true);
    expect(getPasswordValidationMessage('GovindJi@2026')).toBe('');
  });

  it('rejects weak passwords with a user-facing hint', () => {
    expect(isStrongPassword('password')).toBe(false);
    expect(getPasswordValidationMessage('password')).toMatch(/at least 8 characters/i);
  });

  it('validates email format', () => {
    expect(isValidEmail('orders@govindji.com')).toBe(true);
    expect(isValidEmail('orders')).toBe(false);
  });
});
