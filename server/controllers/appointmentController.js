import * as appointmentService from '../services/appointmentService.js';
import {
  validateAppointmentCreate,
  validateAppointmentListQuery,
  validateAppointmentUpdate,
  validateCancel
} from '../validators/appointmentValidator.js';
import { parseId } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

const appointmentId = (req) => parseId(req.params.id, 'El identificador de la cita');

export async function list(req, res) {
  sendPage(res, await appointmentService.listAppointments(validateAppointmentListQuery(req.query)));
}

export async function get(req, res) {
  sendData(res, await appointmentService.getAppointment(appointmentId(req)));
}

export async function create(req, res) {
  const input = validateAppointmentCreate(req.body);
  sendData(res, await appointmentService.createAppointment(input, req.user), 201);
}

export async function update(req, res) {
  const id = appointmentId(req);
  sendData(res, await appointmentService.updateAppointment(id, validateAppointmentUpdate(req.body)));
}

export async function confirm(req, res) {
  sendData(res, await appointmentService.confirmAppointment(appointmentId(req)));
}

export async function cancel(req, res) {
  const id = appointmentId(req);
  sendData(res, await appointmentService.cancelAppointment(id, validateCancel(req.body)));
}
