import { subject } from "@casl/ability";
import { prisma } from "@/lib/prisma";
import { autenticar, semPermissao, naoEncontrado } from "@/lib/autorizacao";
import { criarMeet, getUsuarioComTokens } from "@/lib/googleCalendar";

export async function POST(_, { params }) {
  const { ability, erro } = await autenticar();
  if (erro) return erro;

  const { id } = await params;

  const agendamento = await prisma.agendamento.findUnique({ where: { id } });
  if (!agendamento) return naoEncontrado();
  if (ability.cannot("update", subject("Agendamento", agendamento))) {
    return semPermissao();
  }

  if (agendamento.linkMeet) {
    return Response.json({ linkMeet: agendamento.linkMeet });
  }

  const atendenteComTokens = await getUsuarioComTokens(agendamento.atendenteId);
  if (!atendenteComTokens?.googleCalendarConectado) {
    return Response.json(
      { error: "O atendente deste agendamento não conectou o Google Agenda." },
      { status: 409 },
    );
  }

  const meet = await criarMeet(atendenteComTokens, agendamento);
  if (!meet) {
    return Response.json(
      { error: "Não foi possível criar a videoconferência no Google Agenda. Tente novamente." },
      { status: 502 },
    );
  }

  await prisma.agendamento.update({ where: { id }, data: meet });

  return Response.json({ linkMeet: meet.linkMeet });
}
