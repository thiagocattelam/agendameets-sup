import Google from "next-auth/providers/google";
import { criarAbility, podeAcessarRota } from "@/lib/permissoes";

export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      if (!auth?.user) return false;
      if (!podeAcessarRota(criarAbility(auth.regras), request.nextUrl.pathname)) {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      return true;
    },
    session({ session, token }) {
      session.usuarioId = token.usuarioId ?? null;
      session.perfil = token.perfil ?? null;
      session.regras = token.regras ?? [];
      return session;
    },
  },
};
