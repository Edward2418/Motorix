import { currentVersion, requiresAcceptance } from '../../services/termsRules.js';

describe('versión vigente de los términos', () => {
  test('es la de mayor número, sin importar el orden en que lleguen', () => {
    const versiones = [{ version: 1 }, { version: 3 }, { version: 2 }];
    expect(currentVersion(versiones)).toEqual({ version: 3 });
  });

  test('con una sola versión es esa', () => {
    expect(currentVersion([{ version: 1 }])).toEqual({ version: 1 });
  });

  test('sin ninguna versión publicada no hay versión vigente', () => {
    expect(currentVersion([])).toBeNull();
  });
});

describe('quién debe aceptar los términos', () => {
  const vigente = { version: 2 };

  test('sin ninguna versión publicada no se exige aceptar', () => {
    expect(requiresAcceptance(null, [])).toBe(false);
    expect(requiresAcceptance(null, [1])).toBe(false);
  });

  test('quien aceptó la versión vigente no queda bloqueado', () => {
    expect(requiresAcceptance(vigente, [2])).toBe(false);
    expect(requiresAcceptance(vigente, [1, 2])).toBe(false);
  });

  test('quien solo aceptó una versión anterior sí debe aceptar la nueva', () => {
    expect(requiresAcceptance(vigente, [1])).toBe(true);
  });

  test('quien no aceptó nada debe aceptar', () => {
    expect(requiresAcceptance(vigente, [])).toBe(true);
  });
});
