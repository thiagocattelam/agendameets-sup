import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao } from "@/lib/autorizacao";

export async function PUT(request, { params }) {
  const { session, ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("update", "Usuario")) return semPermissao();

  const { id } = await params;
  const { nome, ativo, email, alertaMinutos } = await request.json();

  if (id === session.usuarioId && ativo === false) {
    return Response.json({ error: "Você não pode desativar o próprio usuário." }, { status: 400 });
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: { nome, ativo, email: email || null, alertaMinutos: alertaMinutos ?? null },
  });
  return Response.json(usuario);
}

export async function DELETE(_, { params }) {
  const { session, ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("delete", "Usuario")) return semPermissao();

  const { id } = await params;

  if (id === session.usuarioId) {
    return Response.json({ error: "Você não pode excluir o próprio usuário." }, { status: 400 });
  }

  await prisma.usuario.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
