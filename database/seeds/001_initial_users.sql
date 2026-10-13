-- Cuentas iniciales del MVP (solo para entornos locales).
-- Contiene únicamente el hash bcrypt de cada contraseña del estándar; nunca texto plano.
-- Idempotente: si el usuario ya existe (por username), no se modifica.

INSERT INTO users (username, name, email, password_hash, role, active)
SELECT 'admin', 'Administrador Motorix', 'admin@motorix.local', '$2b$10$/ceKwwHLVMuLWjZUfvF4k./UDVKY4pAH7ceS29mFFzgKd0/NkOTCS', 'ADMIN', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin' OR email = 'admin@motorix.local');

INSERT INTO users (username, name, email, password_hash, role, active)
SELECT 'recepcion', 'Recepción Motorix', 'recepcion@motorix.local', '$2b$10$7s9rYhSCGXimEmAE4klsJuhA1I69nf071rW/xt3AgK0dTKVa0yyKa', 'RECEPTIONIST', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'recepcion' OR email = 'recepcion@motorix.local');

INSERT INTO users (username, name, email, password_hash, role, active)
SELECT 'mecanico', 'Mecánico Motorix', 'mecanico@motorix.local', '$2b$10$lG0buSHpfsOF9rkw/xBUHOodZodkB4Ve7eh7whjsto8HBYkc5cqbu', 'MECHANIC', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'mecanico' OR email = 'mecanico@motorix.local');

