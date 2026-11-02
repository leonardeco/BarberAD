# BarberAD

Caja de una barbería para usarla de pie, con el celular en la mano.

El dueño registra la barbería, arma los servicios, mete al equipo, cobra un corte y cierra la caja del día. El barbero entra y solo ve Hoy y Cobrar.

## Arrancar

Hace falta Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:3000

`npm run dev` enciende Postgres en esta máquina, crea la base `barberad` si no existe y levanta la app. Los datos quedan en `data/` y no se suben. El puerto es el 5433, para no chocar con un Postgres que ya tengas. La primera vez descarga el binario y puede tardar.

Entra por http://localhost:3000/registro. La contraseña pide al menos 8 caracteres.

## Qué se puede hacer

1. **Registro.** Tu nombre, el de la barbería, el correo y la contraseña.
2. **Servicios.** Nombre, duración y precio en pesos enteros.
3. **Equipo.** Un barbero con su correo, una contraseña inicial y el porcentaje de comisión. Esa contraseña se define ahí y no se vuelve a mostrar.
4. **Cobrar.** Servicio, valor y método: efectivo, transferencia o tarjeta. Si el valor baja, hace falta el motivo del descuento. La propina no entra en la comisión.
5. **Hoy.** Los cortes del día, la comisión y el efectivo.
6. **Caja.** El efectivo esperado y el cierre. Cerrada, ese día no recibe otro cobro.

## Configuración

`.env.example` trae valores para esta máquina y se lee solo. Para cambiarlos, copia ese archivo a `.env.local`. Lo que esté en `.env.local` pisa el ejemplo y no entra al repositorio.

| Variable | Para qué sirve |
| --- | --- |
| `PG_PORT` | Puerto de Postgres. Por defecto `5433`. |
| `PG_SUPER_PASSWORD` | Clave del usuario que crea la base. |
| `PG_APP_PASSWORD` | Clave del rol con el que entra la app. |
| `SESSION_SECRET` | Secreto con el que se guarda la sesión. |

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Migra y abre el servidor en el puerto 3000. |
| `npm test` | Comprueba que una barbería no vea el cobro de otra y que un cobro no se pueda editar. Usa la base `barberad_test`. |
| `npm run db:migrate` | Vuelve a aplicar el esquema sobre `barberad`. |
| `npm run build` | Compila. |
| `npm start` | Sirve la compilación. No enciende Postgres: para trabajar, usa `npm run dev`. |
