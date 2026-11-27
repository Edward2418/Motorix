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
  ssl: env.db.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  // Las sentencias se ejecutan de una en una; los scripts SQL se dividen en scripts/sqlRunner.js.
  multipleStatements: false
});

// Prepara cada conexión nueva (las sentencias se encolan antes de la primera consulta):
// - la misma intercalación que las tablas, porque TiDB rechaza comparar textos literales con otra distinta;
// - la hora del taller, si se indicó `DB_TIME_ZONE`.
pool.on('connection', (connection) => {
  connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci');
  if (env.db.timeZone) {
    connection.query('SET time_zone = ?', [env.db.timeZone]);
  }
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
    // Para esta transacción: cada lectura ve lo ya confirmado. Tras esperar un bloqueo FOR UPDATE hay que ver lo que
    // guardó quien lo tenía, y TiDB con su aislamiento por omisión no lo hace (fija la «foto» al iniciar).
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
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
