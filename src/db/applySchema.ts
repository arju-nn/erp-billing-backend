import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { env } from '../config/env';
import { buildSslOptions } from '../config/ssl';

export async function applySchema(): Promise<void> {
  const schemaPath = path.resolve(__dirname, '../../db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    ssl: buildSslOptions(),
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  applySchema()
    .then(() => {
      console.log('Schema applied.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to apply schema:', err);
      process.exit(1);
    });
}