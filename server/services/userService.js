import * as userModel from '../models/userModel.js';
import { hashPassword } from '../utils/hash.js';
import { AppError } from '../utils/AppError.js';

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

export async function createUser({ username, name, email, password, role }) {
  if (await userModel.findByUsername(username)) {
    throw AppError.conflict('Ya existe un usuario con ese nombre de usuario.');
  }
  if (await userModel.findByEmail(email)) {
    throw AppError.conflict('Ya existe un usuario con ese correo electrónico.');
  }
  try {
    return await userModel.create({ username, name, email, passwordHash: await hashPassword(password), role });
  } catch (error) {
    throw duplicateError(error);
  }
}

// Siempre debe quedar al menos un administrador activo; de lo contrario nadie podría gestionar el sistema.
async function assertNotLastAdmin(user, message) {
  if (user.role === 'ADMIN' && user.active && (await userModel.countActiveAdmins()) <= 1) {
    throw AppError.conflict(message);
  }
}

export async function updateUser(id, { name, email, role }) {
  const user = await getUser(id);
  if (role !== user.role && user.role === 'ADMIN') {
    await assertNotLastAdmin(user, 'No se puede quitar el rol de administrador al último administrador activo.');
  }
  const sameEmail = await userModel.findByEmail(email);
  if (sameEmail && sameEmail.id !== id) {
    throw AppError.conflict('Ya existe un usuario con ese correo electrónico.');
  }
  try {
    return await userModel.update(id, { name, email, role });
  } catch (error) {
    throw duplicateError(error);
  }
}

// Desactiva o reactiva un usuario (baja lógica). Un administrador no puede desactivarse a sí mismo.
export async function setUserStatus(id, active, actorId) {
  const user = await getUser(id);
  if (!active && user.active) {
    if (id === actorId) {
      throw AppError.conflict('No puedes desactivar tu propia cuenta.');
    }
    await assertNotLastAdmin(user, 'No se puede desactivar al último administrador activo.');
  }
  return userModel.updateStatus(id, active);
}
