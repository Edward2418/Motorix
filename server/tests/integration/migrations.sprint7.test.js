import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, closePool } from '../helpers/db.js';
import { splitStatements, databaseDir } from '../../scripts/sqlRunner.js';

const MIGRACION_TABLAS = '009_sprint7_settings_terms_audit.sql';
const MIGRACION_COLUMNA = '010_sprint7_order_service_type.sql';

const columna = async (tabla, nombre) => {
  const [filas] = await pool.query(
    `SELECT data_type AS dataType, column_type AS columnType, is_nullable AS isNullable, column_default AS valorPorDefecto
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, nombre]
  );
  return filas[0] ?? null;
};

const llaveForanea = async (tabla, columnaOrigen) => {
  const [filas] = await pool.query(
    `SELECT k.referenced_table_name AS tablaReferida, r.delete_rule AS reglaBorrado
     FROM information_schema.key_column_usage k
     JOIN information_schema.referential_constraints r
       ON r.constraint_schema = k.constraint_schema AND r.constraint_name = k.constraint_name
     WHERE k.table_schema = DATABASE() AND k.table_name = ? AND k.column_name = ?
       AND k.referenced_table_name IS NOT NULL`,
    [tabla, columnaOrigen]
  );
  return filas[0] ?? null;
};

const columnasDelIndice = async (tabla, nombre) => {
  const [filas] = await pool.query(
    `SELECT column_name AS columna, non_unique AS noUnico
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
     ORDER BY seq_in_index`,
    [tabla, nombre]
  );
  return filas;
};

afterEach(async () => {
  await pool.query("DELETE FROM service_types WHERE name LIKE 'prueba-migracion%'");
});
afterAll(closePool);

describe('migración 009 del Sprint 7: settings', () => {
  test('tiene las columnas con los tipos del modelo de datos', async () => {
    const clave = await columna('settings', 'setting_key');
    const valor = await columna('settings', 'setting_value');
    const quien = await columna('settings', 'updated_by');
    const cuando = await columna('settings', 'updated_at');
    expect(clave.columnType).toBe('varchar(50)');
    expect(valor.columnType).toBe('varchar(255)');
    expect(valor.isNullable).toBe('NO');
    expect(quien.isNullable).toBe('NO');
    expect(cuando.dataType).toBe('datetime');
  });

  test('la llave primaria es setting_key y updated_by apunta a users con RESTRICT', async () => {
    const primaria = await columnasDelIndice('settings', 'PRIMARY');
    const fk = await llaveForanea('settings', 'updated_by');
    expect(primaria.map((fila) => fila.columna)).toEqual(['setting_key']);
    expect(fk.tablaReferida).toBe('users');
    expect(fk.reglaBorrado).toBe('RESTRICT');
  });
});

describe('migración 009 del Sprint 7: service_types', () => {
  test('tiene las columnas con los tipos del modelo de datos', async () => {
    const nombre = await columna('service_types', 'name');
    const dias = await columna('service_types', 'interval_days');
    const km = await columna('service_types', 'interval_km');
    const activo = await columna('service_types', 'active');
    expect(nombre.columnType).toBe('varchar(80)');
    expect(nombre.isNullable).toBe('NO');
    expect(dias.columnType).toBe('smallint unsigned');
    expect(dias.isNullable).toBe('YES');
    expect(km.columnType).toBe('int unsigned');
    expect(km.isNullable).toBe('YES');
    expect(activo.columnType).toBe('tinyint(1)');
    expect(activo.valorPorDefecto).toBe('1');
  });

  test('el nombre es único', async () => {
    const indice = await columnasDelIndice('service_types', 'uq_service_types_name');
    expect(indice.map((fila) => fila.columna)).toEqual(['name']);
    expect(indice[0].noUnico).toBe(0);
    await pool.query("INSERT INTO service_types (name, interval_days) VALUES ('prueba-migracion-1', 30)");
    await expect(pool.query("INSERT INTO service_types (name, interval_km) VALUES ('prueba-migracion-1', 1000)")).rejects.toMatchObject({
      code: 'ER_DUP_ENTRY'
    });
  });

  test('rechaza un tipo sin ningún intervalo (CHECK) y acepta con uno solo', async () => {
    await expect(pool.query("INSERT INTO service_types (name) VALUES ('prueba-migracion-2')")).rejects.toMatchObject({
      code: 'ER_CHECK_CONSTRAINT_VIOLATED'
    });
    await pool.query("INSERT INTO service_types (name, interval_days) VALUES ('prueba-migracion-3', 90)");
    await pool.query("INSERT INTO service_types (name, interval_km) VALUES ('prueba-migracion-4', 5000)");
  });
});

describe('migración 009 del Sprint 7: terms_versions y terms_acceptances', () => {
  test('terms_versions tiene el texto de los términos y del aviso de privacidad como MEDIUMTEXT no nulo', async () => {
    const terminos = await columna('terms_versions', 'terms_text');
    const privacidad = await columna('terms_versions', 'privacy_text');
    const version = await columna('terms_versions', 'version');
    expect(terminos.dataType).toBe('mediumtext');
    expect(terminos.isNullable).toBe('NO');
    expect(privacidad.dataType).toBe('mediumtext');
    expect(privacidad.isNullable).toBe('NO');
    expect(version.columnType).toBe('int unsigned');
  });

  test('la versión es única', async () => {
    const [filas] = await pool.query(
      `SELECT index_name AS nombre, non_unique AS noUnico, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'terms_versions'
       GROUP BY index_name, non_unique`
    );
    expect(filas.find((fila) => fila.noUnico === 0 && fila.columnas === 'version')).toBeDefined();
  });

  test('terms_acceptances tiene llaves foráneas RESTRICT y una restricción única (user_id, terms_version_id)', async () => {
    const usuario = await llaveForanea('terms_acceptances', 'user_id');
    const version = await llaveForanea('terms_acceptances', 'terms_version_id');
    expect(usuario.tablaReferida).toBe('users');
    expect(usuario.reglaBorrado).toBe('RESTRICT');
    expect(version.tablaReferida).toBe('terms_versions');
    expect(version.reglaBorrado).toBe('RESTRICT');
    const [filas] = await pool.query(
      `SELECT index_name AS nombre, non_unique AS noUnico, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'terms_acceptances'
       GROUP BY index_name, non_unique`
    );
    expect(filas.find((fila) => fila.noUnico === 0 && fila.columnas === 'user_id,terms_version_id')).toBeDefined();
  });
});

describe('migración 009 del Sprint 7: audit_log', () => {
  test('tiene las columnas con los tipos del modelo de datos', async () => {
    const id = await columna('audit_log', 'id');
    const usuario = await columna('audit_log', 'user_id');
    const actor = await columna('audit_log', 'actor');
    const accion = await columna('audit_log', 'action');
    const entidad = await columna('audit_log', 'entity');
    const idEntidad = await columna('audit_log', 'entity_id');
    const detalle = await columna('audit_log', 'detail');
    expect(id.columnType).toBe('bigint unsigned');
    expect(usuario.columnType).toBe('int unsigned');
    expect(usuario.isNullable).toBe('YES');
    expect(actor.columnType).toBe('varchar(50)');
    expect(actor.isNullable).toBe('YES');
    expect(accion.columnType).toBe('varchar(40)');
    expect(accion.isNullable).toBe('NO');
    expect(entidad.columnType).toBe('varchar(40)');
    expect(entidad.isNullable).toBe('YES');
    expect(idEntidad.isNullable).toBe('YES');
    expect(detalle.columnType).toBe('varchar(255)');
    expect(detalle.isNullable).toBe('YES');
  });

  test('user_id no tiene llave foránea: la bitácora no depende de otras tablas', async () => {
    expect(await llaveForanea('audit_log', 'user_id')).toBeNull();
  });

  test('tiene los tres índices del modelo de datos', async () => {
    const fecha = await columnasDelIndice('audit_log', 'idx_audit_created');
    const usuario = await columnasDelIndice('audit_log', 'idx_audit_user');
    const accion = await columnasDelIndice('audit_log', 'idx_audit_action');
    expect(fecha.map((fila) => fila.columna)).toEqual(['created_at', 'id']);
    expect(usuario.map((fila) => fila.columna)).toEqual(['user_id', 'created_at']);
    expect(accion.map((fila) => fila.columna)).toEqual(['action', 'created_at']);
  });

  test('no hay disparadores: el usuario del proyecto no tiene SUPER (research D-11)', async () => {
    const [filas] = await pool.query(
      "SELECT trigger_name AS nombre FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND event_object_table = 'audit_log'"
    );
    expect(filas).toEqual([]);
  });
});

describe('migración 010 del Sprint 7: order_services.service_type_id', () => {
  test('la columna es INT UNSIGNED y admite NULL', async () => {
    const tipo = await columna('order_services', 'service_type_id');
    expect(tipo.columnType).toBe('int unsigned');
    expect(tipo.isNullable).toBe('YES');
  });

  test('la llave foránea a service_types es ON DELETE RESTRICT y existe su índice', async () => {
    const fk = await llaveForanea('order_services', 'service_type_id');
    const indice = await columnasDelIndice('order_services', 'idx_order_services_type');
    expect(fk.tablaReferida).toBe('service_types');
    expect(fk.reglaBorrado).toBe('RESTRICT');
    expect(indice.map((fila) => fila.columna)).toEqual(['service_type_id']);
  });
});

describe('archivos de las migraciones 009 y 010', () => {
  test('schema_migrations registra las dos migraciones', async () => {
    const [filas] = await pool.query('SELECT name FROM schema_migrations');
    const nombres = filas.map((fila) => fila.name);
    expect(nombres).toContain(MIGRACION_TABLAS);
    expect(nombres).toContain(MIGRACION_COLUMNA);
  });

  test('la 009 se puede ejecutar dos veces sin error y solo crea tablas', async () => {
    const sql = await readFile(path.join(databaseDir, 'migrations', MIGRACION_TABLAS), 'utf8');
    const sentencias = splitStatements(sql);
    expect(sentencias).toHaveLength(5);
    for (const sentencia of sentencias) {
      expect(sentencia).toMatch(/CREATE TABLE IF NOT EXISTS/i);
      await pool.query(sentencia);
      await pool.query(sentencia);
    }
    expect(sql).not.toMatch(/ALTER\s+TABLE/i);
    expect(sql).not.toMatch(/DROP\s+/i);
  });

  test('la 009 no crea disparadores (MySQL con registro binario exige SUPER)', async () => {
    const sql = await readFile(path.join(databaseDir, 'migrations', MIGRACION_TABLAS), 'utf8');
    expect(sql).not.toMatch(/CREATE\s+TRIGGER/i);
  });

  test('la 010 es una sola sentencia ALTER TABLE (no se puede repetir)', async () => {
    const sql = await readFile(path.join(databaseDir, 'migrations', MIGRACION_COLUMNA), 'utf8');
    const sentencias = splitStatements(sql);
    expect(sentencias).toHaveLength(1);
    expect(sentencias[0]).toMatch(/^ALTER TABLE order_services/i);
  });

  test('las migraciones anteriores siguen intactas', async () => {
    const [filas] = await pool.query('SELECT name FROM schema_migrations');
    const nombres = filas.map((fila) => fila.name);
    for (const anterior of ['001_sprint1_users_clients_vehicles.sql', '006_sprint5_ticket_content.sql', '008_sprint6_notifications.sql']) {
      expect(nombres).toContain(anterior);
    }
  });
});
