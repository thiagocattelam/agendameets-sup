"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";
import { useAbility } from "@/hooks/useAbility";
import { PERFIS, PERMISSOES } from "@/lib/permissoes";

const formVazio = {
  nome: "",
  email: "",
  ativo: true,
  alertaMinutos: "30",
  perfil: "ATENDENTE",
  permissoes: {},
};

const grupos = Object.entries(PERMISSOES).reduce((acc, [chave, def]) => {
  (acc[def.grupo] ??= []).push({ chave, ...def });
  return acc;
}, {});

const opcoesLiberacao = [
  { valor: undefined, label: "Padrão" },
  { valor: true, label: "Liberar" },
  { valor: false, label: "Bloquear" },
];

export default function UsuarioModal({ aberto, onFechar, usuario, onSalvar }) {
  const { data: session } = useSession();
  const ability = useAbility();
  const [form, setForm] = useState(formVazio);
  const [erro, setErro] = useState(null);

  const podeEditarDados = ability.can(usuario ? "update" : "create", "Usuario");
  const podeEditarAcesso =
    ability.can("manage", "Permissao") && usuario?.id !== session?.usuarioId;

  useEffect(() => {
    if (aberto) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  useEffect(() => {
    setErro(null);
    if (usuario) {
      setForm({
        nome: usuario.nome,
        email: usuario.email ?? "",
        ativo: usuario.ativo,
        alertaMinutos:
          usuario.alertaMinutos != null ? String(usuario.alertaMinutos) : "30",
        perfil: usuario.perfil ?? "ATENDENTE",
        permissoes: Object.fromEntries(
          (usuario.permissoes ?? []).map((p) => [p.permissao, p.concedida]),
        ),
      });
    } else {
      setForm(formVazio);
    }
  }, [usuario, aberto]);

  function fechar() {
    setForm(formVazio);
    onFechar();
  }

  function definirLiberacao(chave, valor) {
    const permissoes = { ...form.permissoes };
    if (valor === undefined) delete permissoes[chave];
    else permissoes[chave] = valor;
    setForm({ ...form, permissoes });
  }

  async function enviar(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
    return data;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    try {
      let id = usuario?.id;
      if (podeEditarDados) {
        const salvo = await enviar(
          usuario ? `/api/usuarios/${usuario.id}` : "/api/usuarios",
          usuario ? "PUT" : "POST",
          {
            nome: form.nome,
            ativo: form.ativo,
            email: form.email || null,
            alertaMinutos:
              form.alertaMinutos !== "" ? Number(form.alertaMinutos) : 30,
          },
        );
        id = salvo.id;
      }
      if (podeEditarAcesso && id) {
        await enviar(`/api/usuarios/${id}/permissoes`, "PUT", {
          perfil: form.perfil,
          permissoes: form.permissoes,
        });
      }
      onSalvar();
      fechar();
    } catch (err) {
      setErro(err.message);
    }
  }

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-xl w-full ${podeEditarAcesso ? "max-w-lg" : "max-w-sm"} shadow-lg max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-lg font-semibold">
            {usuario ? "Editar Usuário" : "Novo Usuário"}
          </h2>
          <button
            onClick={fechar}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="px-6 pb-6 flex flex-col gap-4 overflow-y-auto"
        >
          <div>
            <label className="text-sm font-medium">Nome</label>
            <input
              className="border rounded-lg w-full px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-50 disabled:text-gray-500"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              disabled={!podeEditarDados}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">E-mail</label>
            <input
              type="email"
              placeholder={`nome${process.env.NEXT_PUBLIC_AUTH_ALLOWED_EMAIL_DOMAINS}`}
              className="border rounded-lg w-full px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-50 disabled:text-gray-500"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!podeEditarDados}
              required={!usuario}
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Alerta padrão (minutos antes)
            </label>
            <div
              className={`flex items-center border border-gray-200 rounded-lg mt-1 overflow-hidden focus-within:ring-2 focus-within:ring-purple-300 focus-within:border-purple-400 ${podeEditarDados ? "" : "bg-gray-50 opacity-60 pointer-events-none"}`}
            >
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    alertaMinutos: String(
                      Math.max(1, (Number(form.alertaMinutos) || 1) - 1),
                    ),
                  })
                }
                className="px-3 py-2 text-gray-500 hover:bg-purple-50 hover:text-purple-600 transition-colors text-sm font-medium select-none"
              >
                −
              </button>
              <input
                type="number"
                placeholder="30"
                className="flex-1 text-sm text-center text-gray-700 focus:outline-none bg-transparent py-2 min-w-0"
                value={form.alertaMinutos}
                onChange={(e) =>
                  setForm({ ...form, alertaMinutos: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    alertaMinutos: String(
                      (Number(form.alertaMinutos) || 0) + 1,
                    ),
                  })
                }
                className="px-3 py-2 text-gray-500 hover:bg-purple-50 hover:text-purple-600 transition-colors text-sm font-medium select-none"
              >
                +
              </button>
            </div>
          </div>

          {podeEditarAcesso && (
            <>
              <div>
                <label className="text-sm font-medium">Perfil</label>
                <div className="flex gap-2 mt-1">
                  {Object.entries(PERFIS).map(([valor, label]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setForm({ ...form, perfil: valor })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${form.perfil === valor ? "border-purple-400 bg-purple-50 text-purple-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Permissões</label>
                <p className="text-xs text-gray-400 mt-0.5 mb-2">
                  Sobrepõem o perfil apenas para este usuário.
                </p>
                <div className="flex flex-col gap-3">
                  {Object.entries(grupos).map(([grupo, itens]) => (
                    <div key={grupo}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        {grupo}
                      </p>
                      <div className="flex flex-col divide-y divide-gray-100 border border-gray-200 rounded-lg">
                        {itens.map(({ chave, label }) => (
                          <div
                            key={chave}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <span className="text-sm text-gray-700">
                              {label}
                            </span>
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                              {opcoesLiberacao.map(
                                ({ valor, label: rotulo }) => {
                                  const ativo =
                                    form.permissoes[chave] === valor;
                                  const cor =
                                    valor === true
                                      ? "bg-green-500 text-white"
                                      : valor === false
                                        ? "bg-red-500 text-white"
                                        : "bg-gray-200 text-gray-700";
                                  return (
                                    <button
                                      key={rotulo}
                                      type="button"
                                      onClick={() =>
                                        definirLiberacao(chave, valor)
                                      }
                                      className={`px-2.5 py-1 text-xs transition-colors ${ativo ? cor : "text-gray-500 hover:bg-gray-50"}`}
                                    >
                                      {rotulo}
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-white text-sm"
              style={{ backgroundColor: "#8b47ff" }}
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
