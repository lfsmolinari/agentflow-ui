const protocolPattern = /^https?:\/\//i;
const invalidHostPattern = /[^\w.-]/;

export interface NormalizedHostResult {
  ok: boolean;
  host?: string;
  error?: string;
}

export const normalizeEnterpriseHost = (rawValue: string): NormalizedHostResult => {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { ok: false, error: 'Enter your GitHub Enterprise Cloud hostname.' };
  }

  if (protocolPattern.test(trimmed)) {
    return { ok: false, error: 'Enter the hostname only, without http:// or https://.' };
  }

  if (trimmed.includes('/')) {
    return { ok: false, error: 'Enter the hostname only, without a path.' };
  }

  if (invalidHostPattern.test(trimmed)) {
    return { ok: false, error: 'Hostname may contain only letters, numbers, dots, dashes, and underscores.' };
  }

  return { ok: true, host: trimmed.toLowerCase() };
};
