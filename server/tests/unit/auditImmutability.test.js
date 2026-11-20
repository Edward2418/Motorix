import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as auditModel from '../../models/auditModel.js';

// La bitácora es inmutable desde la aplicación: no hay ninguna ruta ni función que la edite o borre. La migración no crea
// disparadores (el usuario del proyecto no tiene SUPER), así que esta prueba es la garantía: recorre todo el código del
// servidor y falla si algo modifica audit_log.
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SENTENCIA_QUE_MODIFICA = /\b(UPDATE\s+audit_log|DELETE\s+FROM\s+audit_log|TRUNCATE(\s+TABLE)?\s+audit_log|DROP\s+TABLE(\s+IF\s+EXISTS)?\s+audit_log|ALTER\s+TABLE\s+audit_log)\b/i;

async function archivosDeCodigo(directorio) {
  const resultado = [];
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    if (entrada.name === 'node_modules' || entrada.name === 'tests' || entrada.name === 'coverage') {
      continue;
    }
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...(await archivosDeCodigo(ruta)));
    } else if (entrada.name.endsWith('.js')) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

describe('la bitácora no se modifica desde el código', () => {
  test('auditModel solo exporta insertar y listar', () => {
    expect(Object.keys(auditModel).sort()).toEqual(['insert', 'list']);
  });

  test('ningún archivo del servidor (fuera de las pruebas) edita, borra o vacía audit_log', async () => {
    const infractores = [];
    for (const archivo of await archivosDeCodigo(raiz)) {
      const texto = await readFile(archivo, 'utf8');
      if (SENTENCIA_QUE_MODIFICA.test(texto)) {
        infractores.push(path.relative(raiz, archivo));
      }
    }
    expect(infractores).toEqual([]);
  });

  test('solo auditModel inserta en audit_log', async () => {
    const quienInserta = [];
    for (const archivo of await archivosDeCodigo(raiz)) {
      if (/INSERT\s+INTO\s+audit_log/i.test(await readFile(archivo, 'utf8'))) {
        quienInserta.push(path.relative(raiz, archivo).replaceAll('\\', '/'));
      }
    }
    expect(quienInserta).toEqual(['models/auditModel.js']);
  });

  test('verificación de eficacia: la propia comprobación detecta cada sentencia prohibida', () => {
    for (const sentencia of [
      'UPDATE audit_log SET detail = 1',
      'delete from audit_log where id = 1',
      'TRUNCATE TABLE audit_log',
      'truncate audit_log',
      'DROP TABLE audit_log',
      'ALTER TABLE audit_log ADD COLUMN x INT'
    ]) {
      expect({ sentencia, detectada: SENTENCIA_QUE_MODIFICA.test(sentencia) }).toEqual({ sentencia, detectada: true });
    }
    expect(SENTENCIA_QUE_MODIFICA.test('SELECT * FROM audit_log')).toBe(false);
    expect(SENTENCIA_QUE_MODIFICA.test('INSERT INTO audit_log (action) VALUES (1)')).toBe(false);
  });
});
