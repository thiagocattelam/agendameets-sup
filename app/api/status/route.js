import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao } from "@/lib/autorizacao";

export async function GET() {
  const { ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("read", "Status")) return semPermissao();

  const status = await prisma.status.findMany({
    orderBy: { descricao: "asc" },
  });
  return Response.json(status);
}
