# Base de datos de Motorix

MySQL local (instalación nativa, sin Docker), motor InnoDB, codificación `utf8mb4`.
Cada integrante usa su propia instancia. El frontend nunca se conecta a la base: solo el backend.

## Estructura

```text
database/
├── migrations/   Scripts SQL numerados e inmutables (esquema): 001 usuarios, clientes y vehículos;
│                 002 citas y órdenes de servicio; 003 intentos de inicio de sesión;
│                 004 inventario, mantenimientos y kilometraje del servicio;
│                 005 pagos, tickets y su contador de folios
├── seeds/        Datos de ejemplo idempotentes: 001 usuarios, 002 clientes, 003 vehículos, 004 citas,
│                 005 órdenes de servicio (crea también al segundo mecánico, `mecanico2`),
│                 006 refacciones, movimientos y su uso en las órdenes, 007 mantenimientos,
│                 008 pagos de ejemplo (los cuatro métodos y estados), 009 tickets de ejemplo
├── scripts/      Creación de las bases y del usuario de la aplicación
├── data/         (opcional, ignorada por Git) archivos físicos de MySQL
└── README.md
```

Reglas:

- Los cambios de esquema se agregan como **nuevos** scripts numerados; no se editan los de sprints ya aplicados.
- Los seeds se pueden ejecutar varias veces sin duplicar registros.
- Los seeds nunca contienen contraseñas en texto plano: solo el hash bcrypt.

## Preparar la base desde cero

1. Edita la contraseña de ejemplo en `scripts/create-database.sql` y ejecútalo con una cuenta administrativa:

   ```text
   mysql -u root -p < database/scripts/create-database.sql
   ```

   Crea las bases `motorix` y `motorix_test` y el usuario `motorix_app` (permisos solo sobre esas bases).

2. En la raíz del proyecto, copia `.env.example` a `.env` y completa `DB_USER=motorix_app`,
   `DB_PASSWORD` y `JWT_SECRET`. Crea también `.env.test` con los mismos valores pero
   `DB_NAME=motorix_test` y `NODE_ENV=test`. Ambos archivos están ignorados por Git.

3. Desde `server/`:

   ```text
   npm install
   npm run db:migrate
   npm run db:seed
   ```

## Reiniciar la base local

Para recrearla desde cero: `DROP DATABASE motorix;` con la cuenta administrativa, vuelve a ejecutar
`scripts/create-database.sql` y repite `npm run db:migrate` y `npm run db:seed`.

Las migraciones aplicadas se registran en la tabla `schema_migrations`; ejecutar de nuevo
`npm run db:migrate` omite las que ya están aplicadas.

## Verificación de la recreación desde cero (Sprint 1)

Se comprobó el procedimiento completo en una instancia local: con la base `motorix` eliminada y vuelta a
crear, `npm run db:migrate` aplica `001_sprint1_users_clients_vehicles.sql` y `npm run db:seed` carga
3 usuarios, 8 clientes y 12 vehículos. Repetir ambos comandos no cambia los conteos (los seeds son idempotentes).
