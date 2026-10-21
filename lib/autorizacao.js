import { auth } from "@/auth";
import { createPrismaAbility } from "@casl/prisma";

export async function autenticar() {
  const session = await auth();
  if (!session?.user) {
    return { erro: Response.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  return { session, ability: createPrismaAbility(session.regras ?? []) };
}

export function semPermissao() {
  return Response.json({ error: "Sem permissão para esta ação." }, { status: 403 });
}

export function naoEncontrado() {
  return Response.json({ error: "Registro não encontrado." }, { status: 404 });
}
