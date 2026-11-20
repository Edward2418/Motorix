import { listAttentionMaintenance, listMaintenance, todayLocal } from '../../services/maintenanceService.js';

const ahora = new Date(2026, 10, 19, 10, 0, 0);
const en = (dias) => todayLocal(new Date(2026, 10, 19 + dias));

const mantenimiento = (id, extra = {}) => ({
  id,
  vehicleId: 1,
  vehicleLabel: 'ABC1234 · Nissan Versa 2020',
  currentMileage: 50000,
  clientId: 1,
  clientName: 'Cliente de prueba',
  orderId: 1,
  description: `Servicio ${id}`,
  dueDate: null,
  dueMileage: null,
  status: 'PROGRAMADO',
  ...extra
});

// Modelo y servicio de configuración falsos: registran cuántas veces se consultaron.
const modeloCon = (items) => ({ async listWithContext() { return items; } });
function configuracionFalsa(margenes) {
  const llamadas = { total: 0 };
  return {
    llamadas,
    async getMaintenanceThresholds() {
      llamadas.total += 1;
      return margenes;
    }
  };
}

const filtros = { status: 'PROGRAMADO', page: 1, pageSize: 50 };
const estados = (resultado) => Object.fromEntries(resultado.data.map((m) => [m.id, m.visualStatus]));

describe('listMaintenance con los márgenes de la configuración', () => {
  test('si no recibe márgenes, los toma de la configuración', async () => {
    const model = modeloCon([mantenimiento(1, { dueDate: en(10) })]);
    const settings = configuracionFalsa({ soonDays: 5, soonKm: 100 });

    const resultado = await listMaintenance(filtros, { now: ahora, model, settings });

    expect(estados(resultado)).toEqual({ 1: 'NORMAL' });
    expect(settings.llamadas.total).toBe(1);
  });

  test('con un margen mayor, el mismo mantenimiento pasa a «Próximo»', async () => {
    const model = modeloCon([mantenimiento(1, { dueDate: en(10) })]);
    const settings = configuracionFalsa({ soonDays: 15, soonKm: 100 });

    const resultado = await listMaintenance(filtros, { now: ahora, model, settings });

    expect(estados(resultado)).toEqual({ 1: 'PROXIMO' });
  });

  test('los márgenes recibidos por parámetro mandan y no se consulta la configuración', async () => {
    const model = modeloCon([mantenimiento(1, { dueDate: en(10) })]);
    const settings = configuracionFalsa({ soonDays: 1, soonKm: 100 });

    const resultado = await listMaintenance(filtros, { now: ahora, model, settings, thresholds: { soonDays: 30, soonKm: 1000 } });

    expect(estados(resultado)).toEqual({ 1: 'PROXIMO' });
    expect(settings.llamadas.total).toBe(0);
  });

  test('el margen en kilómetros también sale de la configuración', async () => {
    const model = modeloCon([mantenimiento(1, { dueMileage: 51500 })]);

    const estrecho = await listMaintenance(filtros, { now: ahora, model, settings: configuracionFalsa({ soonDays: 30, soonKm: 1000 }) });
    const amplio = await listMaintenance(filtros, { now: ahora, model, settings: configuracionFalsa({ soonDays: 30, soonKm: 2000 }) });

    expect(estados(estrecho)).toEqual({ 1: 'NORMAL' });
    expect(estados(amplio)).toEqual({ 1: 'PROXIMO' });
  });
});

describe('listAttentionMaintenance con los márgenes de la configuración', () => {
  test('solo devuelve «Próximo» y «Vencido» según el margen de la configuración', async () => {
    const items = [mantenimiento(1, { dueDate: en(10) }), mantenimiento(2, { dueDate: en(-2) }), mantenimiento(3, { dueDate: en(60) })];

    const estrecho = await listAttentionMaintenance({ now: ahora, model: modeloCon(items), settings: configuracionFalsa({ soonDays: 5, soonKm: 100 }) });
    const amplio = await listAttentionMaintenance({ now: ahora, model: modeloCon(items), settings: configuracionFalsa({ soonDays: 90, soonKm: 100 }) });

    expect(estrecho.map((m) => m.id)).toEqual([2]);
    expect(amplio.map((m) => m.id).sort()).toEqual([1, 2, 3]);
  });

  test('los márgenes recibidos por parámetro mandan y no se consulta la configuración', async () => {
    const settings = configuracionFalsa({ soonDays: 1, soonKm: 1 });

    const lista = await listAttentionMaintenance({
      now: ahora,
      model: modeloCon([mantenimiento(1, { dueDate: en(10) })]),
      settings,
      thresholds: { soonDays: 30, soonKm: 1000 }
    });

    expect(lista).toHaveLength(1);
    expect(settings.llamadas.total).toBe(0);
  });
});
