import fs from 'fs';
import { env } from './env';

export interface SslConfig {
  ca?: string;
  rejectUnauthorized: boolean;
}

/**
 * DB_SSL_CA may be: a path to ca.pem, the PEM text (with real or escaped \n), or base64 of the PEM.
 */
export function buildSslOptions(): SslConfig | undefined {
  if (!env.db.ssl) return undefined;

  const raw = env.db.sslCa?.trim();
  if (!raw) {
    console.warn('[db] DB_SSL_CA not set: connecting with SSL but WITHOUT certificate verification.');
    return { rejectUnauthorized: false };
  }

  let ca: string;
  if (raw.includes('BEGIN CERTIFICATE')) {
    ca = raw.replace(/\\n/g, '\n');
  } else if (fs.existsSync(raw)) {
    ca = fs.readFileSync(raw, 'utf8');
  } else {
    ca = Buffer.from(raw, 'base64').toString('utf8');
  }

  if (!ca.includes('BEGIN CERTIFICATE')) {
    throw new Error('DB_SSL_CA must be a PEM certificate, a path to one, or a base64-encoded PEM');
  }
  return { ca, rejectUnauthorized: true };
}