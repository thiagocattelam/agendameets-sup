import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

function dominioPermitido(email) {
  const dominioEmail = email?.split("@")[1]?.toLowerCase();
  if (!dominioEmail) return false;

  const dominios = (process.env.AUTH_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);

  return dominios.includes(dominioEmail);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ profile }) {
      return dominioPermitido(profile?.email);
    },
    async jwt({ token, profile }) {
      const email = profile?.email ?? token.email;
      if (!dominioPermitido(email)) {
        return null;
      }

      const atendente = await prisma.atendente.findUnique({
        where: { email },
        select: { id: true, ativo: true },
      });

      if (atendente && !atendente.ativo) {
        return null;
      }

      token.atendenteId = atendente?.id ?? null;
      return token;
    },
    async session({ session, token }) {
      session.atendenteId = token.atendenteId ?? null;
      return session;
    },
  },
});
