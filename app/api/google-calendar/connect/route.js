import { auth } from "@/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getOAuthClient, getAuthUrl } from "@/lib/googleCalendar";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.redirect(new URL("/", request.url));
  }

  // Revalida contra o banco em vez de confiar no usuarioId cacheado no token,
  // que pode estar desatualizado se o e-mail do usuário mudou após o login.
  const usuario = await prisma.usuario.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!usuario) {
    return Response.redirect(new URL("/?googleCalendarErro=sem_usuario", request.url));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_calendar_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/",
  });

  const redirectUri = new URL("/api/google-calendar/callback", request.url).toString();
  const client = getOAuthClient(redirectUri);

  return Response.redirect(getAuthUrl(client, state, session.user?.email));
}
