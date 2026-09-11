-- CreateTable
CREATE TABLE "GoogleCredencial" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "atendenteId" TEXT NOT NULL,

    CONSTRAINT "GoogleCredencial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCredencial_atendenteId_key" ON "GoogleCredencial"("atendenteId");

-- AddForeignKey
ALTER TABLE "GoogleCredencial" ADD CONSTRAINT "GoogleCredencial_atendenteId_fkey" FOREIGN KEY ("atendenteId") REFERENCES "Atendente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing Google token data into the new table (reusing Atendente.id as the 1:1 key)
INSERT INTO "GoogleCredencial" ("id", "accessToken", "refreshToken", "tokenExpiry", "atendenteId")
SELECT "id", "googleAccessToken", "googleRefreshToken", "googleTokenExpiry", "id"
FROM "Atendente"
WHERE "googleAccessToken" IS NOT NULL OR "googleRefreshToken" IS NOT NULL OR "googleTokenExpiry" IS NOT NULL;

-- AlterTable
ALTER TABLE "Atendente" DROP COLUMN "googleAccessToken",
DROP COLUMN "googleRefreshToken",
DROP COLUMN "googleTokenExpiry";
