import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.development", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
