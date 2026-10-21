import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.usuarioId) {
    return Response.json({ ok: false }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.googleCredencial.deleteMany({ where: { usuarioId: session.usuarioId } }),
    prisma.usuario.update({
      where: { id: session.usuarioId },
      data: { googleCalendarConectado: false },
    }),
  ]);

  return Response.json({ ok: true });
}
