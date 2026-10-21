import { createMongoAbility } from "@casl/ability";

export const PERFIS = {
  GESTAO: "Gestão",
  ATENDENTE: "Atendente",
};

const REGRAS_POR_PERFIL = {
  GESTAO: () => [{ action: "manage", subject: "all" }],
  ATENDENTE: (usuarioId) => [
    { action: "read", subject: ["Agendamento", "Usuario", "Assunto", "Status"] },
    { action: ["create", "update", "delete"], subject: "Agendamento", conditions: { atendenteId: usuarioId } },
  ],
};

export const PERMISSOES = {
  "agendamento.ver": {
    grupo: "Agendamentos",
    label: "Ver agendamentos",
    regra: { action: "read", subject: "Agendamento" },
  },
  "agendamento.criar": {
    grupo: "Agendamentos",
    label: "Criar agendamentos para qualquer atendente",
    regra: { action: "create", subject: "Agendamento" },
  },
  "agendamento.editar": {
    grupo: "Agendamentos",
    label: "Editar agendamentos de qualquer atendente",
    regra: { action: "update", subject: "Agendamento" },
  },
  "agendamento.excluir": {
    grupo: "Agendamentos",
    label: "Excluir agendamentos de qualquer atendente",
    regra: { action: "delete", subject: "Agendamento" },
  },
  "assunto.gerenciar": {
    grupo: "Cadastros",
    label: "Gerenciar assuntos",
    regra: { action: ["create", "update", "delete"], subject: "Assunto" },
  },
  "usuario.gerenciar": {
    grupo: "Cadastros",
    label: "Gerenciar usuários",
    regra: { action: ["create", "update", "delete"], subject: "Usuario" },
  },
  "permissao.gerenciar": {
    grupo: "Cadastros",
    label: "Gerenciar perfis e liberações",
    regra: { action: "manage", subject: "Permissao" },
  },
};

export function montarRegras({ id, perfil, permissoes = [] }) {
  const regras = [...(REGRAS_POR_PERFIL[perfil]?.(id) ?? [])];
  for (const { permissao, concedida } of permissoes) {
    const definicao = PERMISSOES[permissao];
    if (!definicao) continue;
    regras.push({ ...definicao.regra, inverted: !concedida });
  }
  return regras;
}

export function criarAbility(regras) {
  return createMongoAbility(regras ?? []);
}

const ACOES_ESCRITA = ["create", "update", "delete"];

const ROTAS_RESTRITAS = [
  {
    prefixo: "/usuarios",
    pode: (ability) =>
      ACOES_ESCRITA.some((acao) => ability.can(acao, "Usuario")) || ability.can("manage", "Permissao"),
  },
  {
    prefixo: "/assuntos",
    pode: (ability) => ACOES_ESCRITA.some((acao) => ability.can(acao, "Assunto")),
  },
];

export function podeAcessarRota(ability, pathname) {
  const rota = ROTAS_RESTRITAS.find((r) => pathname === r.prefixo || pathname.startsWith(r.prefixo + "/"));
  return !rota || rota.pode(ability);
}
