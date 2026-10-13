// Formato uniforme de las respuestas JSON de la API.
export function sendData(res, data, status = 200) {
  return res.status(status).json({ data });
}

export function sendPage(res, { data, page, pageSize, total }) {
  return res.status(200).json({ data, meta: { page, pageSize, total } });
}

export function sendNoContent(res) {
  return res.status(204).end();
}
