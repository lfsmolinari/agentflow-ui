import { describe, it, expect } from 'vitest';
import { validateEnterpriseHost } from '../../src/main/ipc-helpers';

describe('validateEnterpriseHost', () => {
  it('returns true for a valid string host', () => {
    expect(validateEnterpriseHost('github.example.com')).toBe(true);
  });

  it('returns false for undefined', () => {
    expect(validateEnterpriseHost(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(validateEnterpriseHost(null)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(validateEnterpriseHost(42)).toBe(false);
  });
});
