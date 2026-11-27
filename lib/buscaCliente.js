import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Busca por nome do cliente: ignora maiúsculas e acentos, aceita palavras em
// qualquer ordem e tolera erros de digitação. Depende das extensões unaccent e
// pg_trgm (migration extensoes_busca_cliente).
//
// Cada palavra digitada precisa casar com o nome de uma destas formas:
// - estar contida no nome ("joao" → "João da Silva", "mari" → "Mariana")
// - ser parecida com alguma palavra do nome (word_similarity), só para termos
//   com 4+ letras, já que termos curtos geram muito falso positivo
//   ("silvia" → "Silva", "fenandes" → "Fernandes")

const SIMILARIDADE_MINIMA = 0.5;
const TAMANHO_MINIMO_APROXIMADO = 4;
const MAX_PALAVRAS = 5;
const MAX_TAMANHO_BUSCA = 100;

export function normalizarBusca(texto) {
  return (texto ?? "")
    .slice(0, MAX_TAMANHO_BUSCA)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_PALAVRAS);
}

// Retorna os ids dos agendamentos cujo cliente casa com todas as palavras.
// O filtro de período é repetido aqui só para reduzir as linhas avaliadas; a
// permissão (CASL) continua sendo aplicada pela query Prisma que usa os ids.
export async function idsAgendamentosPorCliente(palavras, { inicio, fim } = {}) {
  const nome = Prisma.sql`unaccent(lower("cliente"))`;

  const condicoes = palavras.map((palavra) => {
    const termo = Prisma.sql`unaccent(lower(${palavra}))`;
    const contem = Prisma.sql`strpos(${nome}, ${termo}) > 0`;
    if (palavra.length < TAMANHO_MINIMO_APROXIMADO) return contem;
    return Prisma.sql`(${contem} OR word_similarity(${termo}, ${nome}) >= ${SIMILARIDADE_MINIMA})`;
  });

  if (inicio && fim) {
    condicoes.push(Prisma.sql`"dataHoraInicio" BETWEEN ${inicio} AND ${fim}`);
  }

  const linhas = await prisma.$queryRaw`
    SELECT "id" FROM "Agendamento"
    WHERE ${Prisma.join(condicoes, " AND ")}
  `;
  return linhas.map((l) => l.id);
}
