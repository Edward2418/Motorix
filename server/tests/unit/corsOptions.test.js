import { buildCorsOptions, parseAllowedOrigins } from '../../config/cors.js';

// Devuelve lo que decide la opción `origin` de CORS para un origen dado (true = se permite, false = no).
const decide = (options, origin) =>
  new Promise((resolve, reject) => {
    options.origin(origin, (error, permitido) => (error ? reject(error) : resolve(permitido)));
  });

describe('parseAllowedOrigins', () => {
  test('sin valor devuelve una lista vacía', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
    expect(parseAllowedOrigins('   ')).toEqual([]);
  });

  test('separa por comas, recorta espacios y quita la barra final', () => {
    expect(parseAllowedOrigins(' https://taller.example.com/ , https://admin.example.com ,,')).toEqual([
      'https://taller.example.com',
      'https://admin.example.com'
    ]);
  });
});

describe('buildCorsOptions sin lista explícita (desarrollo local)', () => {
  const options = buildCorsOptions([]);

  test('permite las peticiones sin origen: la aplicación de escritorio, curl y las pruebas', async () => {
    expect(await decide(options, undefined)).toBe(true);
  });

  test.each(['http://localhost:5000', 'http://localhost', 'http://127.0.0.1:3000', 'http://[::1]:8080'])(
    'permite el origen local %s',
    async (origin) => {
      expect(await decide(options, origin)).toBe(true);
    }
  );

  test.each(['https://sitio-malicioso.example', 'http://localhost.evil.example', 'http://192.168.1.20:5000', 'null'])(
    'rechaza el origen %s',
    async (origin) => {
      expect(await decide(options, origin)).toBe(false);
    }
  );
});

describe('buildCorsOptions con una lista explícita (producción)', () => {
  const options = buildCorsOptions(['https://taller.example.com']);

  test('permite solo los orígenes de la lista', async () => {
    expect(await decide(options, 'https://taller.example.com')).toBe(true);
    expect(await decide(options, 'https://otro.example.com')).toBe(false);
  });

  test('con una lista explícita ya no se permite localhost', async () => {
    expect(await decide(options, 'http://localhost:5000')).toBe(false);
  });

  test('las peticiones sin origen siguen permitidas, porque no vienen de un navegador', async () => {
    expect(await decide(options, undefined)).toBe(true);
  });
});
