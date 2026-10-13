import request from 'supertest';
import app from '../../app.js';
import { addServiceLine } from './db.js';
import { bearer } from './auth.js';
import { escenarioOrden } from './orders.js';

// Prepara una orden en el estado indicado con un servicio de `total` pesos (por defecto 1000) y las sesiones de cada rol.
export async function escenarioPago({ status = 'TERMINADO', total = 1000 } = {}) {
  const escenario = await escenarioOrden(status);
  if (total > 0) {
    await addServiceLine(escenario.orden.id, 'Servicio de prueba', total);
  }
  return escenario;
}

// Registra un pago por la API y devuelve la respuesta completa.
export function registrarPago(token, orderId, body) {
  return request(app).post(`/api/orders/${orderId}/payments`).set(bearer(token)).send(body);
}

export function cancelarPago(token, paymentId, body) {
  return request(app).post(`/api/payments/${paymentId}/cancel`).set(bearer(token)).send(body);
}

export function listarPagos(token, orderId) {
  return request(app).get(`/api/orders/${orderId}/payments`).set(bearer(token));
}
