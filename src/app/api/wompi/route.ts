import { handleWompiEvent } from "@/server/billing";

// Aviso de Wompi cuando cambia una transacción. Configúralo en el panel de Wompi: <APP_URL>/api/wompi
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("JSON no válido", { status: 400 });
  }
  const result = await handleWompiEvent(body as Parameters<typeof handleWompiEvent>[0]);
  if (!result.ok) return new Response("Firma no válida", { status: 401 });
  return Response.json(result);
}
