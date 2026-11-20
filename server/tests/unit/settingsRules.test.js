import {
  SETTING_KEYS,
  DEFAULT_SETTINGS,
  validateSetting,
  resolveSetting
} from '../../services/settingsRules.js';

describe('claves permitidas', () => {
  test('son una lista cerrada de cinco claves', () => {
    expect(SETTING_KEYS).toEqual([
      'workshop_name',
      'workshop_address',
      'workshop_phone',
      'maintenance_soon_days',
      'maintenance_soon_km'
    ]);
  });

  test('una clave fuera de la lista se rechaza', () => {
    const resultado = validateSetting('smtp_password', 'x');
    expect(resultado.valid).toBe(false);
    expect(resultado.message).toBeTruthy();
  });

  test('los predeterminados son 30 días, 1,000 km y los datos de ejemplo del taller', () => {
    expect(DEFAULT_SETTINGS.maintenance_soon_days).toBe(30);
    expect(DEFAULT_SETTINGS.maintenance_soon_km).toBe(1000);
    expect(DEFAULT_SETTINGS.workshop_name).toBe('Taller Motorix (ejemplo)');
    expect(DEFAULT_SETTINGS.workshop_address).toBe('Av. Principal 123, Ciudad de México');
    expect(DEFAULT_SETTINGS.workshop_phone).toBe('55 0000 0000');
  });
});

describe('datos del taller', () => {
  test.each([
    ['workshop_name', 100],
    ['workshop_address', 200],
    ['workshop_phone', 30]
  ])('%s acepta de 1 a %i caracteres y recorta los espacios', (clave, maximo) => {
    expect(validateSetting(clave, 'a')).toEqual({ valid: true, value: 'a' });
    expect(validateSetting(clave, '  a  ')).toEqual({ valid: true, value: 'a' });
    expect(validateSetting(clave, 'a'.repeat(maximo)).valid).toBe(true);
  });

  test.each([
    ['workshop_name', 100],
    ['workshop_address', 200],
    ['workshop_phone', 30]
  ])('%s rechaza un valor vacío, de solo espacios o de más de %i caracteres', (clave, maximo) => {
    expect(validateSetting(clave, '').valid).toBe(false);
    expect(validateSetting(clave, '   ').valid).toBe(false);
    expect(validateSetting(clave, 'a'.repeat(maximo + 1)).valid).toBe(false);
    expect(validateSetting(clave, null).valid).toBe(false);
    expect(validateSetting(clave, 12).valid).toBe(false);
  });
});

describe('márgenes de «Próximo»', () => {
  test('los días aceptan enteros de 1 a 365', () => {
    expect(validateSetting('maintenance_soon_days', 1)).toEqual({ valid: true, value: 1 });
    expect(validateSetting('maintenance_soon_days', 365)).toEqual({ valid: true, value: 365 });
    expect(validateSetting('maintenance_soon_days', '15')).toEqual({ valid: true, value: 15 });
  });

  test.each([0, -1, 366, 1.5, 'abc', '', null, true])('los días rechazan %p', (valor) => {
    expect(validateSetting('maintenance_soon_days', valor).valid).toBe(false);
  });

  test('los kilómetros aceptan enteros de 100 a 50,000', () => {
    expect(validateSetting('maintenance_soon_km', 100)).toEqual({ valid: true, value: 100 });
    expect(validateSetting('maintenance_soon_km', 50000)).toEqual({ valid: true, value: 50000 });
    expect(validateSetting('maintenance_soon_km', '1000')).toEqual({ valid: true, value: 1000 });
  });

  test.each([0, 99, 50001, 1000.5, 'mil', '', null])('los kilómetros rechazan %p', (valor) => {
    expect(validateSetting('maintenance_soon_km', valor).valid).toBe(false);
  });
});

describe('resolución del valor: guardado → entorno → predeterminado', () => {
  const base = { key: 'maintenance_soon_days', defaultValue: 30 };

  test('un valor guardado y válido manda', () => {
    expect(resolveSetting({ ...base, stored: '15', envValue: '45' })).toEqual({ value: 15, source: 'saved' });
  });

  test('sin valor guardado se usa el del entorno si es válido', () => {
    expect(resolveSetting({ ...base, stored: undefined, envValue: '45' })).toEqual({ value: 45, source: 'environment' });
  });

  test('sin guardado ni entorno se usa el predeterminado', () => {
    expect(resolveSetting({ ...base, stored: undefined, envValue: undefined })).toEqual({ value: 30, source: 'default' });
  });

  test.each(['0', 'abc', '366', '', '1.5'])('un valor guardado inválido (%p) se ignora y se usa el respaldo', (guardado) => {
    expect(resolveSetting({ ...base, stored: guardado, envValue: '45' })).toEqual({ value: 45, source: 'environment' });
    expect(resolveSetting({ ...base, stored: guardado, envValue: undefined })).toEqual({ value: 30, source: 'default' });
  });

  test('un valor de entorno inválido también se ignora', () => {
    expect(resolveSetting({ ...base, stored: undefined, envValue: '0' })).toEqual({ value: 30, source: 'default' });
  });

  test('funciona igual con los datos del taller', () => {
    const taller = { key: 'workshop_name', defaultValue: 'Taller Motorix (ejemplo)' };
    expect(resolveSetting({ ...taller, stored: 'Taller Los Pinos', envValue: 'Otro' })).toEqual({
      value: 'Taller Los Pinos',
      source: 'saved'
    });
    expect(resolveSetting({ ...taller, stored: '', envValue: 'Otro' })).toEqual({ value: 'Otro', source: 'environment' });
    expect(resolveSetting({ ...taller, stored: undefined, envValue: undefined })).toEqual({
      value: 'Taller Motorix (ejemplo)',
      source: 'default'
    });
  });
});
