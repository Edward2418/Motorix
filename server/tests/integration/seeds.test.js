import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { runSeeds } from '../../scripts/sqlRunner.js';
import { comparePassword } from '../../utils/hash.js';
import * as orderModel from '../../models/orderModel.js';
import { listMaintenance } from '../../services/maintenanceService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// Las contraseñas del estándar del MVP se leen de docs/project-context.md para no escribirlas
// en el código de la aplicación ni de las pruebas. El usuario puede llevar dígitos (por ejemplo, mecanico2).
async function standardPasswords() {
  const text = await readFile(path.join(root, 'docs/project-context.md'), 'utf8');
  const passwords = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*[^|]+\|\s*`([a-z0-9]+)`\s*\|\s*`([^`]+)`\s*\|$/);
    if (match) {
      passwords[match[1]] = match[2];
    }
  }
  return passwords;
}

const count = async (table) => (await pool.query(`SELECT COUNT(*) AS total FROM ${table}`))[0][0].total;

const conteos = async () => ({
  users: await count('users'),
  clients: await count('clients'),
  vehicles: await count('vehicles'),
  appointments: await count('appointments'),
  orders: await count('service_orders'),
  services: await count('order_services'),
  labor: await count('order_labor'),
  history: await count('order_status_history'),
  parts: await count('parts'),
  movements: await count('inventory_movements'),
  orderParts: await count('order_parts'),
  maintenance: await count('maintenance')
});

afterAll(closePool);

describe('seeds', () => {
  beforeEach(resetTables);

  test('cargan los datos de ejemplo y repetir el seed no duplica registros', async () => {
    await runSeeds(pool, () => {});
    const primera = await conteos();
    await runSeeds(pool, () => {});
    const segunda = await conteos();

    expect(primera).toMatchObject({
      users: 4,
      clients: 8,
      vehicles: 12,
      appointments: 6,
      orders: 8,
      parts: 13,
      movements: 25,
      orderParts: 7,
      maintenance: 8
    });
    expect(primera.services).toBeGreaterThan(0);
    expect(primera.labor).toBeGreaterThan(0);
    expect(segunda).toEqual(primera);
  });

  test('las cuentas iniciales guardan la contraseña del estándar solo como hash bcrypt', async () => {
    await runSeeds(pool, () => {});
    const passwords = await standardPasswords();
    expect(Object.keys(passwords).sort()).toEqual(['admin', 'mecanico', 'mecanico2', 'recepcion']);

    const [rows] = await pool.query('SELECT username, role, password_hash FROM users ORDER BY username');
    expect(rows.map((row) => `${row.username}:${row.role}`)).toEqual([
      'admin:ADMIN',
      'mecanico:MECHANIC',
      'mecanico2:MECHANIC',
      'recepcion:RECEPTIONIST'
    ]);
    for (const row of rows) {
      expect(row.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(row.password_hash).not.toBe(passwords[row.username]);
      expect(await comparePassword(passwords[row.username], row.password_hash)).toBe(true);
    }
  });
});

describe('integridad de los datos de ejemplo', () => {
  beforeEach(resetTables);

  test('todos los vehículos de ejemplo tienen propietario y un cliente sin vehículos', async () => {
    await runSeeds(pool, () => {});
    const [huerfanos] = await pool.query(
      'SELECT COUNT(*) AS total FROM vehicles v LEFT JOIN clients c ON c.id = v.client_id WHERE c.id IS NULL'
    );
    expect(huerfanos[0].total).toBe(0);

    const [sinVehiculos] = await pool.query(
      'SELECT COUNT(*) AS total FROM clients c WHERE c.active = 1 AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.client_id = c.id)'
    );
    expect(sinVehiculos[0].total).toBe(1);
  });

  test('ningún cliente desactivado conserva vehículos activos', async () => {
    await runSeeds(pool, () => {});
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS total FROM vehicles v JOIN clients c ON c.id = v.client_id WHERE c.active = 0 AND v.active = 1'
    );
    expect(rows[0].total).toBe(0);
  });
});

describe('citas y órdenes de ejemplo', () => {
  beforeEach(resetTables);

  test('hay órdenes en los siete estados y citas en los cinco', async () => {
    await runSeeds(pool, () => {});
    // En un ENUM, ORDER BY ordena por posición y no alfabéticamente: se ordena aquí para comparar.
    const [ordenes] = await pool.query('SELECT DISTINCT status FROM service_orders');
    expect(ordenes.map((fila) => fila.status).sort()).toEqual(
      ['CANCELADA', 'DIAGNOSTICO', 'EN_REPARACION', 'ENTREGADO', 'ESPERANDO_REFACCION', 'RECIBIDO', 'TERMINADO'].sort()
    );
    const [citas] = await pool.query('SELECT DISTINCT status FROM appointments');
    expect(citas.map((fila) => fila.status).sort()).toEqual(['CANCELADA', 'COMPLETADA', 'CONFIRMADA', 'EN_PROCESO', 'PENDIENTE']);
  });

  test('ninguna orden abierta está repetida por vehículo', async () => {
    await runSeeds(pool, () => {});
    const [repetidas] = await pool.query(
      `SELECT vehicle_id, COUNT(*) AS total FROM service_orders
       WHERE status NOT IN ('ENTREGADO','CANCELADA') GROUP BY vehicle_id HAVING COUNT(*) > 1`
    );
    expect(repetidas).toHaveLength(0);
  });

  test('cada orden tiene historial coherente con su estado actual', async () => {
    await runSeeds(pool, () => {});
    const [ordenes] = await pool.query('SELECT id, folio, status FROM service_orders');
    for (const orden of ordenes) {
      const [historial] = await pool.query(
        'SELECT from_status, to_status FROM order_status_history WHERE order_id = ? ORDER BY changed_at, id',
        [orden.id]
      );
      expect({ folio: orden.folio, primero: historial[0].from_status }).toEqual({ folio: orden.folio, primero: null });
      expect({ folio: orden.folio, ultimo: historial.at(-1).to_status }).toEqual({ folio: orden.folio, ultimo: orden.status });
      historial.slice(1).forEach((paso, i) => {
        expect(paso.from_status).toBe(historial[i].to_status);
      });
    }
  });

  test('el contador de folios coincide con el mayor folio sembrado', async () => {
    await runSeeds(pool, () => {});
    const [folios] = await pool.query('SELECT folio FROM service_orders');
    const mayor = Math.max(...folios.map((fila) => Number(fila.folio.split('-')[2])));
    const [contador] = await pool.query('SELECT last_number FROM folio_counters WHERE year = 2026');
    expect(contador[0].last_number).toBe(mayor);
  });

  test('las citas EN_PROCESO y COMPLETADA están vinculadas a una orden y las demás no', async () => {
    await runSeeds(pool, () => {});
    const [citas] = await pool.query(
      `SELECT a.status, o.folio, o.status AS estado_orden
       FROM appointments a LEFT JOIN service_orders o ON o.appointment_id = a.id`
    );
    for (const cita of citas) {
      if (cita.status === 'EN_PROCESO') {
        expect(cita.folio).not.toBeNull();
        expect(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO']).toContain(cita.estado_orden);
      } else if (cita.status === 'COMPLETADA') {
        expect(cita.estado_orden).toBe('ENTREGADO');
      } else {
        expect(cita.folio).toBeNull();
      }
    }
  });

  test('las órdenes entregadas tienen fecha de entrega y las canceladas, motivo', async () => {
    await runSeeds(pool, () => {});
    const [ordenes] = await pool.query('SELECT status, delivered_at, cancel_reason FROM service_orders');
    for (const orden of ordenes) {
      expect(orden.delivered_at !== null).toBe(orden.status === 'ENTREGADO');
      expect(orden.cancel_reason !== null).toBe(orden.status === 'CANCELADA');
    }
  });

  test('las órdenes se reparten entre los dos mecánicos', async () => {
    await runSeeds(pool, () => {});
    const [reparto] = await pool.query(
      `SELECT u.username, COUNT(*) AS total FROM service_orders o JOIN users u ON u.id = o.mechanic_id
       GROUP BY u.username ORDER BY u.username`
    );
    expect(reparto.map((fila) => fila.username)).toEqual(['mecanico', 'mecanico2']);
    reparto.forEach((fila) => expect(fila.total).toBeGreaterThan(1));
  });

  test('el kilometraje de cada vehículo no es menor al de entrada de sus órdenes', async () => {
    await runSeeds(pool, () => {});
    const [incoherentes] = await pool.query(
      'SELECT COUNT(*) AS total FROM service_orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE v.current_mileage < o.entry_mileage'
    );
    expect(incoherentes[0].total).toBe(0);
  });

  test('una orden nueva continúa la numeración después de los datos de ejemplo', async () => {
    await runSeeds(pool, () => {});
    const { nextFolio } = await import('../../services/folioService.js');
    expect(await nextFolio(pool, new Date(2026, 5, 1))).toBe('OS-2026-0009');
  });
});

describe('refacciones e inventario de ejemplo', () => {
  beforeEach(resetTables);

  test('el stock de cada refacción es la suma de sus movimientos y nunca es negativo', async () => {
    await runSeeds(pool, () => {});
    const [partes] = await pool.query('SELECT id, code, stock FROM parts');
    expect(partes.length).toBeGreaterThan(0);
    for (const parte of partes) {
      const [[suma]] = await pool.query('SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory_movements WHERE part_id = ?', [parte.id]);
      expect({ code: parte.code, stock: parte.stock, suma: Number(suma.total) }).toEqual({
        code: parte.code,
        stock: parte.stock,
        suma: parte.stock
      });
      expect(parte.stock).toBeGreaterThanOrEqual(0);
    }
  });

  test('el stock posterior de cada movimiento es coherente con los anteriores', async () => {
    await runSeeds(pool, () => {});
    const [partes] = await pool.query('SELECT id FROM parts');
    for (const parte of partes) {
      const [movimientos] = await pool.query('SELECT quantity, stock_after FROM inventory_movements WHERE part_id = ? ORDER BY created_at, id', [parte.id]);
      let acumulado = 0;
      for (const movimiento of movimientos) {
        acumulado += movimiento.quantity;
        expect(movimiento.stock_after).toBe(acumulado);
      }
    }
  });

  test('hay refacciones en nivel normal, bajo y agotado, y una desactivada que no genera alerta', async () => {
    await runSeeds(pool, () => {});
    const [partes] = await pool.query('SELECT code, stock, min_stock, active FROM parts');
    const nivel = (p) => (p.stock === 0 ? 'AGOTADO' : p.stock <= p.min_stock ? 'BAJO' : 'NORMAL');
    const activas = partes.filter((p) => p.active);
    expect(new Set(activas.map(nivel))).toEqual(new Set(['NORMAL', 'BAJO', 'AGOTADO']));
    const inactivas = partes.filter((p) => !p.active);
    expect(inactivas.length).toBeGreaterThanOrEqual(1);
    expect(inactivas.some((p) => p.stock <= p.min_stock)).toBe(true);

    const [alertas] = await pool.query('SELECT code FROM parts WHERE active = 1 AND stock <= min_stock');
    expect(alertas.length).toBeGreaterThanOrEqual(3);
  });

  test('cada refacción usada en una orden tiene su movimiento de salida ligado a esa orden', async () => {
    await runSeeds(pool, () => {});
    const [lineas] = await pool.query('SELECT order_id, part_id, quantity, unit_price FROM order_parts');
    expect(lineas.length).toBeGreaterThan(0);
    for (const linea of lineas) {
      const [[salida]] = await pool.query(
        "SELECT COUNT(*) AS total FROM inventory_movements WHERE order_id = ? AND part_id = ? AND type = 'SALIDA' AND quantity = ?",
        [linea.order_id, linea.part_id, -linea.quantity]
      );
      expect(salida.total).toBe(1);
      const [[parte]] = await pool.query('SELECT sale_price FROM parts WHERE id = ?', [linea.part_id]);
      expect(Number(linea.unit_price)).toBe(Number(parte.sale_price));
    }
  });

  test('el total de las órdenes incluye servicios, mano de obra y refacciones', async () => {
    await runSeeds(pool, () => {});
    const [ordenes] = await pool.query('SELECT id FROM service_orders');
    let conRefacciones = 0;
    for (const { id } of ordenes) {
      const orden = await orderModel.findById(id);
      const [[refacciones]] = await pool.query('SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM order_parts WHERE order_id = ?', [id]);
      if (Number(refacciones.total) > 0) {
        conRefacciones += 1;
      }
      expect(orden.partsTotal).toBe(Number(refacciones.total));
      expect(orden.total).toBe(Math.round((orden.servicesTotal + orden.laborTotal + orden.partsTotal) * 100) / 100);
    }
    expect(conRefacciones).toBeGreaterThanOrEqual(3);
  });

  test('las órdenes terminadas y entregadas tienen kilometraje del servicio coherente con el del vehículo', async () => {
    await runSeeds(pool, () => {});
    const [ordenes] = await pool.query(
      "SELECT o.folio, o.entry_mileage, o.service_mileage, v.current_mileage FROM service_orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.status IN ('TERMINADO','ENTREGADO')"
    );
    expect(ordenes.length).toBeGreaterThanOrEqual(3);
    for (const orden of ordenes) {
      expect(orden.service_mileage).not.toBeNull();
      expect(orden.service_mileage).toBeGreaterThanOrEqual(orden.entry_mileage);
      expect(orden.current_mileage).toBeGreaterThanOrEqual(orden.service_mileage);
    }
  });
});

describe('mantenimientos de ejemplo', () => {
  beforeEach(resetTables);

  test('hay mantenimientos Normal, Próximo y Vencido, uno atendido y uno cancelado', async () => {
    await runSeeds(pool, () => {});
    const filtros = { status: 'PROGRAMADO', q: '', page: 1, pageSize: 50 };
    const pendientes = await listMaintenance(filtros);
    expect(new Set(pendientes.data.map((m) => m.visualStatus))).toEqual(new Set(['NORMAL', 'PROXIMO', 'VENCIDO']));
    // Vencidos por fecha y por kilometraje.
    const vencidos = pendientes.data.filter((m) => m.visualStatus === 'VENCIDO');
    expect(vencidos.some((m) => m.dueDate !== null && m.remainingDays < 0)).toBe(true);
    expect(vencidos.some((m) => m.dueMileage !== null && m.remainingKm <= 0)).toBe(true);
    // Los más urgentes aparecen primero.
    expect(pendientes.data[0].visualStatus).toBe('VENCIDO');

    const [[atendidos]] = await pool.query("SELECT COUNT(*) AS total FROM maintenance WHERE status = 'ATENDIDO'");
    const [[cancelados]] = await pool.query("SELECT COUNT(*) AS total FROM maintenance WHERE status = 'CANCELADO' AND cancel_reason IS NOT NULL");
    expect(atendidos.total).toBe(1);
    expect(cancelados.total).toBe(1);
  });

  test('ningún vehículo repite un mantenimiento pendiente con la misma descripción', async () => {
    await runSeeds(pool, () => {});
    const [repetidos] = await pool.query(
      "SELECT vehicle_id, description, COUNT(*) AS total FROM maintenance WHERE status = 'PROGRAMADO' GROUP BY vehicle_id, description HAVING COUNT(*) > 1"
    );
    expect(repetidos).toHaveLength(0);
  });
});
