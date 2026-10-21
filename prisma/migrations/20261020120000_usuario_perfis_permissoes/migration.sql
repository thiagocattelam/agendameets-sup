-- Escrita à mão: renomeia Atendente -> Usuario preservando os dados.
-- (O diff automático do Prisma geraria DROP TABLE + CREATE TABLE.)
-- ALTER INDEX também renomeia a constraint dona do índice, então serve
-- tanto se o unique de e-mail for constraint quanto se for só índice.

-- RenameTable
ALTER TABLE "Atendente" RENAME TO "Usuario";
ALTER INDEX "Atendente_pkey" RENAME TO "Usuario_pkey";
ALTER INDEX "Atendente_email_key" RENAME TO "Usuario_email_key";

-- RenameColumn: GoogleCredencial.atendenteId -> usuarioId
ALTER TABLE "GoogleCredencial" RENAME COLUMN "atendenteId" TO "usuarioId";
ALTER INDEX "GoogleCredencial_atendenteId_key" RENAME TO "GoogleCredencial_usuarioId_key";
ALTER TABLE "GoogleCredencial" RENAME CONSTRAINT "GoogleCredencial_atendenteId_fkey" TO "GoogleCredencial_usuarioId_fkey";

-- Agendamento.atendenteId mantém o nome; a FK acompanha a tabela renomeada.

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('GESTAO', 'ATENDENTE');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "perfil" "Perfil" NOT NULL DEFAULT 'ATENDENTE';

-- CreateTable
CREATE TABLE "UsuarioPermissao" (
    "usuarioId" TEXT NOT NULL,
    "permissao" TEXT NOT NULL,
    "concedida" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UsuarioPermissao_pkey" PRIMARY KEY ("usuarioId","permissao")
);

-- AddForeignKey
ALTER TABLE "UsuarioPermissao" ADD CONSTRAINT "UsuarioPermissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
