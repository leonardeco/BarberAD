import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { legalEntity } from "@/server/legal";
import { FREE_LIMITS, proPrice } from "@/server/plans";
import { formatCop } from "@/server/money";

export const metadata = { title: "Términos y condiciones" };
export const dynamic = "force-dynamic";

export default function TermsPage() {
  const legal = legalEntity();
  return (
    <LegalPage title="Términos y condiciones" updated={legal.updated}>
      <p>
        Estos términos regulan el uso de BarberAD, ofrecido por <strong>{legal.name}</strong> ({legal.id}). Al crear una cuenta
        los aceptas. Si no estás de acuerdo, no uses el servicio.
      </p>

      <h2>1. Qué es BarberAD</h2>
      <p>
        Una aplicación web para barberías: agenda y reservas en línea, cobros, comisiones, caja, reportes y avisos por WhatsApp.
        BarberAD no presta servicios de barbería ni es parte de la relación entre la barbería y sus clientes.
      </p>

      <h2>2. Cuentas</h2>
      <ul>
        <li>El dueño crea la cuenta de la barbería y las de su equipo, y responde por su uso.</li>
        <li>Cada persona cuida su contraseña. Si sospechas de un acceso indebido, cámbiala y avísanos.</li>
        <li>La información que registras debe ser cierta y tuya, o debes estar autorizado para registrarla.</li>
      </ul>

      <h2>3. Planes y pagos</h2>
      <ul>
        <li>
          <strong>Gratis:</strong> hasta {FREE_LIMITS.barbers} barberos además del dueño y {FREE_LIMITS.onlineBookingsPerMonth} reservas en
          línea al mes, sin costo y sin tarjeta.
        </li>
        <li>
          <strong>Pro:</strong> {formatCop(proPrice())} al mes, o con descuento por 6 o 12 meses, pagado por adelantado a través de
          Wompi. Se activa cuando la pasarela confirma el pago y no se renueva solo.
        </li>
        <li>Si el plan Pro vence, la cuenta vuelve al plan Gratis sin perder información.</li>
        <li>Los precios pueden cambiar; el cambio no afecta los períodos ya pagados.</li>
        <li>
          Los pagos no son reembolsables, salvo en los casos que ordene la ley, incluido el derecho de retracto del Estatuto del
          Consumidor (Ley 1480 de 2011) cuando aplique.
        </li>
      </ul>

      <h2>4. Uso correcto</h2>
      <p>No está permitido usar BarberAD para enviar mensajes no deseados, suplantar a otros, intentar acceder a datos ajenos o afectar el funcionamiento del servicio.</p>

      <h2>5. Datos personales</h2>
      <p>
        El tratamiento de datos se rige por la{" "}
        <Link className="text-[#D97706]" href="/privacidad">
          Política de tratamiento de datos
        </Link>
        . La barbería es responsable de los datos de sus clientes y de contar con su autorización.
      </p>

      <h2>6. Disponibilidad y responsabilidad</h2>
      <p>
        Trabajamos para que el servicio esté disponible y sus cálculos sean correctos, pero puede haber interrupciones por
        mantenimiento o fallas de terceros. Los reportes, comisiones y cierres de caja son una ayuda: la barbería debe revisarlos
        antes de pagar o declarar. En la medida que lo permita la ley, la responsabilidad de BarberAD se limita a lo pagado por
        el servicio en los últimos tres meses.
      </p>

      <h2>7. Terminación</h2>
      <p>
        Puedes dejar de usar el servicio cuando quieras y pedir la eliminación de tu cuenta a {legal.email}. Podemos suspender una
        cuenta que incumpla estos términos, avisando antes cuando sea posible.
      </p>

      <h2>8. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de Colombia. Las diferencias se intentarán resolver primero de forma directa.</p>

      <h2>9. Contacto</h2>
      <p>
        {legal.email} · {legal.address}, {legal.city}.
      </p>
    </LegalPage>
  );
}
