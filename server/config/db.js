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

// Ejecuta una consulta. Si se indica una conexión (dentro de una transacción) la usa; si no, usa el pool.
export async function query(sql, params = [], conn = pool) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

// Ejecuta la función `work` dentro de una transacción: confirma si termina bien y revierte si lanza un error.
// `work` recibe la conexión, que debe pasarse a los modelos para que participen en la transacción.
export async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // Si la reversión falla, se propaga el error original.
    }
    throw error;
  } finally {
    conn.release();
  }
}

export async function closePool() {
  await pool.end();
}
