import { AppError } from './errors';

/** Convert a rupee amount (number or DECIMAL string from MySQL) to integer paise. */
export function toPaise(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError(400, `Invalid money amount: ${String(value)}`);
  }
  return Math.round(n * 100);
}

/** Convert integer paise to a 2-decimal string suitable for DECIMAL(12,2). */
export function fromPaise(paise: number): string {
  return (paise / 100).toFixed(2);
}