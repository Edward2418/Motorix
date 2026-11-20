import * as notificationModel from '../models/notificationModel.js';
import * as partModel from '../models/partModel.js';
import { AppError } from '../utils/AppError.js';
import { resolvePeriod } from './dashboardPeriods.js';
import { listAttentionMaintenance } from './maintenanceService.js';
import {
  GROUP_ORDER,
  STALE_AFTER_DAYS,
  isStaleOrder,
  TYPE_LABELS,
  buildKey,
  keyPrefixOf,
  parseKey,
  severityOf,
  visibleTypes
} from './notificationRules.js';

// Cuántos avisos por tipo muestra el panel. Los totales y el contador siempre se calculan con la lista completa.
const ITEMS_PER_GROUP = 10;

/**
 * Servicio de notificaciones internas. Los avisos no se guardan: cada proveedor (`{ type, list, keys? }`) los calcula
 * al consultar con los datos existentes, y aquí solo se combinan con las lecturas del usuario.
 *
 * - `list({ user, now })` devuelve la lista COMPLETA de avisos de ese tipo: `[{ key, title, detail, target }]`.
 * - `keys({ user, now })` (opcional) devuelve solo las claves, sin armar títulos ni detalle; el contador la prefiere.
 *
 * `providers` y `model` se inyectan para poder probar el motor con datos falsos.
 */
export function createNotificationService({ providers = [], model = notificationModel } = {}) {
  // Proveedores que el rol puede ver, en el orden de los grupos del panel. Se leen en cada consulta, de modo que los
  // proveedores registrados después de crear el servicio también cuentan.
  function providersFor(user) {
    const byType = new Map(providers.map((provider) => [provider.type, provider]));
    const allowed = new Set(visibleTypes(user?.role));
    return GROUP_ORDER.filter((type) => allowed.has(type) && byType.has(type)).map((type) => byType.get(type));
  }

  const isRead = (reads, key, severity) => reads.has(key) && reads.get(key) >= severity;

  async function readsOf(user) {
    return new Map((await model.listReads(user.id)).map((read) => [read.key, read.severity]));
  }

  /** Avisos del usuario agrupados por tipo: `{ unread, groups }`. Solo se limita `items`; todo lo demás es exacto. */
  async function getCenter(user, { now = new Date() } = {}) {
    const providerList = providersFor(user);
    const lists = await Promise.all(providerList.map((provider) => provider.list({ user, now })));
    const reads = await readsOf(user);

    const groups = [];
    const activeKeys = [];
    let unread = 0;
    providerList.forEach((provider, index) => {
      const items = lists[index];
      const severity = severityOf(provider.type);
      const mapped = items.map((item) => ({
        key: item.key,
        type: provider.type,
        severity,
        title: item.title,
        detail: item.detail,
        read: isRead(reads, item.key, severity),
        target: item.target
      }));
      items.forEach((item) => activeKeys.push(item.key));
      if (mapped.length === 0) {
        return;
      }
      const groupUnread = mapped.filter((aviso) => !aviso.read).length;
      unread += groupUnread;
      groups.push({
        type: provider.type,
        label: TYPE_LABELS[provider.type],
        total: mapped.length,
        unread: groupUnread,
        items: mapped.slice(0, ITEMS_PER_GROUP)
      });
    });

    // La limpieza usa TODAS las claves activas (no solo las 10 mostradas): así un aviso leído no se pierde por no caber.
    await model.deleteReadsNotIn(user.id, activeKeys);
    return { unread, groups };
  }

  /** Total de avisos no leídos. Calcula solo claves y gravedades y las compara con las lecturas del usuario. */
  async function getUnreadCount(user, { now = new Date() } = {}) {
    const providerList = providersFor(user);
    const lists = await Promise.all(
      providerList.map((provider) => (provider.keys ? provider.keys({ user, now }) : provider.list({ user, now })))
    );
    const reads = await readsOf(user);
    let unread = 0;
    providerList.forEach((provider, index) => {
      const severity = severityOf(provider.type);
      unread += lists[index].filter((item) => !isRead(reads, item.key, severity)).length;
    });
    return unread;
  }

  /** Marca un aviso como leído con su gravedad actual. Solo funciona con avisos que el usuario puede ver. */
  async function markRead(user, key, { now = new Date() } = {}) {
    const parsed = parseKey(key);
    if (!parsed) {
      throw AppError.notificationNotFound();
    }
    // Se busca entre TODOS los avisos visibles del usuario (no solo los 10 mostrados) y solo en los tipos de su prefijo.
    const candidates = providersFor(user).filter((provider) => keyPrefixOf(provider.type) === parsed.prefix);
    let severity = null;
    for (const provider of candidates) {
      const items = provider.keys ? await provider.keys({ user, now }) : await provider.list({ user, now });
      if (items.some((item) => item.key === key)) {
        severity = severityOf(provider.type);
        break;
      }
    }
    if (severity === null) {
      throw AppError.notificationNotFound();
    }
    await model.upsertRead(user.id, key, severity);
    return { key, read: true, unread: await getUnreadCount(user, { now }) };
  }

  return { getCenter, getUnreadCount, markRead };
}

/**
 * Proveedor de avisos de stock. Reutiliza `partModel.listAlerts()` (refacciones activas con `stock <= min_stock`, la
 * misma consulta de las alertas de Inventario y del panel) y separa por nivel: BAJO o AGOTADO. No incluye el precio de
 * compra (solo es para administración y el aviso no lo necesita).
 */
function stockProvider(type, level) {
  const alerts = async () =>
    (await partModel.listAlerts())
      .map((row) => partModel.toPart(row, { includePurchasePrice: false }))
      .filter((part) => part.stockLevel === level);
  return {
    type,
    async list() {
      return (await alerts()).map((part) => ({
        key: buildKey('STOCK', part.id),
        title: `${part.code} · ${part.name}`,
        detail:
          level === 'AGOTADO'
            ? `Agotada: 0 en existencia (mínimo ${part.minStock})`
            : `Stock bajo: ${part.stock} en existencia (mínimo ${part.minStock})`,
        target: { module: 'inventory', id: part.id }
      }));
    },
    async keys() {
      return (await alerts()).map((part) => ({ key: buildKey('STOCK', part.id) }));
    }
  };
}

const pluralize = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

// Texto de cuánto falta (o cuánto se pasó) del mantenimiento, por fecha y/o por kilometraje.
function maintenanceDueText(item) {
  const parts = [];
  if (item.remainingDays !== null) {
    const days = item.remainingDays;
    if (days < 0) {
      parts.push(`venció hace ${pluralize(-days, 'día', 'días')}`);
    } else if (days === 0) {
      parts.push('vence hoy');
    } else {
      parts.push(`vence en ${pluralize(days, 'día', 'días')}`);
    }
  }
  if (item.remainingKm !== null) {
    const km = Math.abs(item.remainingKm).toLocaleString('en-US');
    parts.push(item.remainingKm <= 0 ? `superó el kilometraje por ${km} km` : `faltan ${km} km`);
  }
  return parts.join(' · ');
}

/**
 * Proveedor de avisos de mantenimiento. Reutiliza `listAttentionMaintenance` (los mismos umbrales y la misma
 * clasificación que el listado de Mantenimientos y el panel) y separa por estado visual: PROXIMO o VENCIDO.
 */
function maintenanceProvider(type, visualStatus) {
  const attention = async (now) => (await listAttentionMaintenance({ now })).filter((item) => item.visualStatus === visualStatus);
  return {
    type,
    async list({ now }) {
      return (await attention(now)).map((item) => ({
        key: buildKey('MAINT', item.id),
        title: item.description,
        detail: `${item.vehicleLabel} · ${item.clientName} · ${maintenanceDueText(item)}`,
        target: { module: 'maintenance', id: item.id }
      }));
    },
    async keys({ now }) {
      return (await attention(now)).map((item) => ({ key: buildKey('MAINT', item.id) }));
    }
  };
}

const hourOf = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * Proveedor de citas del día: citas de hoy `PENDIENTE` o `CONFIRMADA` (la misma condición del panel), con el rango del
 * día de `dashboardPeriods`. Una cita cancelada, de otro día o ya atendida no genera aviso.
 */
function appointmentProvider(model) {
  const today = (now) => model.todayAppointments(resolvePeriod('today', now));
  return {
    type: 'APPOINTMENT_TODAY',
    async list({ now }) {
      return (await today(now)).map((cita) => ({
        key: buildKey('APPT', cita.id),
        title: `Cita de ${cita.clientName}`,
        detail: `${hourOf(new Date(cita.scheduledAt))} · ${cita.vehicleLabel} · ${cita.status === 'CONFIRMADA' ? 'Confirmada' : 'Pendiente'}`,
        target: { module: 'appointments', id: cita.id }
      }));
    },
    async keys({ now }) {
      return (await today(now)).map((cita) => ({ key: buildKey('APPT', cita.id) }));
    }
  };
}

const MS_PER_DAY = 86400000;

/**
 * Proveedor de órdenes detenidas: abiertas con más de `STALE_AFTER_DAYS` días sin cambio de estado. El mecánico solo
 * recibe las suyas: el filtro por `mechanicId` va en la propia consulta SQL, no después.
 */
function staleOrderProvider(model) {
  const stale = async ({ user, now }) => {
    const olderThan = new Date(now.getTime() - STALE_AFTER_DAYS * MS_PER_DAY);
    const rows = await model.listStaleOrders({ olderThan, mechanicId: user.role === 'MECHANIC' ? user.id : null });
    // Mismo criterio de `notificationRules` como segunda barrera (por ejemplo, ante un estado que ya no aplique).
    return rows.filter((order) => isStaleOrder({ status: order.status, lastChangeAt: order.lastChangeAt, now }));
  };
  return {
    type: 'ORDER_STALE',
    async list({ user, now }) {
      return (await stale({ user, now })).map((order) => {
        // Días completos. Se suma 1 s porque MySQL redondea los segundos de DATETIME y un cambio de hace 5 días justos
        // no debe mostrarse como 4.
        const days = Math.floor((now.getTime() - new Date(order.lastChangeAt).getTime() + 1000) / MS_PER_DAY);
        return {
          key: buildKey('ORDER', order.id),
          title: `Orden ${order.folio}`,
          detail: `${order.vehicleLabel} · ${order.clientName} · ${pluralize(days, 'día', 'días')} sin cambio de estado`,
          target: { module: 'orders', id: order.id }
        };
      });
    },
    async keys({ user, now }) {
      return (await stale({ user, now })).map((order) => ({ key: buildKey('ORDER', order.id) }));
    }
  };
}

// Instancia por defecto. Los proveedores reales se registran en este arreglo conforme se construye cada historia:
// stock (historia 1), mantenimientos y citas (historia 2) y órdenes detenidas (historia 4).
export const defaultProviders = [
  stockProvider('STOCK_LOW', 'BAJO'),
  stockProvider('STOCK_OUT', 'AGOTADO'),
  maintenanceProvider('MAINTENANCE_SOON', 'PROXIMO'),
  maintenanceProvider('MAINTENANCE_OVERDUE', 'VENCIDO'),
  appointmentProvider(notificationModel),
  staleOrderProvider(notificationModel)
];
export const notificationService = createNotificationService({ providers: defaultProviders });
