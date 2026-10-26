import { QueryTypes } from 'sequelize';
import { env } from '../config/env';
import { sequelize, Customer } from '../models';

const TABLES = [
  'accounts',
  'customers',
  'invoices',
  'invoice_items',
  'payments',
  'journal_entries',
  'journal_lines',
];

async function main(): Promise<void> {
  console.log(`Connecting to ${env.db.host}:${env.db.port}/${env.db.name} as ${env.db.user} ...`);
  await sequelize.authenticate();

  const info = (await sequelize.query(
    'SELECT VERSION() AS version, DATABASE() AS db, @@hostname AS host',
    { type: QueryTypes.SELECT },
  )) as Array<{ version: string; db: string; host: string }>;
  const ssl = (await sequelize.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'", {
    type: QueryTypes.SELECT,
  })) as Array<{ Variable_name: string; Value: string }>;

  console.log(`Connected: MySQL ${info[0]?.version}, database "${info[0]?.db}", server ${info[0]?.host}`);
  const cipher = ssl[0]?.Value ?? '';
  console.log(cipher ? `SSL: ON (${cipher})` : 'SSL: OFF  <-- check DB_SSL / DB_SSL_CA');

  console.log('\nRow counts:');
  for (const table of TABLES) {
    const rows = (await sequelize.query(`SELECT COUNT(*) AS n FROM \`${table}\``, {
      type: QueryTypes.SELECT,
    })) as Array<{ n: number | string }>;
    console.log(`  ${table.padEnd(16)} ${rows[0]?.n}`);
  }

  const totals = (await sequelize.query(
    'SELECT COALESCE(SUM(debit), 0) AS d, COALESCE(SUM(credit), 0) AS c FROM journal_lines',
    { type: QueryTypes.SELECT },
  )) as Array<{ d: string | number; c: string | number }>;
  const d = Number(totals[0]?.d ?? 0).toFixed(2);
  const c = Number(totals[0]?.c ?? 0).toFixed(2);
  console.log(`\nJournal totals: debit ${d} / credit ${c} -> ${d === c ? 'BALANCED' : 'NOT BALANCED'}`);

  console.log('\nWrite test (insert -> read back -> rollback):');
  const marker = `write-check-${Date.now()}@example.com`;
  const t = await sequelize.transaction();
  try {
    const created = await Customer.create(
      { name: 'Write check', email: marker, phone: '0000000', gstNumber: null },
      { transaction: t },
    );
    const found = await Customer.findOne({ where: { email: marker }, transaction: t });
    console.log(found ? `  INSERT OK (temporary customer id ${created.id})` : '  INSERT FAILED: row not found');
  } finally {
    await t.rollback();
  }
  const leftover = await Customer.count({ where: { email: marker } });
  console.log(leftover === 0 ? '  ROLLBACK OK (test row removed)' : '  ROLLBACK FAILED: test row still present');
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\nDB check failed:', err instanceof Error ? err.message : err);
    await sequelize.close().catch(() => undefined);
    process.exit(1);
  });