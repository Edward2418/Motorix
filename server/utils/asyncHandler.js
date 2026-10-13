// Envuelve un controlador async para enviar sus errores al manejador central.
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
