import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { montarRegras } from "@/lib/permissoes";

function dominioPermitido(email) {
  const dominioEmail = email?.split("@")[1]?.toLowerCase();
  if (!dominioEmail) return false;

  const dominios = (process.env.AUTH_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);

  return dominios.includes(dominioEmail);
}

const selectAcesso = {
  id: true,
  ativo: true,
  perfil: true,
  permissoes: { select: { permissao: true, concedida: true } },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ profile }) {
      return dominioPermitido(profile?.email);
    },
    async jwt({ token, profile }) {
      const email = profile?.email ?? token.email;
      if (!dominioPermitido(email)) {
        return null;
      }

      const usuario = profile
        ? await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: { nome: profile.name || email, email },
            select: selectAcesso,
          })
        : await prisma.usuario.findUnique({ where: { email }, select: selectAcesso });

      if (!usuario?.ativo) {
        return null;
      }

      token.usuarioId = usuario.id;
      token.perfil = usuario.perfil;
      token.regras = montarRegras(usuario);
      return token;
    },
  },
});
