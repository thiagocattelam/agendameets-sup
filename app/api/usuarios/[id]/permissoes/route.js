import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao } from "@/lib/autorizacao";
import { PERFIS, PERMISSOES } from "@/lib/permissoes";

export async function PUT(request, { params }) {
  const { session, ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("manage", "Permissao")) return semPermissao();

  const { id } = await params;
  if (id === session.usuarioId) {
    return Response.json({ error: "Você não pode alterar o próprio perfil ou liberações." }, { status: 400 });
  }

  const { perfil, permissoes = {} } = await request.json();

  if (!PERFIS[perfil]) {
    return Response.json({ error: "Perfil inválido." }, { status: 400 });
  }
  const chaveInvalida = Object.keys(permissoes).find((chave) => !PERMISSOES[chave]);
  if (chaveInvalida) {
    return Response.json({ error: `Permissão desconhecida: ${chaveInvalida}` }, { status: 400 });
  }

  const liberacoes = Object.entries(permissoes)
    .filter(([, concedida]) => typeof concedida === "boolean")
    .map(([permissao, concedida]) => ({ usuarioId: id, permissao, concedida }));

  const [usuario] = await prisma.$transaction([
    prisma.usuario.update({ where: { id }, data: { perfil } }),
    prisma.usuarioPermissao.deleteMany({ where: { usuarioId: id } }),
    prisma.usuarioPermissao.createMany({ data: liberacoes }),
  ]);

  return Response.json({ ...usuario, permissoes: liberacoes.map(({ permissao, concedida }) => ({ permissao, concedida })) });
}
