import { AppError } from '../utils/AppError.js';
import {
  FieldErrors,
  isPlainObject,
  parseAmount,
  parseNonNegativeInt,
  parsePagination,
  requiredText,
  requireBody
} from './common.js';
import { MAX_STOCK } from '../services/stockRules.js';

export const STOCK_LEVELS = Object.freeze(['NORMAL', 'BAJO', 'AGOTADO']);

const has = (data, field) => Object.prototype.hasOwnProperty.call(data, field);

// Confirmación explícita para guardar un precio de venta menor al de compra: booleano opcional. Si la petición no lo
// trae, el resultado no lo incluye (undefined) y se entiende como no confirmado.
function parseConfirmBelowCost(errors, data) {
  if (!has(data, 'confirmBelowCost')) {
    return undefined;
  }
  if (typeof data.confirmBelowCost !== 'boolean') {
    errors.add('confirmBelowCost', 'La confirmación debe ser verdadero o falso.');
    return undefined;
  }
  return data.confirmBelowCost;
}

// Alta de una refacción. `initialStock` es opcional (0 por defecto) y genera el movimiento «Stock inicial».
export function validatePartCreate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();

  const code = requiredText(errors, data, 'code', 'El código', 40);
  const name = requiredText(errors, data, 'name', 'El nombre', 120);
  const category = requiredText(errors, data, 'category', 'La categoría', 60);
  const brand = requiredText(errors, data, 'brand', 'La marca', 60);
  const initialStock = has(data, 'initialStock')
    ? parseNonNegativeInt(errors, data.initialStock, 'initialStock', 'El stock inicial', MAX_STOCK)
    : 0;
  const minStock = parseNonNegativeInt(errors, data.minStock, 'minStock', 'El stock mínimo', MAX_STOCK);
  const purchasePrice = parseAmount(errors, data.purchasePrice, 'purchasePrice', 'El precio de compra');
  const salePrice = parseAmount(errors, data.salePrice, 'salePrice', 'El precio de venta');
  const confirmBelowCost = parseConfirmBelowCost(errors, data);

  errors.throwIfAny();
  return { code, name, category, brand, initialStock, minStock, purchasePrice, salePrice, confirmBelowCost };
}

// Edición parcial: solo se actualizan los campos enviados. El stock jamás se edita aquí.
export function validatePartUpdate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const fields = {};

  if (has(data, 'stock') || has(data, 'initialStock')) {
    errors.add('stock', 'El stock solo cambia mediante movimientos de inventario.');
  }
  const texts = [
    ['code', 'El código', 40],
    ['name', 'El nombre', 120],
    ['category', 'La categoría', 60],
    ['brand', 'La marca', 60]
  ];
  for (const [field, label, max] of texts) {
    if (has(data, field)) {
      fields[field] = requiredText(errors, data, field, label, max);
    }
  }
  if (has(data, 'minStock')) {
    fields.minStock = parseNonNegativeInt(errors, data.minStock, 'minStock', 'El stock mínimo', MAX_STOCK);
  }
  if (has(data, 'purchasePrice')) {
    fields.purchasePrice = parseAmount(errors, data.purchasePrice, 'purchasePrice', 'El precio de compra');
  }
  if (has(data, 'salePrice')) {
    fields.salePrice = parseAmount(errors, data.salePrice, 'salePrice', 'El precio de venta');
  }
  // La confirmación no es un campo para actualizar: solo acompaña a un cambio de precios.
  const confirmBelowCost = parseConfirmBelowCost(errors, data);
  if (Object.keys(fields).length === 0 && errors.items.length === 0) {
    errors.add('body', 'Indica al menos un campo para actualizar.');
  }

  errors.throwIfAny();
  return { ...fields, confirmBelowCost };
}

function parseBooleanParam(value, name) {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw AppError.validation(`El parámetro ${name} debe ser true o false.`);
}

function parseTextParam(value, name, max) {
  if (value === undefined) {
    return '';
  }
  if (typeof value !== 'string' || value.length > max) {
    throw AppError.validation(`El parámetro ${name} debe ser texto de hasta ${max} caracteres.`);
  }
  return value.trim();
}

// Filtros del listado: búsqueda, categoría, estado activo, nivel de stock, solo stock bajo y paginación.
export function validatePartListQuery(query) {
  const source = isPlainObject(query) ? query : {};
  const { page, pageSize } = parsePagination(source);
  let stockLevel;
  if (source.stockLevel !== undefined) {
    if (!STOCK_LEVELS.includes(source.stockLevel)) {
      throw AppError.validation(`El parámetro stockLevel debe ser uno de: ${STOCK_LEVELS.join(', ')}.`);
    }
    stockLevel = source.stockLevel;
  }
  return {
    q: parseTextParam(source.q, 'q', 100),
    category: parseTextParam(source.category, 'category', 60),
    active: parseBooleanParam(source.active, 'active'),
    stockLevel,
    lowStock: parseBooleanParam(source.lowStock, 'lowStock') ?? false,
    page,
    pageSize
  };
}
