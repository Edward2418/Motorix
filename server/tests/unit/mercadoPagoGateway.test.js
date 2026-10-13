import { createMercadoPagoGateway } from '../../services/gateways/mercadoPagoGateway.js';

const TOKEN = 'TEST-0000000000000000-000000-secreto-de-prueba';

// `fetch` simulado: registra las llamadas y responde lo programado.
function fakeFetch(respuesta) {
  const llamadas = [];
  const fetchImpl = async (url, options) => {
    llamadas.push({ url: String(url), options });
    const valor = typeof respuesta === 'function' ? await respuesta(String(url), options) : respuesta;
    if (valor instanceof Error) {
      throw valor;
    }
    return {
      ok: valor.status >= 200 && valor.status < 300,
      status: valor.status,
      json: async () => valor.body ?? {},
      text: async () => JSON.stringify(valor.body ?? {})
    };
  };
  return { fetchImpl, llamadas };
}

const solicitud = {
  externalReference: 'mtx-abc123',
  amount: 450.5,
  description: 'Orden OS-2026-0001',
  expiresAt: new Date('2026-10-14T12:00:00Z'),
  backUrl: 'https://taller.example.com/gracias'
};

describe('mercadoPagoGateway', () => {
  test('sin token está deshabilitada', () => {
    expect(createMercadoPagoGateway({ accessToken: '' }).enabled).toBe(false);
    expect(createMercadoPagoGateway({ accessToken: TOKEN }).enabled).toBe(true);
  });

  test('createPaymentLink envía el token solo en el encabezado y los datos de la preferencia', async () => {
    const { fetchImpl, llamadas } = fakeFetch({ status: 201, body: { id: 'pref-1', init_point: 'https://real/1', sandbox_init_point: 'https://sandbox/1' } });
    const gateway = createMercadoPagoGateway({ accessToken: TOKEN, sandbox: true, fetchImpl });
    const resultado = await gateway.createPaymentLink(solicitud);

    expect(resultado).toEqual({ preferenceId: 'pref-1', link: 'https://sandbox/1' });
    expect(llamadas).toHaveLength(1);
    const { url, options } = llamadas[0];
    expect(url).toBe('https://api.mercadopago.com/checkout/preferences');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(url).not.toContain(TOKEN);
    expect(options.body).not.toContain(TOKEN);
    const cuerpo = JSON.parse(options.body);
    expect(cuerpo.external_reference).toBe('mtx-abc123');
    expect(cuerpo.items).toEqual([{ title: 'Orden OS-2026-0001', quantity: 1, unit_price: 450.5, currency_id: 'MXN' }]);
    expect(cuerpo.expires).toBe(true);
    expect(cuerpo.expiration_date_to).toContain('2026-10-14T12:00:00');
    expect(cuerpo.back_urls).toEqual({
      success: 'https://taller.example.com/gracias',
      failure: 'https://taller.example.com/gracias',
      pending: 'https://taller.example.com/gracias'
    });
    expect(cuerpo.auto_return).toBeUndefined();
    expect(JSON.stringify(cuerpo)).not.toMatch(/card|cvv|tarjeta/i);
  });

  test('con sandbox desactivado usa el enlace de producción', async () => {
    const { fetchImpl } = fakeFetch({ status: 201, body: { id: 'pref-2', init_point: 'https://real/2', sandbox_init_point: 'https://sandbox/2' } });
    const gateway = createMercadoPagoGateway({ accessToken: TOKEN, sandbox: false, fetchImpl });
    expect((await gateway.createPaymentLink(solicitud)).link).toBe('https://real/2');
  });

  test('solo envía back_urls si la dirección es https', async () => {
    const { fetchImpl, llamadas } = fakeFetch({ status: 201, body: { id: 'p', sandbox_init_point: 'https://s' } });
    const gateway = createMercadoPagoGateway({ accessToken: TOKEN, fetchImpl });
    await gateway.createPaymentLink({ ...solicitud, backUrl: 'http://localhost:8080' });
    await gateway.createPaymentLink({ ...solicitud, backUrl: '' });
    for (const llamada of llamadas) {
      expect(JSON.parse(llamada.options.body).back_urls).toBeUndefined();
    }
  });

  test('findPayments consulta por la referencia externa codificada', async () => {
    const { fetchImpl, llamadas } = fakeFetch({ status: 200, body: { results: [{ id: 77, status: 'approved', transaction_amount: 450.5, payer: { email: 'x@y.z' } }] } });
    const gateway = createMercadoPagoGateway({ accessToken: TOKEN, fetchImpl });
    const resultados = await gateway.findPayments('mtx abc&123');
    expect(llamadas[0].url).toBe('https://api.mercadopago.com/v1/payments/search?external_reference=mtx%20abc%26123&sort=date_created&criteria=desc');
    expect(llamadas[0].options.method).toBe('GET');
    expect(llamadas[0].options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    // Solo se conservan el identificador y el estado.
    expect(resultados).toEqual([{ id: 77, status: 'approved' }]);
  });

  test('los fallos de red, tiempo de espera y errores 5xx se traducen sin filtrar el token ni la respuesta', async () => {
    const casos = [
      new Error(`fallo de red con ${TOKEN}`),
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
      { status: 500, body: { message: `error interno con ${TOKEN}` } },
      { status: 502, body: {} }
    ];
    for (const caso of casos) {
      const { fetchImpl } = fakeFetch(caso);
      const gateway = createMercadoPagoGateway({ accessToken: TOKEN, fetchImpl });
      for (const accion of [() => gateway.createPaymentLink(solicitud), () => gateway.findPayments('mtx-1')]) {
        const error = await accion().catch((e) => e);
        expect(error).toMatchObject({ statusCode: 503, code: 'SERVICE_UNAVAILABLE' });
        expect(error.message).not.toContain(TOKEN);
        expect(error.message).not.toContain('interno');
        expect(error.message).toMatch(/Mercado Pago/);
      }
    }
  });

  test('una respuesta 401 o 403 se traduce a un mensaje de configuración', async () => {
    for (const status of [401, 403]) {
      const { fetchImpl } = fakeFetch({ status, body: { message: 'invalid token' } });
      const gateway = createMercadoPagoGateway({ accessToken: TOKEN, fetchImpl });
      const error = await gateway.findPayments('mtx-1').catch((e) => e);
      expect(error).toMatchObject({ statusCode: 503, code: 'SERVICE_UNAVAILABLE' });
      expect(error.message).toMatch(/credenciales/i);
      expect(error.message).not.toContain('invalid token');
    }
  });

  test('una respuesta sin identificador de preferencia se trata como servicio no disponible', async () => {
    const { fetchImpl } = fakeFetch({ status: 201, body: {} });
    const gateway = createMercadoPagoGateway({ accessToken: TOKEN, fetchImpl });
    await expect(gateway.createPaymentLink(solicitud)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  test('sin token no llama a la red y avisa que no está configurado', async () => {
    const { fetchImpl, llamadas } = fakeFetch({ status: 200 });
    const gateway = createMercadoPagoGateway({ accessToken: '', fetchImpl });
    await expect(gateway.createPaymentLink(solicitud)).rejects.toMatchObject({ code: 'MERCADOPAGO_NOT_CONFIGURED' });
    await expect(gateway.findPayments('mtx-1')).rejects.toMatchObject({ code: 'MERCADOPAGO_NOT_CONFIGURED' });
    expect(llamadas).toHaveLength(0);
  });
});
