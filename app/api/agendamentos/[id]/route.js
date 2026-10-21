import { subject } from "@casl/ability";
import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao, naoEncontrado } from "@/lib/autorizacao";
import { criarEvento, criarMeet, atualizarEvento, apagarEvento, getUsuarioComTokens } from "@/lib/googleCalendar";

export async function PUT(request, { params }) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;

  const { id } = await params;
  const { dataHoraInicio, dataHoraFim, cliente, linkChat, observacoes, alertaMinutos, atendenteId, statusId, assuntoIds } =
    await request.json();

  const anterior = await prisma.agendamento.findUnique({ where: { id } });
  if (!anterior) return naoEncontrado();
  if (
    ability.cannot("update", subject("Agendamento", anterior)) ||
    ability.cannot("update", subject("Agendamento", { ...anterior, atendenteId }))
  ) {
    return semPermissao();
  }

  const agendamento = await prisma.agendamento.update({
    where: { id },
    data: {
      dataHoraInicio: new Date(dataHoraInicio),
      dataHoraFim: new Date(dataHoraFim),
      cliente,
      linkChat: linkChat || null,
      observacoes: observacoes || null,
      alertaMinutos: alertaMinutos ?? null,
      atendenteId,
      statusId,
      assuntos: { set: assuntoIds.map((id) => ({ id })) },
    },
  });

  const trocouAtendente = anterior.atendenteId !== agendamento.atendenteId;
  const atendenteComTokens = await getUsuarioComTokens(agendamento.atendenteId);

  if (trocouAtendente) {
    const atendenteAnteriorComTokens = await getUsuarioComTokens(anterior.atendenteId);
    await apagarEvento(atendenteAnteriorComTokens, anterior.googleEventId);
    const meet = anterior.linkMeet ? await criarMeet(atendenteComTokens, { ...agendamento, googleEventId: null }) : null;
    const googleEventId = meet?.googleEventId ?? (await criarEvento(atendenteComTokens, agendamento));
    await prisma.agendamento.update({ where: { id }, data: { googleEventId, linkMeet: meet?.linkMeet ?? null } });
  } else if (agendamento.googleEventId) {
    await atualizarEvento(atendenteComTokens, agendamento);
  } else {
    const googleEventId = await criarEvento(atendenteComTokens, agendamento);
    if (googleEventId) {
      await prisma.agendamento.update({ where: { id }, data: { googleEventId } });
    }
  }

  return Response.json(agendamento);
}

export async function DELETE(_, { params }) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;

  const { id } = await params;

  const agendamento = await prisma.agendamento.findUnique({ where: { id } });
  if (!agendamento) return naoEncontrado();
  if (ability.cannot("delete", subject("Agendamento", agendamento))) {
    return semPermissao();
  }

  const atendenteComTokens = await getUsuarioComTokens(agendamento.atendenteId);
  await apagarEvento(atendenteComTokens, agendamento.googleEventId);

  await prisma.agendamento.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
