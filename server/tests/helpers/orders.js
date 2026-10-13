import request from 'supertest';
import app from '../../app.js';
import { createClient, createVehicle, createMechanic, createOrder } from './db.js';
import { loginAs } from './auth.js';

// Inicia sesión con un usuario ya creado (por ejemplo, un mecánico de createMechanic) y devuelve su token.
export async function tokenDe(usuario) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier: usuario.username, password: usuario.password });
  return res.body.data.token;
}

// Prepara una orden asignada a un mecánico con sesión iniciada, más sesiones de administración,
// recepción y de otro mecánico, para probar permisos por rol y por propiedad.
export async function escenarioOrden(status = 'DIAGNOSTICO') {
  const mecanico = await createMechanic({ username: 'mecanico.asignado', name: 'Mecánico Asignado' });
  const otro = await createMechanic({ username: 'mecanico.ajeno', name: 'Mecánico Ajeno' });
  const client = await createClient({ name: 'Ana Pérez' });
  const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'ABC1234' });
  const orden = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status });

  return {
    orden,
    client,
    vehicle,
    mecanico,
    otro,
    tokens: {
      mecanico: await tokenDe(mecanico),
      otro: await tokenDe(otro),
      admin: (await loginAs('ADMIN')).token,
      recepcion: (await loginAs('RECEPTIONIST')).token
    }
  };
}
