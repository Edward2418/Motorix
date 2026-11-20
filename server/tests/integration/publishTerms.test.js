import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pool, resetTables, closePool, createTermsVersion } from '../helpers/db.js';
import { publishTerms } from '../../scripts/publish-terms.js';

beforeEach(resetTables);
afterAll(closePool);

let carpeta;
beforeAll(async () => {
  carpeta = await mkdtemp(path.join(os.tmpdir(), 'motorix-terminos-'));
});
afterAll(async () => {
  await rm(carpeta, { recursive: true, force: true });
});

async function archivo(nombre, contenido) {
  const ruta = path.join(carpeta, nombre);
  await writeFile(ruta, contenido, 'utf8');
  return ruta;
}

const versiones = async () => (await pool.query('SELECT version, terms_text, privacy_text FROM terms_versions ORDER BY version'))[0];

describe('publicar una versión de los términos desde un archivo', () => {
  test('con dos secciones separadas por la línea de aviso crea la primera versión con los dos textos', async () => {
    const ruta = await archivo('v1.txt', 'Términos línea 1\nTérminos línea 2\n=== AVISO DE PRIVACIDAD ===\nAviso línea 1\n');

    const resultado = await publishTerms({ file: ruta });

    expect(resultado).toEqual({ version: 1 });
    expect(await versiones()).toEqual([{ version: 1, terms_text: 'Términos línea 1\nTérminos línea 2', privacy_text: 'Aviso línea 1' }]);
  });

  test('crea la versión siguiente y no modifica las anteriores', async () => {
    await createTermsVersion({ termsText: 'Antiguos', privacyText: 'Aviso antiguo' });
    const ruta = await archivo('v2.txt', 'Nuevos\n=== AVISO DE PRIVACIDAD ===\nAviso nuevo');

    const resultado = await publishTerms({ file: ruta });

    expect(resultado).toEqual({ version: 2 });
    expect(await versiones()).toEqual([
      { version: 1, terms_text: 'Antiguos', privacy_text: 'Aviso antiguo' },
      { version: 2, terms_text: 'Nuevos', privacy_text: 'Aviso nuevo' }
    ]);
  });

  test('conserva los acentos y la eñe', async () => {
    const ruta = await archivo('acentos.txt', 'Política de uso: niño, canción\n=== AVISO DE PRIVACIDAD ===\nDatos de tu vehículo');
    await publishTerms({ file: ruta });
    expect((await versiones())[0].terms_text).toBe('Política de uso: niño, canción');
  });

  test('rechaza un archivo sin la línea separadora, con un mensaje claro, y no crea nada', async () => {
    const ruta = await archivo('sin-separador.txt', 'Solo términos, sin aviso');
    await expect(publishTerms({ file: ruta })).rejects.toThrow(/=== AVISO DE PRIVACIDAD ===/);
    expect(await versiones()).toHaveLength(0);
  });

  test('rechaza una sección de términos vacía', async () => {
    const ruta = await archivo('terminos-vacios.txt', '\n   \n=== AVISO DE PRIVACIDAD ===\nAviso');
    await expect(publishTerms({ file: ruta })).rejects.toThrow(/términos.*vací/i);
    expect(await versiones()).toHaveLength(0);
  });

  test('rechaza una sección de aviso de privacidad vacía', async () => {
    const ruta = await archivo('aviso-vacio.txt', 'Términos\n=== AVISO DE PRIVACIDAD ===\n   \n');
    await expect(publishTerms({ file: ruta })).rejects.toThrow(/aviso de privacidad.*vací/i);
    expect(await versiones()).toHaveLength(0);
  });

  test('rechaza un archivo con la línea separadora repetida', async () => {
    const ruta = await archivo('doble.txt', 'A\n=== AVISO DE PRIVACIDAD ===\nB\n=== AVISO DE PRIVACIDAD ===\nC');
    await expect(publishTerms({ file: ruta })).rejects.toThrow(/una sola vez/i);
  });

  test('rechaza un archivo que no existe con un mensaje claro', async () => {
    await expect(publishTerms({ file: path.join(carpeta, 'no-existe.txt') })).rejects.toThrow(/no se pudo leer/i);
  });

  test('rechaza que no se indique archivo', async () => {
    await expect(publishTerms({})).rejects.toThrow(/indica el archivo/i);
  });
});
