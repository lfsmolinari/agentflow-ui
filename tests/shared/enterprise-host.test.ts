import { describe, expect, it } from 'vitest';
import { normalizeEnterpriseHost } from '@shared/enterprise-host';

describe('normalizeEnterpriseHost', () => {
  it('normalizes a hostname to lowercase', () => {
    expect(normalizeEnterpriseHost('GitHub.Example.Com')).toEqual({
      ok: true,
      host: 'github.example.com'
    });
  });

  it('rejects protocol prefixes', () => {
    expect(normalizeEnterpriseHost('https://github.example.com')).toEqual({
      ok: false,
      error: 'Enter the hostname only, without http:// or https://.'
    });
  });

  it('rejects empty values', () => {
    expect(normalizeEnterpriseHost('   ')).toEqual({
      ok: false,
      error: 'Enter your GitHub Enterprise Cloud hostname.'
    });
  });

  it('rejects input containing a path segment', () => {
    expect(normalizeEnterpriseHost('github.example.com/api')).toEqual({
      ok: false,
      error: 'Enter the hostname only, without a path.'
    });
  });
});
