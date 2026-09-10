export const getEnv = (key: string) => process.env[key] ?? '';
export function getEnvNat(key: string, fallback: number): number;
export function getEnvNat(key: string): number | undefined;
export function getEnvNat(key: string, fallback?: number): number | undefined {
  const value = process.env[key];

  if (!value) return fallback;

  const parsed = parseInt(value, 10);

  return !Number.isInteger(parsed) || parsed <= 0 ? fallback : parsed;
}
