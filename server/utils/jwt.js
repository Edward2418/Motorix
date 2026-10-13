import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { algorithm: 'HS256', expiresIn: env.jwt.expiresIn });
}

// Devuelve el payload si el token es válido; lanza el error de jsonwebtoken si no lo es o venció.
export function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
}

// Vigencia en segundos del token recién emitido (para informarla al cliente).
export function decodeExpiresIn(token) {
  const { iat, exp } = jwt.decode(token);
  return exp - iat;
}
