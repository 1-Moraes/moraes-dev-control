# Migrations — Moraes.Dev Control

`../schema.sql` é a base inicial completa (equivalente a uma "migration 0001"),
criada do zero para este projeto, NÃO executada em nenhum banco ainda.

A partir da primeira execução real (quando o Supabase próprio existir e
estiver autorizado), toda alteração de schema deve ganhar um arquivo aqui,
numerado e datado, nunca uma edição direta em schema.sql:

0001_schema_inicial.sql   (cópia do schema.sql no momento em que for executado)
0002_<descricao>.sql
0003_<descricao>.sql
...

Isso evita o problema encontrado no projeto original (TI-Chamados), onde o
schema.sql versionado no repositório ficou desatualizado em relação ao
banco real porque várias alterações foram feitas direto no SQL Editor do
Supabase sem gerar arquivo correspondente.
