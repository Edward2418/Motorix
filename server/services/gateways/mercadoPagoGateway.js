import { AppError } from '../../utils/AppError.js';

// Único módulo que habla con Mercado Pago (Checkout Pro). Usa el `fetch` de Node, sin SDK ni dependencias.
// El token solo viaja en el encabezado Authorization y nunca se registra ni se incluye en los mensajes de error.
// Nunca se envían ni se reciben datos de tarjeta: el cobro ocurre en la página de Mercado Pago.

const API_URL = 'https://api.mercadopago.com';
const TIMEOUT_MS = 10000;

const UNAVAILABLE = 'Mercado Pago no está disponible en este momento. Inténtalo de nuevo en unos minutos.';
const BAD_CREDENTIALS = 'Mercado Pago rechazó las credenciales del servidor. Revisa la configuración de las credenciales.';

export function createMercadoPagoGateway({ accessToken = '', backUrl = '', sandbox = true, fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const enabled = typeof accessToken === 'string' && accessToken.trim() !== '';

  async function call(path, { method, body }) {
    if (!enabled) {
      throw AppError.mercadoPagoNotConfigured();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
    } catch {
      // Red caída o tiempo de espera agotado: se descarta el detalle para no filtrar datos internos.
      throw AppError.serviceUnavailable(UNAVAILABLE);
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 401 || response.status === 403) {
      throw AppError.serviceUnavailable(BAD_CREDENTIALS);
    }
    if (!response.ok) {
      throw AppError.serviceUnavailable(UNAVAILABLE);
    }
    try {
      return await response.json();
    } catch {
      throw AppError.serviceUnavailable(UNAVAILABLE);
    }
  }

  return {
    enabled,

    /** Crea la preferencia de pago y devuelve { preferenceId, link }. */
    async createPaymentLink({ externalReference, amount, description, expiresAt, backUrl: requestBackUrl = backUrl }) {
      const preference = {
        items: [{ title: description, quantity: 1, unit_price: amount, currency_id: 'MXN' }],
        external_reference: externalReference,
        expires: true,
        expiration_date_to: new Date(expiresAt).toISOString().replace('Z', '+00:00')
      };
      // Mercado Pago solo acepta direcciones de retorno https. Sin ellas el cliente permanece en su página.
      if (typeof requestBackUrl === 'string' && requestBackUrl.startsWith('https://')) {
        preference.back_urls = { success: requestBackUrl, failure: requestBackUrl, pending: requestBackUrl };
      }
      const data = await call('/checkout/preferences', { method: 'POST', body: preference });
      const link = sandbox ? data.sandbox_init_point : data.init_point;
      if (!data.id || !link) {
        throw AppError.serviceUnavailable(UNAVAILABLE);
      }
      return { preferenceId: String(data.id), link };
    },

    /** Cobros de una referencia externa, del más reciente al más antiguo. Solo devuelve { id, status }. */
    async findPayments(externalReference) {
      const query = `external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`;
      const data = await call(`/v1/payments/search?${query}`, { method: 'GET' });
      return (Array.isArray(data.results) ? data.results : []).map((result) => ({ id: result.id, status: result.status }));
    }
  };
}
