import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.usuarioId) {
    return Response.json({ conectado: false });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.usuarioId },
    select: { googleCalendarConectado: true },
  });

  return Response.json({ conectado: usuario?.googleCalendarConectado ?? false });
}
