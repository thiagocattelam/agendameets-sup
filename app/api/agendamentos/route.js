import { subject } from "@casl/ability";
import { accessibleBy } from "@casl/prisma";
import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao } from "@/lib/autorizacao";
import { selectAgendamento } from "@/lib/camposPublicos";
import { criarEvento, getUsuarioComTokens } from "@/lib/googleCalendar";
import { idsAgendamentosPorCliente, normalizarBusca } from "@/lib/buscaCliente";

export async function GET(request) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;

  const { searchParams } = new URL(request.url);
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");
  const atendenteId = searchParams.get("atendenteId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") ?? "15", 10));

  const where = { AND: [accessibleBy(ability, "read").ofType("Agendamento")] };

  if (inicio && fim) {
    where.dataHoraInicio = {
      gte: new Date(inicio),
      lte: new Date(fim),
    };
  }

  if (atendenteId) {
    where.atendenteId = atendenteId;
  }

  const palavras = normalizarBusca(searchParams.get("cliente"));
  if (palavras.length) {
    const periodo = inicio && fim ? { inicio: new Date(inicio), fim: new Date(fim) } : {};
    where.id = { in: await idsAgendamentosPorCliente(palavras, periodo) };
  }

  const [data, total] = await Promise.all([
    prisma.agendamento.findMany({
      where,
      select: selectAgendamento,
      orderBy: { dataHoraInicio: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.agendamento.count({ where }),
  ]);

  return Response.json({ data, total });
}

export async function POST(request) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;

  const { dataHoraInicio, dataHoraFim, cliente, linkChat, observacoes, alertaMinutos, atendenteId, statusId, assuntoIds } =
    await request.json();

  if (ability.cannot("create", subject("Agendamento", { atendenteId }))) {
    return semPermissao();
  }

  const agendamento = await prisma.agendamento.create({
    data: {
      dataHoraInicio: new Date(dataHoraInicio),
      dataHoraFim: new Date(dataHoraFim),
      cliente,
      linkChat: linkChat || null,
      observacoes: observacoes || null,
      alertaMinutos: alertaMinutos ?? null,
      atendenteId,
      statusId,
      assuntos: { connect: assuntoIds.map((id) => ({ id })) },
    },
  });

  const atendenteComTokens = await getUsuarioComTokens(agendamento.atendenteId);
  const googleEventId = await criarEvento(atendenteComTokens, agendamento);
  if (googleEventId) {
    await prisma.agendamento.update({ where: { id: agendamento.id }, data: { googleEventId } });
  }

  return Response.json(agendamento, { status: 201 });
}
