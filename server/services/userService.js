import * as orderModel from '../models/orderModel.js';
import * as userModel from '../models/userModel.js';
import { hashPassword } from '../utils/hash.js';
import { AppError } from '../utils/AppError.js';
import { auditService } from './auditService.js';

// Registro en la bitácora de una acción sobre una cuenta; `actor` es el administrador que la hace.
const auditUser = (actor, action, target, detail = null) =>
  auditService.record({ userId: actor.id, actor: actor.username, action, entity: 'USER', entityId: target.id, detail });

export async function listUsers(filters) {
  const { items, total } = await userModel.list(filters);
  return { data: items, page: filters.page, pageSize: filters.pageSize, total };
}

export async function getUser(id) {
  const user = await userModel.findById(id);
  if (!user) {
    throw AppError.notFound('El usuario no existe.');
  }
  return user;
}

function duplicateError(error) {
  if (error?.code !== 'ER_DUP_ENTRY') {
    return error;
  }
  return error.message.includes('uq_users_email')
    ? AppError.conflict('Ya existe un usuario con ese correo electrónico.')
    : AppError.conflict('Ya existe un usuario con ese nombre de usuario.');
}

export async function createUser({ username, name, email, password, role }, actor) {
  if (await userModel.findByUsername(username)) {
    throw AppError.conflict('Ya existe un usuario con ese nombre de usuario.');
  }
  if (await userModel.findByEmail(email)) {
    throw AppError.conflict('Ya existe un usuario con ese correo electrónico.');
  }
  let created;
  try {
    created = await userModel.create({ username, name, email, passwordHash: await hashPassword(password), role });
  } catch (error) {
    throw duplicateError(error);
  }
  await auditUser(actor, 'USER_CREATED', created, `rol: ${role}`);
  return created;
}

// Siempre debe quedar al menos un administrador activo; de lo contrario nadie podría gestionar el sistema.
async function assertNotLastAdmin(user, message) {
  if (user.role === 'ADMIN' && user.active && (await userModel.countActiveAdmins()) <= 1) {
    throw AppError.conflict(message);
  }
}

// Un mecánico con órdenes abiertas asignadas no puede desactivarse ni cambiar de rol hasta reasignarlas.
async function assertNoOpenOrders(user, accion) {
  if (user.role !== 'MECHANIC') {
    return;
  }
  const open = await orderModel.listOpenByMechanic(user.id);
  if (open.length > 0) {
    const folios = open.map((order) => order.folio).join(', ');
    throw AppError.conflict(
      'No se puede ' + accion + ' al mecánico porque tiene órdenes abiertas asignadas: ' + folios + '. Reasígnalas primero.'
    );
  }
}

export async function updateUser(id, { name, email, role }, actor) {
  const user = await getUser(id);
  if (role !== user.role && user.role === 'ADMIN') {
    await assertNotLastAdmin(user, 'No se puede quitar el rol de administrador al último administrador activo.');
  }
  if (role !== user.role) {
    await assertNoOpenOrders(user, 'cambiar el rol de');
  }
  const sameEmail = await userModel.findByEmail(email);
  if (sameEmail && sameEmail.id !== id) {
    throw AppError.conflict('Ya existe un usuario con ese correo electrónico.');
  }
  let updated;
  try {
    updated = await userModel.update(id, { name, email, role });
  } catch (error) {
    throw duplicateError(error);
  }
  if (role !== user.role) {
    await auditUser(actor, 'USER_ROLE_CHANGED', updated, `rol: ${user.role} → ${role}`);
  }
  return updated;
}

// Desactiva o reactiva un usuario (baja lógica). Un administrador no puede desactivarse a sí mismo.
export async function setUserStatus(id, active, actor) {
  const user = await getUser(id);
  if (!active && user.active) {
    if (id === actor.id) {
      throw AppError.conflict('No puedes desactivar tu propia cuenta.');
    }
    await assertNotLastAdmin(user, 'No se puede desactivar al último administrador activo.');
    await assertNoOpenOrders(user, 'desactivar');
  }
  const updated = await userModel.updateStatus(id, active);
  if (Boolean(user.active) !== active) {
    await auditUser(actor, active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', updated);
  }
  return updated;
}
