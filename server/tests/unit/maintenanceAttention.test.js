import { listAttentionMaintenance, todayLocal } from '../../services/maintenanceService.js';

// Mantenimiento falso con la forma que devuelve maintenanceModel.listWithContext.
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

const ahora = new Date(2026, 10, 19, 10, 0, 0);
const en = (dias) => todayLocal(new Date(2026, 10, 19 + dias));

// Modelo falso: devuelve siempre los mismos mantenimientos y registra el estado pedido.
const modeloCon = (items) => {
  const llamadas = [];
  return {
    llamadas,
    async listWithContext(filtros) {
      llamadas.push(filtros);
      return items;
    }
  };
};

describe('listAttentionMaintenance', () => {
  test('devuelve los mantenimientos próximos y vencidos, y ninguno normal', async () => {
    const model = modeloCon([
      mantenimiento(1, { dueDate: en(-3) }),
      mantenimiento(2, { dueDate: en(10) }),
      mantenimiento(3, { dueDate: en(90) }),
      mantenimiento(4, { dueMileage: 50500 })
    ]);

    const lista = await listAttentionMaintenance({ now: ahora, thresholds: { soonDays: 30, soonKm: 1000 }, model });

    expect(lista.map((m) => m.id).sort()).toEqual([1, 2, 4]);
    expect(lista.every((m) => m.visualStatus === 'VENCIDO' || m.visualStatus === 'PROXIMO')).toBe(true);
  });

  test('solo consulta mantenimientos PROGRAMADO (no atendidos ni cancelados)', async () => {
    const model = modeloCon([mantenimiento(1, { dueDate: en(-1) })]);

    await listAttentionMaintenance({ now: ahora, thresholds: { soonDays: 30, soonKm: 1000 }, model });

    expect(model.llamadas).toHaveLength(1);
    expect(model.llamadas[0].status).toBe('PROGRAMADO');
  });

  test('ordena por urgencia: vencidos primero y, dentro de cada grupo, la fecha más cercana', async () => {
    const model = modeloCon([
      mantenimiento(1, { dueDate: en(20) }),
      mantenimiento(2, { dueDate: en(-1) }),
      mantenimiento(3, { dueDate: en(5) }),
      mantenimiento(4, { dueDate: en(-10) })
    ]);

    const lista = await listAttentionMaintenance({ now: ahora, thresholds: { soonDays: 30, soonKm: 1000 }, model });

    expect(lista.map((m) => m.id)).toEqual([4, 2, 3, 1]);
  });

  test('no pagina: con 60 pendientes devuelve los 60', async () => {
    const model = modeloCon(Array.from({ length: 60 }, (_, i) => mantenimiento(i + 1, { dueDate: en(-1 - i) })));

    const lista = await listAttentionMaintenance({ now: ahora, thresholds: { soonDays: 30, soonKm: 1000 }, model });

    expect(lista).toHaveLength(60);
  });

  test('respeta los umbrales recibidos: con 5 días solo es próximo lo que está a 5 días o menos', async () => {
    const model = modeloCon([mantenimiento(1, { dueDate: en(4) }), mantenimiento(2, { dueDate: en(10) })]);

    const lista = await listAttentionMaintenance({ now: ahora, thresholds: { soonDays: 5, soonKm: 1000 }, model });

    expect(lista.map((m) => m.id)).toEqual([1]);
  });

  test('sin mantenimientos devuelve una lista vacía', async () => {
    const lista = await listAttentionMaintenance({ now: ahora, thresholds: { soonDays: 30, soonKm: 1000 }, model: modeloCon([]) });
    expect(lista).toEqual([]);
  });
});
