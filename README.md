<p align="center">
  <img src="public/brand.svg" alt="BarberAD" width="280">
</p>

<p align="center">
  Caja de una barbería para usarla de pie, con el celular en la mano.
</p>

El dueño registra la barbería, arma la carta de servicios, mete al equipo, cobra un corte y cierra la caja del día. Cada barbero entra con su correo y solo ve sus cortes y su comisión.

![Panel del día visto por el dueño](docs/screenshots/hoy.png)

<table>
  <tr>
    <td width="68%"><img src="docs/screenshots/cobrar.png" alt="Cobro de un corte"></td>
    <td width="32%"><img src="docs/screenshots/barbero-movil.png" alt="Lo que ve el barbero en el celular"></td>
  </tr>
  <tr>
    <td>Cobrar: servicio, monto y pago, con la propina aparte.</td>
    <td>El barbero en el celular: su comisión del día.</td>
  </tr>
</table>

## Arrancar

Hace falta Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:3000

`npm run dev` enciende Postgres en esta máquina, crea la base `barberad` si no existe, aplica las migraciones y levanta la app. Los datos quedan en `data/` y no se suben. El puerto es el 5433, para no chocar con un Postgres que ya tengas. La primera vez descarga el binario y puede tardar.

Entra por http://localhost:3000/registro. La contraseña pide al menos 8 caracteres.

## Qué se puede hacer

**El dueño**

- **Registro.** Su nombre, el de la barbería, su WhatsApp, el correo y la contraseña, o con un toque en "Continuar con Google". Gratis y sin tarjeta.
- **Plan.** Gratis: hasta 2 barberos además del dueño y 50 reservas en línea al mes (agendar a mano no cuenta). Pro: todo ilimitado, pagado por adelantado con Wompi (tarjeta, PSE, Nequi), por 1, 6 o 12 meses con descuento. Se activa cuando Wompi confirma el pago y no se renueva solo.
- **Guía de inicio.** Al entrar, Hoy muestra cuatro pasos: armar la carta, cobrar el primer corte, sumar al equipo y completar los datos de la barbería. Se marcan solos y la guía desaparece cuando están todos, o antes si la oculta.
- **Servicios.** Nombre, duración y precio en pesos enteros. Trae plantillas de un toque (corte clásico, fade, barba, corte + barba, infantil, cejas) y cada servicio se puede editar o desactivar.
- **Equipo.** Cada barbero con su correo, una contraseña inicial y su porcentaje de comisión. Después puede cambiarle la comisión, que aplica desde el siguiente cobro, o ponerle una contraseña nueva si la olvidó.
- **Hoy.** Las citas que faltan por atender, con botón para cobrarlas. Lo cobrado por método de pago, el ticket promedio, las comisiones que se le deben al equipo, el efectivo que debe haber en la gaveta, los descuentos con su motivo y lo que hizo cada barbero.
- **Reportes.** Hoy, ayer, esta semana, este mes, el mes pasado o un rango de fechas. Lo principal es **cuánto le queda a la barbería**: lo cobrado menos las comisiones del equipo (lo que cobra el dueño con sus manos es todo de la barbería, y las propinas son de los barberos). Compara contra el período anterior y muestra cortes, ticket promedio, métodos de pago, día a día, por servicio y por barbero (su comisión, lo que deja a la barbería y qué tanto se llenó su agenda), y cuántas citas se atendieron, no vinieron o se cancelaron. Se baja a Excel.
- **Liquidar comisiones.** Lo que se le debe a cada barbero desde su último pago: comisión más propinas, que entraron a la caja. Al marcarlo como pagado queda registrado con los cobros exactos que cubre; un cobro no se paga dos veces y uno que entre mientras se liquida queda para el siguiente pago.
- **Comisión por servicio.** Opcional: por ejemplo 50% en cortes y 30% en barba. Si el servicio no la tiene, se usa la del barbero.
- **Cobrar a nombre de un barbero.** El dueño elige quién atendió; el cobro y la comisión quedan a nombre de ese barbero.
- **Anular un cobro.** Si se cobró mal, el dueño lo anula desde Hoy con un motivo. El cobro no se borra: queda tachado en "Anulados hoy" y deja de contar en la caja, los reportes y la liquidación. Si venía de una cita, la cita vuelve a quedar por cobrar. No se puede anular con la caja de ese día cerrada ni si la comisión ya se le pagó al barbero.
- **Caja.** El efectivo esperado contra el contado, con lo que sobra o falta, y los últimos siete cierres. Cerrada, ese día no recibe otro cobro.
- **Mi cuenta.** Teléfono, dirección, Instagram y una descripción de la barbería, que salen en la página pública, y el cambio de contraseña.

- **Agenda.** El día de cada barbero con sus citas, quién reservó en línea, botón de WhatsApp y cancelar. Desde ahí también se agenda a mano.
- **Enlace de reservas.** Cada barbería tiene su página pública (`/r/nombre-de-la-barberia`), con su descripción, dirección y botón de mapa, horario, WhatsApp e Instagram, y una vista previa con imagen al compartirla por WhatsApp. En ella el cliente elige servicio, barbero o "con quien esté libre", día y hora, y deja su nombre y WhatsApp. Solo ve horas libres dentro del horario, y la base de datos impide que dos citas del mismo barbero se crucen. Un mismo número puede tener máximo 3 citas pendientes.
- **Horarios.** Quién recibe citas y de qué hora a qué hora trabaja cada día. Los barberos nuevos arrancan de lunes a sábado, de 9:00 a 19:00; el dueño también, si al registrarse marca que atiende.
- **De la cita al cobro.** Cada cita pasa de reservada a confirmada, en silla y atendida. "Terminar y cobrar" abre el cobro con el servicio, el barbero y el precio de la cita; al confirmar, la cita queda atendida y no se puede cobrar dos veces. Si el dueño cobra la cita de un barbero, el cobro y la comisión quedan a nombre del barbero. "No vino" se marca cuando ya pasó la hora. El botón de WhatsApp abre un mensaje listo para confirmar la cita.
- **Avisos por WhatsApp (sin costo).** Una lista de mensajes por enviar: el recordatorio para las citas de mañana, el de las citas de las próximas 3 horas, el "gracias por venir" con el enlace para volver a reservar, y el "hace rato no vienes" para clientes que no vuelven hace más de 3 semanas. Cada botón abre WhatsApp con el mensaje escrito y queda anotado como enviado. El dueño puede cambiar los textos. Hoy avisa cuántos hay pendientes.
- **El cliente cancela solo.** El recordatorio y la confirmación de la reserva traen un enlace donde el cliente ve su cita y la puede cancelar; la hora queda libre y en la agenda sale "Canceló el cliente".
- **Clientes.** Se crean solos al reservar. Visitas, próxima cita, notas y WhatsApp.

**El barbero**

- **Cobrar.** Servicio, valor y método: efectivo, transferencia o tarjeta. Si el valor baja del precio, pide el motivo del descuento. La propina va aparte y no entra en la comisión.
- **Hoy.** Su comisión, sus cortes y sus propinas del día. No ve lo de los demás.
- **Agenda.** Solo la suya. Puede agendar y cancelar sus propias citas.
- **Avisos.** Los recordatorios y agradecimientos de sus propias citas.

**Cualquiera**

- **Instalar la app.** En el celular se agrega a la pantalla de inicio como una app, con su ícono y accesos directos a Cobrar y Agenda.
- **Términos y política de datos.** En `/terminos` y `/privacidad` (Ley 1581 de 2012). Quien reserva autoriza el uso de su nombre y WhatsApp para gestionar la cita.
- **Recuperar la contraseña.** Pide un enlace con su correo. El enlace dura 30 minutos, sirve una sola vez y al usarlo cierra la sesión en todos los dispositivos.

## Cómo se cuidan los datos

- Cada barbería solo lee y escribe lo suyo. Lo hace cumplir Postgres con seguridad por filas, no solo el código: la app entra con un rol que no puede saltársela.
- Un cobro no se edita ni se borra después de guardado.
- Las contraseñas se guardan con hash. La sesión y los enlaces de recuperación se guardan como hash del token, nunca el token.
- El correo de recuperación responde lo mismo exista o no la cuenta.

## Configuración

`.env.example` trae valores para esta máquina y se lee solo. Para cambiarlos, copia ese archivo a `.env.local`. Lo que esté en `.env.local` pisa el ejemplo y no entra al repositorio.

| Variable | Para qué sirve |
| --- | --- |
| `PG_PORT` | Puerto de Postgres. Por defecto `5433`. |
| `PG_SUPER_PASSWORD` | Clave del usuario que crea la base. |
| `PG_APP_PASSWORD` | Clave del rol con el que entra la app. |
| `SESSION_SECRET` | Secreto con el que se guarda la sesión. |
| `APP_URL` | Dirección pública de la app, para armar el enlace de recuperación. |

En local, sin `RESEND_API_KEY`, el enlace para recuperar la contraseña sale en la consola donde corre `npm run dev`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Migra y abre el servidor en el puerto 3000. |
| `npm test` | Comprueba que una barbería no vea ni edite lo de otra, que un cobro no se pueda cambiar, que los enlaces de recuperación sirvan una sola vez, que la caja cuente un cobro que entra mientras se cierra y los topes de los montos. Usa la base `barberad_test`. |
| `npm run typecheck` | Revisa los tipos de todo el proyecto, pruebas incluidas. |
| `npm run db:migrate` | Aplica las migraciones pendientes sobre `barberad`. |
| `npm run build` | Compila. |
| `npm start` | Sirve la compilación, como en producción: exige un `SESSION_SECRET` propio. No enciende Postgres: para trabajar, usa `npm run dev`. |

Las migraciones viven en `db/migrations/` y se aplican en orden. Cada una corre una sola vez.

### Si no arranca Postgres

El Postgres embebido no corre como `root` (es lo normal dentro de un contenedor o un CI): usa un usuario sin privilegios. Además `initdb` pide el locale `en_US.UTF-8`; en una imagen mínima se crea con `localedef -i en_US -f UTF-8 en_US.UTF-8`.

## Límites

Un cobro, un precio o una propina pueden llegar hasta $10.000.000; el efectivo contado al cerrar, hasta $1.000.000.000. Los nombres, hasta 80 caracteres; el motivo de un descuento, hasta 120; la contraseña, entre 8 y 200.

## Publicar

La app corre en cualquier sitio que sirva Next.js (Vercel, Railway, Render, un VPS) con un Postgres administrado. Este es el camino con Vercel y Neon:

1. **Base de datos.** Crea un proyecto en [Neon](https://neon.tech) y copia la cadena de conexión del dueño de la base (la que trae `neondb_owner`). Esa es `DATABASE_ADMIN_URL`.
2. **Migrar.** Desde tu máquina, una vez y después de cada actualización:
   ```bash
   DATABASE_ADMIN_URL="postgresql://neondb_owner:…@…neon.tech/neondb?sslmode=require" \
   PG_APP_PASSWORD="una-clave-larga-para-la-app" \
   npm run db:migrate
   ```
   Crea el rol `barberad_app`, con el que entra la app y que no puede saltarse la seguridad por filas, y aplica las migraciones que falten.
3. **Correo.** Crea una cuenta en [Resend](https://resend.com), verifica tu dominio y copia la clave de la API.
4. **Vercel.** Importa el repositorio y define las variables de abajo. La app usa la misma `DATABASE_ADMIN_URL` para saber a qué servidor ir, pero entra con `barberad_app`. Si usas el host con `-pooler` de Neon, se ajusta solo.

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_ADMIN_URL` | Cadena de conexión del dueño de la base. Con ella se migra y de ella sale el servidor al que entra la app. |
| `PG_APP_PASSWORD` | Clave del rol `barberad_app`. La misma con la que migraste. |
| `DATABASE_URL` | Opcional: la cadena completa con la que entra la app, si prefieres darla tú. |
| `SESSION_SECRET` | Obligatorio en producción: al menos 32 caracteres. Sácalo con `openssl rand -base64 48`. Con el de ejemplo, la app no arranca. |
| `APP_URL` | La dirección pública, por ejemplo `https://barberad.co`. Arma los enlaces de reservas, de citas y de recuperación. |
| `RESEND_API_KEY` | Clave de Resend para enviar el correo de recuperación. |
| `MAIL_FROM` | Remitente, por ejemplo `BarberAD <hola@barberad.co>`, con un dominio verificado en Resend. |
| `PG_MAX` | Opcional: conexiones por instancia. Por defecto 3 con base remota. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Activan "Continuar con Google". Créalos en Google Cloud → Credenciales → ID de cliente OAuth (aplicación web), con la URI de redirección `<APP_URL>/auth/google/callback`. |
| `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | Activan el pago del plan Pro. Salen del panel de Wompi → Desarrolladores. En ese mismo panel, la URL de eventos es `<APP_URL>/api/wompi`. |
| `PLAN_PRO_PRICE` | Precio del plan Pro en pesos por mes. Por defecto 29900. Los límites del plan Gratis están en `src/server/plans.ts` y en la migración 0009. |
| `LEGAL_NAME`, `LEGAL_ID`, `LEGAL_EMAIL`, `LEGAL_ADDRESS`, `LEGAL_CITY` | Quién responde por los datos en los Términos y la Política. Mientras falten, esas páginas muestran el dato entre corchetes. |

**Lo que ya protege la app en producción**

- Límite de intentos: 5 fallos de un correo o 30 desde una IP en 15 minutos bloquean la entrada por un rato; los enlaces de recuperación se limitan a 3 por correo por hora, y las reservas a 15 por IP por hora.
- La sesión y los enlaces viajan solo por HTTPS, y los enlaces con token no se filtran como referrer.

**Lo que falta**

- **Neon: pendiente.** Todavía no hay base de datos creada ni migrada en la nube; la app está lista para conectarse cuando se haga (pasos 1 y 2).
- **Revisar los textos legales con un abogado** antes de publicar, y llenar las variables `LEGAL_*`.

- Copias de seguridad: Neon guarda historial para restaurar; revisa cuántos días incluye tu plan.
- Monitoreo de errores (por ejemplo, Sentry).

## Lo que sigue

- **Reabrir o cobrar tarde.** Cerrada la caja, ese día no admite más cobros hasta la medianoche. Un cliente que llega después del cierre no se puede cobrar.
- **Reactivar a un barbero** desactivado. Su correo queda ocupado y no se puede volver a registrar.
- **Cobrar sin señal.** Si se va la señal, el cobro no se guarda. La clave del cobro ya permite reintentar sin duplicar; falta guardarlo en el celular y enviarlo al volver.
- **Gastos** (arriendo, productos) para ver la utilidad neta del mes.
- **Fotos** de la barbería y de los cortes en la página pública (necesita un servicio de almacenamiento de archivos).
- **Renovación automática** del plan Pro (cobro recurrente con tarjeta guardada en Wompi).
- Envío automático de los recordatorios con la API de WhatsApp Business (hoy los envía el barbero con un toque).
