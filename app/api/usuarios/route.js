import { accessibleBy } from "@casl/prisma";
import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao } from "@/lib/autorizacao";
import { selectUsuarioPublico } from "@/lib/camposPublicos";

export async function GET() {
  const { ability, erro } = await autenticar();
  if (erro) return erro;

  const where = accessibleBy(ability, "read").ofType("Usuario");
  const orderBy = { nome: "asc" };

  if (ability.cannot("update", "Usuario") && ability.cannot("manage", "Permissao")) {
    const usuarios = await prisma.usuario.findMany({ where, select: selectUsuarioPublico, orderBy });
    return Response.json(usuarios);
  }

  const usuarios = await prisma.usuario.findMany({
    where,
    include: ability.can("manage", "Permissao")
      ? { permissoes: { select: { permissao: true, concedida: true } } }
      : undefined,
    orderBy,
  });
  return Response.json(usuarios);
}

export async function POST(request) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;
  if (ability.cannot("create", "Usuario")) return semPermissao();

  const { nome, ativo, email, alertaMinutos } = await request.json();

  if (!nome?.trim()) {
    return Response.json({ error: "O nome é obrigatório." }, { status: 400 });
  }
  if (!email?.trim()) {
    return Response.json({ error: "O e-mail é obrigatório." }, { status: 400 });
  }
  const usuario = await prisma.usuario.create({
    data: { nome, ativo, email, alertaMinutos: alertaMinutos ?? 30 },
  });
  return Response.json(usuario);
}
