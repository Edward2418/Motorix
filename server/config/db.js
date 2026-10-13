import mysql from 'mysql2/promise';
import { env } from './env.js';

// Protección: las pruebas nunca deben tocar la base principal.
if (env.nodeEnv === 'test' && env.db.name !== 'motorix_test') {
  throw new Error(
    `Las pruebas solo pueden ejecutarse contra la base "motorix_test" (DB_NAME actual: "${env.db.name}").`
  );
}

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  // Las sentencias se ejecutan de una en una; los scripts SQL se dividen en scripts/sqlRunner.js.
  multipleStatements: false
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function closePool() {
  await pool.end();
}
