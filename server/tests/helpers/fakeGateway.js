// Pasarela de pagos falsa para las pruebas: nunca llama a la red ni a Mercado Pago.
// Tiene la misma forma que la pasarela real (services/gateways/mercadoPagoGateway.js).

/**
 * @param {{ enabled?: boolean }} options
 * - createPaymentLink devuelve un enlace y una preferencia ficticios y registra la llamada.
 * - findPayments devuelve lo que la prueba programó con setResults (por referencia externa); sin programar, [].
 * - failNext(error) hace que la siguiente llamada falle una vez.
 */
export function createFakeGateway({ enabled = true } = {}) {
  const calls = [];
  const results = new Map();
  let pendingFailure = null;

  const maybeFail = () => {
    if (pendingFailure) {
      const error = pendingFailure;
      pendingFailure = null;
      throw error;
    }
  };

  return {
    enabled,
    calls,
    async createPaymentLink(request) {
      calls.push({ type: 'createPaymentLink', request });
      maybeFail();
      const id = `pref-${calls.filter((c) => c.type === 'createPaymentLink').length}`;
      return { preferenceId: id, link: `https://sandbox.mercadopago.test/checkout/${id}` };
    },
    async findPayments(externalReference) {
      calls.push({ type: 'findPayments', externalReference });
      maybeFail();
      return results.get(externalReference) ?? [];
    },
    // Programa los cobros que Mercado Pago "devolverá" para una referencia: [{ id, status }].
    setResults(externalReference, payments) {
      results.set(externalReference, payments);
    },
    failNext(error) {
      pendingFailure = error;
    }
  };
}

// La importación es diferida para que este archivo exista antes que la pasarela real.
export async function installFakeGateway(gateway) {
  const { setPaymentGateway } = await import('../../services/gateways/paymentGateway.js');
  setPaymentGateway(gateway);
}

export async function uninstallFakeGateway() {
  const { resetPaymentGateway } = await import('../../services/gateways/paymentGateway.js');
  resetPaymentGateway();
}
