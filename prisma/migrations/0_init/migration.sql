-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('GESTAO', 'ATENDENTE');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "alertaMinutos" INTEGER DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "perfil" "Perfil" NOT NULL DEFAULT 'ATENDENTE',
    "googleCalendarConectado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioPermissao" (
    "usuarioId" TEXT NOT NULL,
    "permissao" TEXT NOT NULL,
    "concedida" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UsuarioPermissao_pkey" PRIMARY KEY ("usuarioId","permissao")
);

-- CreateTable
CREATE TABLE "GoogleCredencial" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "GoogleCredencial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "dataHoraInicio" TIMESTAMP(3) NOT NULL,
    "dataHoraFim" TIMESTAMP(3) NOT NULL,
    "cliente" TEXT NOT NULL,
    "linkChat" TEXT,
    "observacoes" TEXT,
    "alertaMinutos" INTEGER,
    "googleEventId" TEXT,
    "linkMeet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "atendenteId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assunto" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "Assunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "corHex" TEXT NOT NULL,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AgendamentoToAssunto" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AgendamentoToAssunto_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCredencial_usuarioId_key" ON "GoogleCredencial"("usuarioId");

-- CreateIndex
CREATE INDEX "_AgendamentoToAssunto_B_index" ON "_AgendamentoToAssunto"("B");

-- AddForeignKey
ALTER TABLE "UsuarioPermissao" ADD CONSTRAINT "UsuarioPermissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCredencial" ADD CONSTRAINT "GoogleCredencial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_atendenteId_fkey" FOREIGN KEY ("atendenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgendamentoToAssunto" ADD CONSTRAINT "_AgendamentoToAssunto_A_fkey" FOREIGN KEY ("A") REFERENCES "Agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgendamentoToAssunto" ADD CONSTRAINT "_AgendamentoToAssunto_B_fkey" FOREIGN KEY ("B") REFERENCES "Assunto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

