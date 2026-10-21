import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao } from "@/lib/autorizacao";

export async function PUT(request, { params }) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("update", "Assunto")) return semPermissao();

  const { id } = await params;
  const { descricao } = await request.json();

  const assunto = await prisma.assunto.update({
    where: { id },
    data: { descricao },
  });
  return Response.json(assunto);
}

export async function DELETE(_, { params }) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("delete", "Assunto")) return semPermissao();

  const { id } = await params;

  await prisma.assunto.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
