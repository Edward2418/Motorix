import { passwordProblems } from '../../validators/authValidator.js';

describe('política de contraseñas', () => {
  test('acepta una contraseña que cumple todos los requisitos', () => {
    expect(passwordProblems('Valida2026')).toEqual([]);
  });

  test('rechaza contraseñas de menos de 8 caracteres', () => {
    expect(passwordProblems('Ab1')).toContain('Debe tener al menos 8 caracteres.');
  });

  test('exige al menos una mayúscula', () => {
    expect(passwordProblems('minuscula1')).toContain('Debe incluir al menos una letra mayúscula.');
  });

  test('exige al menos una minúscula', () => {
    expect(passwordProblems('MAYUSCULA1')).toContain('Debe incluir al menos una letra minúscula.');
  });

  test('exige al menos un número', () => {
    expect(passwordProblems('SinNumeros')).toContain('Debe incluir al menos un número.');
  });

  test('rechaza contraseñas de más de 72 bytes', () => {
    expect(passwordProblems(`Aa1${'x'.repeat(80)}`)).toContain('No puede superar los 72 bytes.');
  });
});
