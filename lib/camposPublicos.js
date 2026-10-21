export const selectUsuarioPublico = {
  id: true,
  nome: true,
  ativo: true,
};

export const selectAgendamento = {
  id: true,
  dataHoraInicio: true,
  dataHoraFim: true,
  cliente: true,
  linkUmbler: true,
  observacoes: true,
  alertaMinutos: true,
  atendenteId: true,
  statusId: true,
  atendente: { select: { id: true, nome: true, alertaMinutos: true } },
  assuntos: { select: { id: true, descricao: true } },
  status: { select: { id: true, descricao: true, corHex: true } },
};
