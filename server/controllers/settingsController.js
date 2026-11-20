import { settingsService } from '../services/settingsService.js';
import { validateSettingsBody } from '../validators/settingsValidator.js';
import { sendData } from '../utils/response.js';

// Configuración vigente del taller (solo administración, validado en la ruta).
export async function get(_req, res) {
  sendData(res, await settingsService.getView());
}

// Guarda los datos enviados (todo o nada) y responde la configuración vigente.
export async function update(req, res) {
  const entries = validateSettingsBody(req.body);
  sendData(res, await settingsService.update(entries, req.user));
}
