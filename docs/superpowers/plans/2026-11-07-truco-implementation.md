# Truco mineiro Implementation Plan

**Goal:** Jogo privado 1x1 e 2x2, 40 cartas, valores 3/5/7/9/11, vitória >=11, sem mãos especiais.
**Architecture:** Next.js + motor puro TypeScript. Estado privado no servidor, armazenamento local para desenvolvimento e Supabase CAS para hospedagem.
**Tech Stack:** Next.js, React, TypeScript, Tailwind, Supabase.

- [x] Motor e testes: src/lib/game.ts, game.test.ts. Validar cartas, vazas, aumentos, timeout, privacidade e abandono.
- [x] Servidor e testes: src/lib/server, app/api, supabase/migrations. Identidade anônima, CAS, idempotência, salas privadas.
- [x] Interface: src/app e src/components. Sala, lobby, mesa, ações, histórico e revanche responsivos.
- [x] Verificação: testes automatizados, tsc, build e sessões independentes.

Ruling: Sem credenciais Supabase existentes, implementar também adaptador local persistente de processo único para permitir testar imediatamente. A integração hospedada depende das variáveis do usuário; não criar conta ou publicar.

## Verificação realizada

20 testes de motor/servidor passaram; TypeScript e build de produção passaram. Quatro testes ponta a ponta passaram com Supabase real, incluindo partidas completas 1x1 e2x2, privacidade, revanche e layout móvel. Validação final pelo navegador também passou: seleção do modo, criação, entrada em segunda sessão, prontidão dos dois jogadores e jogada de carta.

Supabase configurado no projeto do usuário: tabelas e RLS aplicadas, autenticação anônima habilitada, credenciais somente em .env.local. Vercel não foi usado.
