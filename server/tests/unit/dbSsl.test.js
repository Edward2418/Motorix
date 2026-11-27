import { buildSsl } from '../../config/dbSsl.js';

describe('conexión cifrada a la base de datos', () => {
  test.each([undefined, '', 'false', 'FALSE', 'no'])('con DB_SSL «%s» no se usa TLS (base local)', (valor) => {
    expect(buildSsl(valor)).toBeUndefined();
  });

  test.each(['true', ' TRUE '])('con DB_SSL «%s» exige TLS 1.2 o superior y verifica el certificado', (valor) => {
    expect(buildSsl(valor)).toEqual({ minVersion: 'TLSv1.2', rejectUnauthorized: true });
  });
});
