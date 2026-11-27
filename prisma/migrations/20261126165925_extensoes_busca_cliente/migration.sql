-- Extensões usadas na busca por nome do cliente (lib/buscaCliente.js):
-- unaccent: comparar sem acentos ("Joao" encontra "João")
-- pg_trgm: similaridade por trigramas, tolera erros de digitação ("Silvia" encontra "Silva")
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
