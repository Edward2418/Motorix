import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { closePool, withTransaction, query } from '../config/db.js';

// Publica una nueva versión de los términos y condiciones y del aviso de privacidad desde un archivo de texto con dos
// secciones separadas por una línea `=== AVISO DE PRIVACIDAD ===`: lo que va antes son los términos y lo que va después,
// el aviso de privacidad. Las versiones anteriores no se modifican. Al publicarla, todas las personas deben aceptarla
// en su próximo inicio de sesión.
//
// Uso: npm run terms:publish -- <archivo>

const SEPARATOR = '=== AVISO DE PRIVACIDAD ===';

/** Lee el archivo y devuelve `{ termsText, privacyText }`, o lanza un error claro si el formato no es válido. */
async function parseFile(file) {
  if (!file) {
    throw new Error('Indica el archivo con los términos. Uso: npm run terms:publish -- <archivo>');
  }
  let content;
  try {
    content = await readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer el archivo "${file}": ${error.message}`);
  }
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const separators = lines.map((line, index) => (line.trim() === SEPARATOR ? index : -1)).filter((index) => index >= 0);
  if (separators.length === 0) {
    throw new Error(`El archivo debe tener una línea "${SEPARATOR}" que separe los términos del aviso de privacidad.`);
  }
  if (separators.length > 1) {
    throw new Error(`La línea "${SEPARATOR}" debe aparecer una sola vez.`);
  }
  const termsText = lines.slice(0, separators[0]).join('\n').trim();
  const privacyText = lines.slice(separators[0] + 1).join('\n').trim();
  if (termsText === '') {
    throw new Error('La sección de términos y condiciones está vacía.');
  }
  if (privacyText === '') {
    throw new Error('La sección del aviso de privacidad está vacía.');
  }
  return { termsText, privacyText };
}

/** Crea la versión siguiente con los dos textos y devuelve `{ version }`. */
export async function publishTerms({ file } = {}) {
  const { termsText, privacyText } = await parseFile(file);
  return withTransaction(async (conn) => {
    // El bloqueo evita que dos publicaciones simultáneas calculen el mismo número.
    const [{ last }] = await query('SELECT COALESCE(MAX(version), 0) AS last FROM terms_versions FOR UPDATE', [], conn);
    const version = Number(last) + 1;
    await query('INSERT INTO terms_versions (version, terms_text, privacy_text) VALUES (?, ?, ?)', [version, termsText, privacyText], conn);
    return { version };
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { version } = await publishTerms({ file: process.argv[2] });
    console.log(`Se publicó la versión ${version} de los términos y condiciones.`);
  } catch (error) {
    console.error(`Error al publicar los términos: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

