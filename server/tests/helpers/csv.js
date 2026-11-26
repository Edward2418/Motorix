import request from 'supertest';
import app from '../../app.js';
import { bearer } from './auth.js';

const BOM = '﻿';

/** Pide la exportación CSV de una ruta de reportes (agrega `format=csv`) y devuelve el cuerpo como texto. */
export const pedirCsv = (token, url) =>
  request(app)
    .get(`${url}&format=csv`)
    .set(bearer(token))
    .buffer(true)
    .parse((res, callback) => {
      const trozos = [];
      res.on('data', (t) => trozos.push(t));
      res.on('end', () => callback(null, Buffer.concat(trozos).toString('utf8')));
    });

/** Lector mínimo de CSV (comillas dobles escapadas por duplicación), suficiente para las pruebas. */
export function leerCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  const cuerpo = texto.replace(BOM, '');
  for (let i = 0; i < cuerpo.length; i += 1) {
    const c = cuerpo[i];
    if (comillas) {
      if (c === '"' && cuerpo[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (c === '"') {
        comillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      comillas = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\r' && cuerpo[i + 1] === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
      i += 1;
    } else {
      campo += c;
    }
  }
  return filas;
}
