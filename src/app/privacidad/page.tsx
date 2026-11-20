import { LegalPage } from "@/components/legal-page";
import { legalEntity } from "@/server/legal";

export const metadata = { title: "Política de tratamiento de datos" };
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const legal = legalEntity();
  return (
    <LegalPage title="Política de tratamiento de datos personales" updated={legal.updated}>
      <p>
        Esta política explica cómo BarberAD recoge, usa, guarda y protege datos personales, en cumplimiento de la Ley 1581 de
        2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas de protección de datos en Colombia.
      </p>

      <h2>1. Quién es el responsable</h2>
      <p>
        <strong>{legal.name}</strong>, identificado con {legal.id}, con domicilio en {legal.address}, {legal.city}. Correo para
        todo lo relacionado con datos personales: <strong>{legal.email}</strong>.
      </p>
      <p>
        BarberAD es una herramienta que usan las barberías. Por eso hay dos situaciones:
      </p>
      <ul>
        <li>
          <strong>Datos de dueños y barberos</strong> (nombre, correo, contraseña cifrada, teléfono del negocio): BarberAD es el
          responsable del tratamiento.
        </li>
        <li>
          <strong>Datos de los clientes de cada barbería</strong> (nombre, WhatsApp, citas, cobros y notas): la barbería es la
          responsable y BarberAD es el encargado, que los trata solo por cuenta y según las instrucciones de la barbería.
        </li>
      </ul>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>De dueños y barberos: nombre, correo, contraseña guardada con cifrado irreversible, porcentaje de comisión, horario de trabajo y registros de uso de la cuenta.</li>
        <li>De la barbería: nombre, dirección, teléfono, Instagram, descripción, servicios y precios.</li>
        <li>De los clientes que reservan: nombre, número de WhatsApp, citas, cobros asociados y notas que registre la barbería.</li>
        <li>Datos técnicos: dirección IP e intentos de acceso, solo para seguridad y prevención de abusos, que se borran a las 24 horas.</li>
      </ul>
      <p>No tratamos datos sensibles ni datos de niñas, niños y adolescentes de forma intencional.</p>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Crear y administrar la cuenta, y permitir el acceso seguro.</li>
        <li>Agendar, recordar, confirmar y cancelar citas, y registrar los cobros, la caja, las comisiones y los reportes de la barbería.</li>
        <li>Enviar al cliente mensajes sobre su cita y, si la barbería lo decide, invitaciones a volver a reservar.</li>
        <li>Enviar correos necesarios para el servicio, como la recuperación de la contraseña.</li>
        <li>Cobrar la suscripción del plan Pro a través de la pasarela de pagos.</li>
        <li>Mantener la seguridad, prevenir fraudes y cumplir obligaciones legales.</li>
      </ul>

      <h2>4. Autorización</h2>
      <p>
        Dueños y barberos autorizan el tratamiento al crear su cuenta. Los clientes autorizan a la barbería al reservar desde su
        enlace o cuando la barbería registra su cita con su consentimiento. La barbería se compromete a obtener esa autorización
        cuando agenda citas a mano.
      </p>

      <h2>5. Derechos de los titulares</h2>
      <p>Como titular puedes, de forma gratuita:</p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Pedir prueba de la autorización que diste.</li>
        <li>Ser informado sobre el uso que se les da.</li>
        <li>Revocar la autorización o pedir que se borren, cuando no exista un deber legal o contractual de conservarlos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio, después de agotar el trámite de consulta o reclamo.</li>
      </ul>

      <h2>6. Cómo ejercerlos</h2>
      <p>
        Escribe a <strong>{legal.email}</strong> con tu nombre, tu identificación, lo que pides y un medio de contacto. Si eres
        cliente de una barbería, también puedes pedírselo directamente a ella.
      </p>
      <ul>
        <li><strong>Consultas:</strong> se responden en máximo 10 días hábiles, prorrogables 5 días hábiles más avisando el motivo.</li>
        <li><strong>Reclamos</strong> (corrección, actualización, supresión o incumplimiento): se responden en máximo 15 días hábiles, prorrogables 8 días hábiles más avisando el motivo.</li>
      </ul>
      <p>Un cliente puede cancelar su cita en cualquier momento desde el enlace que recibe.</p>

      <h2>7. Seguridad y conservación</h2>
      <p>
        Cada barbería solo accede a sus propios datos, y la base de datos lo hace cumplir. Las contraseñas y los enlaces de acceso
        se guardan cifrados. Los cobros no se borran porque son soporte contable; el resto de los datos se conserva mientras la
        cuenta esté activa y el tiempo que exija la ley.
      </p>

      <h2>8. Terceros que nos ayudan</h2>
      <p>
        Usamos proveedores de alojamiento y base de datos, de envío de correos y de pagos (Wompi). Solo reciben los datos
        necesarios para su tarea y pueden estar fuera de Colombia, con niveles adecuados de protección. Los mensajes de WhatsApp
        los envía la propia barbería desde su teléfono.
      </p>

      <h2>9. Cambios</h2>
      <p>Si esta política cambia de forma importante, lo avisaremos en la aplicación antes de que el cambio aplique.</p>
    </LegalPage>
  );
}
