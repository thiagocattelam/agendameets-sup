import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao } from "@/lib/autorizacao";

export async function GET() {
  const { ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("read", "Assunto")) return semPermissao();

  const assuntos = await prisma.assunto.findMany({
    orderBy: { descricao: "asc" },
  });
  return Response.json(assuntos);
}

export async function POST(request) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("create", "Assunto")) return semPermissao();

  const { descricao } = await request.json();

  if (!descricao?.trim()) {
    return Response.json({ error: "A descrição é obrigatória." }, { status: 400 });
  }

  const assunto = await prisma.assunto.create({
    data: { descricao },
  });
  return Response.json(assunto);
}
