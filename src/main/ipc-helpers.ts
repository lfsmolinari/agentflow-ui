export function validateEnterpriseHost(host: unknown): host is string {
  return typeof host === 'string';
}
