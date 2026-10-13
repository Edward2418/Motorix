import { env } from '../../config/env.js';
import { createMercadoPagoGateway } from './mercadoPagoGateway.js';

// Punto único para obtener la pasarela de pagos. El dominio de pagos no conoce a Mercado Pago: pide la pasarela aquí,
// y las pruebas la sustituyen por una falsa con setPaymentGateway.

let override = null;
let configured = null;

export function getPaymentGateway() {
  if (override) {
    return override;
  }
  configured ??= createMercadoPagoGateway({
    accessToken: env.mercadoPago.accessToken,
    backUrl: env.mercadoPago.backUrl,
    sandbox: env.mercadoPago.sandbox
  });
  return configured;
}

export function setPaymentGateway(gateway) {
  override = gateway;
}

export function resetPaymentGateway() {
  override = null;
}
