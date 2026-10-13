# Modelo de datos: Base del sistema, clientes y vehículos (Sprint 1)

Motor MySQL (InnoDB, `utf8mb4`, intercalación `utf8mb4_0900_ai_ci`). Las columnas SQL usan
`snake_case`; la API las expone en `camelCase`. El script de creación es
`database/migrations/001_sprint1_users_clients_vehicles.sql` (más la tabla `schema_migrations`,
que crea el ejecutor de migraciones).

## Diagrama de relaciones

```text
users                 (independiente en este sprint)

clients 1 ────── N vehicles
          client_id (FK, NOT NULL, ON DELETE RESTRICT)
```

## Tabla `users` (Usuario)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE. 3 a 50 caracteres: letras, números, punto, guion y guion bajo |
| `name` | VARCHAR(100) | NOT NULL. Nombre completo |
| `email` | VARCHAR(254) | NOT NULL, UNIQUE. Formato de correo válido, en minúsculas |
| `password_hash` | CHAR(60) | NOT NULL. Hash bcrypt; nunca se devuelve por la API |
| `role` | ENUM('ADMIN','RECEPTIONIST','MECHANIC') | NOT NULL |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

**Validaciones**: contraseña nueva con mínimo 8 caracteres, una mayúscula, una minúscula y un
número (máximo 72 bytes por el límite de bcrypt). Un usuario no puede desactivarse a sí mismo ni
dejar al sistema sin un ADMIN activo.

**Estados**: `active = 1` ⇄ `active = 0` (se puede reactivar). Un usuario inactivo no inicia
sesión y sus tokens vigentes dejan de ser válidos.

## Tabla `clients` (Cliente)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `name` | VARCHAR(100) | NOT NULL. Nombre o razón social |
| `phone` | VARCHAR(20) | NOT NULL. Dígitos con `+`, espacios, guiones y paréntesis opcionales; entre 7 y 15 dígitos |
| `email` | VARCHAR(254) | NULL. Formato de correo válido, en minúsculas |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

**Índices**: `idx_clients_name (name)` y `idx_clients_phone (phone)` para la búsqueda.
Sin restricción de unicidad (ver `research.md`, punto 7).

**Estados**: `active = 1` ⇄ `active = 0`. No se puede desactivar mientras tenga vehículos
activos (409). Un cliente inactivo no admite vehículos nuevos.

## Tabla `vehicles` (Vehículo)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id`, ON DELETE RESTRICT. Propietario obligatorio y existente, y además activo al registrar |
| `brand` | VARCHAR(50) | NOT NULL |
| `model` | VARCHAR(50) | NOT NULL |
| `year` | SMALLINT UNSIGNED | NOT NULL. Entre 1950 y el año actual + 1 |
| `license_plate` | VARCHAR(15) | NOT NULL, UNIQUE. Mayúsculas, sin espacios ni guiones |
| `vin` | CHAR(17) | NULL, UNIQUE. 17 caracteres alfanuméricos sin `I`, `O` ni `Q`, en mayúsculas |
| `current_mileage` | INT UNSIGNED | NOT NULL, DEFAULT 0. Kilometraje inicial; la regla de no disminuir se aplica cuando se pueda actualizar (Sprint 2) |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

**Índices**: `UNIQUE (license_plate)`, `UNIQUE (vin)`, `idx_vehicles_client (client_id)`
(creado por la llave foránea).

**Estados**: `active = 1` ⇄ `active = 0`. Reactivar exige que el propietario esté activo (409).
En este sprint no se edita un vehículo ya registrado ni se cambia de propietario.

## Tabla `schema_migrations`

| Columna | Tipo | Reglas |
|---------|------|--------|
| `name` | VARCHAR(255), PK | Nombre del archivo de migración aplicado |
| `applied_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

## Datos iniciales (seeds)

Archivos `database/seeds/001_initial_users.sql`, `002_sample_clients.sql` y `003_sample_vehicles.sql` (uno por historia), idempotentes:

| Dato | Contenido |
|------|-----------|
| Usuarios | `admin` (ADMIN), `recepcion` (RECEPTIONIST) y `mecanico` (MECHANIC), con el hash bcrypt de la contraseña del estándar del MVP |
| Clientes | 8 de ejemplo; uno sin vehículos y uno desactivado |
| Vehículos | 12 de ejemplo repartidos entre los clientes activos; uno desactivado |

## Mapeo a la especificación

| Requisito | Dónde se refleja |
|-----------|------------------|
| FR-001, FR-005 | `users.username`, `users.email` únicos |
| FR-003 | `users.password_hash` |
| FR-004 | `users.role` |
| FR-010a | `vehicles.license_plate` única, `vehicles.vin` opcional |
| FR-010b | columna `active` en las tres tablas, sin borrado físico |
| FR-011 | `vehicles.client_id` NOT NULL con llave foránea |
| FR-015, FR-017 | migración numerada y seeds idempotentes |
