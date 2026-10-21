import { randomUUID } from "crypto";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

export function getOAuthClient(redirectUri) {
  return new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
    redirectUri,
  );
}

export function getAuthUrl(client, state, email) {
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    login_hint: email,
    hd: email?.split("@")[1],
  });
}

export async function verificarEmailToken(client, idToken, emailEsperado) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.AUTH_GOOGLE_ID,
  });
  const payload = ticket.getPayload();
  return payload?.email?.toLowerCase() === emailEsperado?.toLowerCase();
}

export async function revogarToken(client, token) {
  await client
    .revokeToken(token)
    .catch((err) => console.error("Falha ao revogar token do Google:", err));
}

export async function getUsuarioComTokens(usuarioId) {
  return prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { googleCredencial: true },
  });
}

export async function getClientForUsuario(usuario) {
  const client = getOAuthClient();
  const credencial = usuario.googleCredencial;

  client.setCredentials({
    access_token: credencial?.accessToken,
    refresh_token: credencial?.refreshToken,
    expiry_date: credencial?.tokenExpiry?.getTime(),
  });

  client.on("tokens", (tokens) => {
    prisma.googleCredencial
      .update({
        where: { usuarioId: usuario.id },
        data: {
          accessToken: tokens.access_token ?? credencial?.accessToken,
          tokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : credencial?.tokenExpiry,
        },
      })
      .catch((err) =>
        console.error(
          "Falha ao persistir token renovado do Google Calendar:",
          err,
        ),
      );
  });

  return client;
}

function montarEvento(agendamento) {
  const descricaoPartes = [
    agendamento.observacoes,
    agendamento.linkChat,
  ].filter(Boolean);

  return {
    summary: agendamento.cliente,
    description: descricaoPartes.join("\n\n") || undefined,
    start: {
      dateTime: agendamento.dataHoraInicio.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: agendamento.dataHoraFim.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
  };
}

async function marcarDesconectado(usuarioId) {
  await prisma.usuario
    .update({
      where: { id: usuarioId },
      data: { googleCalendarConectado: false },
    })
    .catch((err) =>
      console.error("Falha ao marcar usuário como desconectado:", err),
    );
}

async function executarComTratamento(usuarioId, acao) {
  try {
    return await acao();
  } catch (error) {
    if (error?.response?.data?.error === "invalid_grant") {
      await marcarDesconectado(usuarioId);
    } else {
      console.error(
        "Erro ao sincronizar com Google Calendar:",
        error?.message ?? error,
      );
    }
    return null;
  }
}

export async function criarEvento(usuario, agendamento) {
  if (!usuario?.googleCalendarConectado) return null;

  return executarComTratamento(usuario.id, async () => {
    const client = await getClientForUsuario(usuario);
    const calendar = google.calendar({ version: "v3", auth: client });
    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: montarEvento(agendamento),
    });
    return data.id;
  });
}

export async function atualizarEvento(usuario, agendamento) {
  if (!usuario?.googleCalendarConectado || !agendamento.googleEventId)
    return null;

  return executarComTratamento(usuario.id, async () => {
    const client = await getClientForUsuario(usuario);
    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.update({
      calendarId: "primary",
      eventId: agendamento.googleEventId,
      requestBody: montarEvento(agendamento),
    });
    return agendamento.googleEventId;
  });
}

async function aguardarLinkMeet(calendar, evento) {
  for (let tentativa = 0; !evento.hangoutLink && tentativa < 3; tentativa++) {
    if (evento.conferenceData?.createRequest?.status?.statusCode !== "pending")
      break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    ({ data: evento } = await calendar.events.get({
      calendarId: "primary",
      eventId: evento.id,
    }));
  }
  return evento;
}

export async function criarMeet(usuario, agendamento) {
  if (!usuario?.googleCalendarConectado) return null;

  return executarComTratamento(usuario.id, async () => {
    const client = await getClientForUsuario(usuario);
    const calendar = google.calendar({ version: "v3", auth: client });
    const conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };

    let evento = null;
    if (agendamento.googleEventId) {
      try {
        ({ data: evento } = await calendar.events.patch({
          calendarId: "primary",
          eventId: agendamento.googleEventId,
          conferenceDataVersion: 1,
          requestBody: { conferenceData },
        }));
      } catch (error) {
        if (![404, 410].includes(error?.code)) throw error;
      }
    }
    if (!evento) {
      ({ data: evento } = await calendar.events.insert({
        calendarId: "primary",
        conferenceDataVersion: 1,
        requestBody: { ...montarEvento(agendamento), conferenceData },
      }));
    }

    evento = await aguardarLinkMeet(calendar, evento);
    if (!evento.hangoutLink) return null;
    return { googleEventId: evento.id, linkMeet: evento.hangoutLink };
  });
}

export async function apagarEvento(usuario, googleEventId) {
  if (!usuario?.googleCalendarConectado || !googleEventId) return;

  await executarComTratamento(usuario.id, async () => {
    const client = await getClientForUsuario(usuario);
    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
    });
  });
}
