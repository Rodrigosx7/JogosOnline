# Auditoria completa — Truco da casa

Data: 20/11/2026. Revisão auditada: `2260493` (main). Auditoria somente leitura: nenhum arquivo do projeto foi alterado além deste relatório.

> **Atualização (mesmo dia):** as correções foram aplicadas depois desta auditoria; veja [Correções aplicadas](#correções-aplicadas-20112026) no fim. O texto abaixo descreve o estado de `2260493`.

Base de comparação: [2026-11-16/RELATORIO.md](2026-11-16/RELATORIO.md) (revisão `14f96e4`). Desde então entraram apenas `256ba9d` (espaçamento desktop) e `2260493` (ver câmeras sem transmitir). Os achados antigos são citados como **A01…A11** e não são repetidos em detalhe; os novos são **N01…**.

Verificações executadas nesta auditoria:

- `npm test`: passou, 0 falhas. `npm run typecheck`: passou.
- Guia do Next.js lido em `node_modules/next/dist/docs/` (route segment config, route handlers). O código usa `params` como `Promise` com `await`, não usa `runtime = 'edge'` (obsoleto) nem `preferredRegion` (obsoleto). Não há `middleware`/`proxy`. Nenhum uso de API obsoleta do Next foi encontrado.
- Reprodução isolada (script fora do repositório, com `tsx`) do achado N01: confirmado.
- Não executado: E2E Playwright, build de produção, testes em produção, carga, WebRTC entre redes. Itens que dependem disso estão marcados como **não verificado**.

---

## Os 5 problemas mais graves

1. **N01 — Crítica: revanche com jogador que saiu inicia partida incompleta e trava a sala para sempre.** `rematchVotes` não é limpo no `leave`; a contagem atinge o tamanho da mesa com um voto de quem já saiu e `startHand` roda com jogadores faltando. Na primeira expiração de prazo, `reconcile` lança `TypeError` em toda requisição (HTTP 503 permanente). Reproduzido.
2. **N02 — Alta: todo participante agora registra "câmera" e abre conexões WebRTC com todos, mesmo sem transmitir.** Após `2260493`, cada cliente grava no documento da sala a cada 10 s e cria uma malha N×N de `RTCPeerConnection`, inclusive entre dois clientes só‑recepção (sem mídia alguma). Com até 32 espectadores, isso multiplica gravações CAS, conflitos e SDPs de até 16 KB guardados no documento.
3. **A01 — Alta (pendente, parcialmente mitigado): retirada manual de tentos não identifica a rodada.** O comando ainda só leva `matchId`; a janela de 5 s reduz, mas não elimina, a aplicação de um pedido atrasado na rodada seguinte.
4. **A02/N05 — Alta (pendente): limites de taxa só na memória e por identidade descartável.** Além do problema já registrado, os limites por `playerId` são contornados apagando cookies (cada requisição sem cookie cria um novo usuário anônimo no Supabase), e as chaves por IP confiam no primeiro valor de `x-forwarded-for`.
5. **A07 — Alta (pendente): E2E fora de qualquer gate e com testes desatualizados/condicionais.** Continua sem `.github/` e `npm test` não roda Playwright; 9 specs usam `test.skip` condicional. Os bugs N01 e N02 não seriam pegos por nenhum teste atual.

---

## 1. Bugs e lógica do jogo

| Gravidade | Arquivo:linha | Problema | Impacto | Correção sugerida |
|---|---|---|---|---|
| **Crítica** (N01) | `src/lib/game.ts:180-188`, `:287-291`, `:411-412` | `leave` é permitido com status `finished`/`cancelled`, remove o jogador mas não o tira de `rematchVotes`. `rematch` compara `rematchVotes.length === size(r)`. Resultado: partida começa com 1 jogador em 1x1 (ou 3 em 2x2). Quando chega a vez do lugar vazio, `atSeat()` retorna `undefined` e `reconcile` lança exceção. | Sala inutilizada para todos (503 em todo GET/POST, já que `accessRoom` chama `reconcile` antes de tudo). Reprodução: A vota revanche → A sai → B vota revanche → `status: playing, players: ['B']` → `reconcile(t+40s)` lança `Cannot read properties of undefined (reading 'id')`. | No `leave`/`kick`, filtrar `rematchVotes` e `finishVotes`; em `rematch`, exigir `r.players.length === size(r)` e contar só votos de jogadores presentes. Opcional: proteger `reconcile` contra lugar vazio (cancelar a partida). Adicionar teste de regressão. |
| Alta (A01, pendente) | `src/lib/server/rooms.ts:139-141`; `src/lib/game.ts:216-235` | `sameManualMatch` aceita qualquer revisão ≤ atual dentro do mesmo `matchId`. O commit `14f96e4` limitou o valor à janela de 5 s e ao `pullLimit`, mas não vinculou o comando à rodada. | Pedido retido/reenviado pode puxar tentos na janela da mão seguinte. | Igual ao relatório anterior: `pullWindowId` por mão encerrada, exigido para valores positivos. |
| Média (N03) | `src/lib/game.ts:224-226` | `pullLimit` vale para **cada** equipe (`pullUsed[ownTeam]`), não só para a vencedora. A equipe que perdeu a mão também pode puxar o valor da mão. | Placar manual pode subir para os dois lados na mesma rodada. **Não verificado** se é intencional (modo "honra" entre amigos); `docs/modo-personalizado.md` deve dizer. | Se não for intencional: guardar a equipe vencedora em `award()` e permitir retirada positiva só para ela. |
| Média (N04) | `src/lib/game.ts:241`, `src/lib/server/bot.ts:39-41` | Encerramento por votação exige todos os `r.players`; bots só votam depois de um humano. Em 2x2 com um humano ausente (o modo manual não aplica abandono, `game.ts:389`), a partida não termina por voto nem por ausência. | Partida manual pode ficar aberta indefinidamente; jogadas ficam no autoplay por prazo. | Aplicar abandono também no manual, ou permitir encerrar com votos dos presentes após um tempo. |
| Baixa | `src/lib/game.ts:229-233` | Recalcular `eleven` durante a janela de retirada cria `eleven` forçado sem `resolveDecision`; um `eleven` existente é sobrescrito com novo `id`. | Um clique de decisão enviado antes da troca recebe 409. Sem corrupção de placar. | Só recriar se o conjunto de equipes em 11 mudou. |
| Baixa | `src/lib/game.ts:123` | Na vaza empatada, a próxima é iniciada por quem abriu a vaza empatada. | Depende da regra da casa; **não verificado** contra `docs/regras-para-revisao.md`. | Confirmar a regra e cobrir com teste. |

Conferido e correto: `handWinner` (todas as combinações de empate), `scoreAfterWin` com as etapas da casa, prazo de pedido entregando a aposta anterior, mão de 11/11 a 11 obrigatória, `capar` em 11 a 3, privacidade de cartas em `playerView` (mão própria, cartas cobertas como `null`, `partnerHands` só na mão de 11, espectadores sem cartas).

## 2. Segurança

| Gravidade | Arquivo:linha | Problema | Impacto | Correção sugerida |
|---|---|---|---|---|
| Alta (A02 + N05) | `src/lib/server/http.ts:26-32`; `src/lib/server/auth.ts:46-49`; rotas em `src/app/api/**` | Limites em `Map` por instância (A02). Novo: limites por `playerId` são contornáveis porque qualquer requisição sem cookie cria uma identidade anônima nova (`/auth/v1/signup`); limites por IP usam `x-forwarded-for` (o primeiro valor). Em `src/app/api/sinuca/rooms/route.ts:3` a chave usa o cabeçalho inteiro. | Força bruta no login admin e criação em massa de salas/usuários anônimos além do limite declarado. Se a plataforma sobrescreve o `x-forwarded-for` (a Vercel diz que sim) **não foi verificado** aqui. | Limite persistente (Upstash/Postgres) ou WAF na borda; limitar `signup` anônimo por IP; usar o mesmo extrator de IP em todas as rotas. |
| Média (A03, pendente) | `next.config.ts:2` | Sem `frame-ancestors`/`X-Frame-Options`/CSP. | Clickjacking (inclusive em `/admin`). | `headers()` em `next.config.ts` com `frame-ancestors 'none'` e CSP compatível com WebRTC/áudio. |
| Média (A04, pendente) | `src/app/api/camera-config/route.ts:3-7` | Sem limite de taxa nem verificação de pertencer a uma sala; sem TURN configurado. | Ao ligar TURN, qualquer identidade anônima obtém credenciais de relay. | Exigir `code` + membro da sala e `rateLimit` antes de emitir credenciais. |
| Baixa (N06) | `src/lib/server/admin-auth.ts:10-15` | `scryptSync` bloqueia o event loop por tentativa; combinado com A02, várias tentativas paralelas atrasam todas as salas na mesma instância. | Degradação de latência sob ataque. | `scrypt` assíncrono (`util.promisify`). |
| Baixa | `src/lib/server/http.ts:10-13` | `sameOrigin` aceita requisições sem `Origin` e sem `Sec-Fetch-Site`. | Aceitável (cookie `SameSite=Lax` cobre o caso de navegador); registrar como decisão. | Documentar. |

Conferido e correto: sessão local HMAC com `timingSafeEqual`; sessão admin com expiração, versão (revoga após troca de senha), cookie `HttpOnly`/`Strict`/`path=/api/admin`; uploads com limite de tamanho e detecção por bytes mágicos e `CSP default-src 'none'` na resposta; `game_rooms` sem acesso para `anon`/`authenticated` (RLS); SSE não repassa payload do banco; React escapa chat/nomes (nenhum `dangerouslySetInnerHTML`). Câmera: só vídeo (`audio:false`), permissão pedida apenas no clique. Segredos: nenhum segredo no código; `.data/` local. Não foi feita inspeção das políticas efetivas no banco de produção.

## 3. Sincronização em tempo real

| Gravidade | Arquivo:linha | Problema | Impacto | Correção sugerida |
|---|---|---|---|---|
| Alta (N02) | `src/components/RoomCameras.tsx:23-28`, `:42-50`; `src/app/room/[code]/page.tsx` (`<RoomCameras>` sempre montado) | Desde `2260493` o registro `camera` roda para todos, com ou sem stream, a cada 10 s. Todo participante entra em `cameras` e o par com menor id oferece conexão a todos — inclusive quando nenhum dos dois transmite (`recvonly` ↔ `recvonly`). | Gravações extras no documento (CAS) por cliente; até O(N²) conexões e sinais SDP (≤16 KB cada, até 32 guardados no documento, `game.ts:213`); mais 409 em jogadas simultâneas. | Separar "transmitindo" de "assistindo": só quem tem stream se registra em `cameras`; quem só assiste recebe ofertas dos transmissores. Nunca conectar dois clientes sem mídia. |
| Média (A05, pendente) | `src/components/RoomCameras.tsx:47`, `:54` | O retorno `false` de `send` continua ignorado; o peer fica no mapa e não há nova oferta; `seen` é marcado antes de processar o sinal. | Vídeo parado até desligar/ligar. | Igual ao relatório anterior. |
| Média (A09, pendente) | migração `202611070001`, trigger `project_game_revision`; `src/lib/game.ts:209,214,262` | Chat, sinais e câmera só alteram `socialRevision`; o trigger só notifica `revision`. SSE não avisa; tudo depende do polling. | Emotes de 1 s perdidos; sinalização de câmera lenta. | Projetar também `socialRevision` em `game_revisions`. |
| Média (A10, pendente) | `src/app/room/[code]/page.tsx` (poll 750 ms); `src/lib/server/rooms.ts:125-158` | GET faz autenticação remota + leitura + gravação CAS, mesmo com SSE ativo. | Custo e contenção. | Heartbeat separado e resposta `unchanged` como já existe na sinuca (`known=`). |
| Média (N07) | `src/app/api/rooms/[code]/assets/[id]/route.ts:6`; `src/app/api/rooms/[code]/events/route.ts:15` | Para verificar participação, essas rotas chamam `accessRoom`, que **grava** o documento (heartbeat + bot). Cada imagem/áudio do modo personalizado e cada reconexão SSE vira uma escrita CAS. | Dezenas de escritas extras ao abrir uma sala personalizada (até 40 cartas + 11 sons); mais 409. | Função `readRoomMembership` só de leitura para essas rotas. |
| Baixa (N08) | `src/lib/server/storage.ts:72-75` | `listOpen` baixa o documento completo (mãos, chat, SDPs) de até 40 salas e é compartilhado por truco, dominó e sinuca. | Lista lenta e uma modalidade pode esconder salas da outra quando há mais de 40 salas abertas. | Selecionar só campos necessários e filtrar por `document->state->>game`. |
| Baixa | `src/app/room/[code]/page.tsx` (SSE) | `EventSource` reconecta a cada 55 s com `accessRoom` completo (gravação). | Somado a N07. | Igual a N07. |

## 4. Desempenho

| Gravidade | Arquivo:linha | Problema | Impacto | Correção sugerida |
|---|---|---|---|---|
| Alta | — | N02 e N07 (acima) são também os maiores custos novos. | — | — |
| Média | `src/lib/server/auth.ts:38-41` | Toda requisição chama `GET /auth/v1/user` no Supabase antes de qualquer trabalho. | +1 ida e volta de rede por poll (≈1,3/s por cliente jogando). | Validar o JWT localmente (segredo/JWKS do projeto) e só ir ao Supabase no refresh. |
| Média | `src/lib/game.ts:57,160,376,425` | `structuredClone` do estado inteiro em `applyCommand`, `reconcile` e `playerView` a cada requisição; `advanceBot` chama `playerView` para cada bot várias vezes. | CPU por requisição cresce com chat (50), histórico (100) e SDPs. | Aceitável hoje; medir antes de otimizar. Tirar `cameraSignals` do documento principal ajuda mais. |
| Média | `src/app/room/[code]/page.tsx` (36 KB, um componente) | Página da sala é um único componente cliente; `setNow` a cada 1 s re-renderiza a mesa inteira. | Re-renderizações desnecessárias em celulares fracos. **Não medido** (sem profiler nesta auditoria). | Isolar relógio/contador em componentes pequenos; `memo` na mesa e na mão. |

Bundle: **não verificado** (build não executado nesta auditoria). Dependências de runtime são poucas (`next`, `react`, `@supabase/supabase-js` só no servidor).

## 5. Qualidade de código

| Gravidade | Arquivo:linha | Problema | Impacto | Correção sugerida |
|---|---|---|---|---|
| Média | `src/lib/game.ts:159` e `:419` | `applyCommand(…, command: any)` e `playerView(): any`; o bot e o cliente consomem `view` sem tipo. | Erros de campo só aparecem em execução (ex.: N01 passaria pelo `tsc`). | Tipo `Command` discriminado e `PlayerView` explícito, compartilhado com o cliente. |
| Média | `src/lib/server/rooms.ts`, `domino-rooms.ts`, `pool-rooms.ts` | Três cópias do mesmo laço "ler → reconciliar → idempotência → CAS → 10 tentativas". | Correções (ex.: A01, N07) precisam ser feitas três vezes. | Extrair `accessGameRoom(adapter)`. |
| Baixa | vários (`api/admin/*`, `sinuca/*`, `custom-store.ts`, CSS) | Arquivos inteiros em uma ou poucas linhas (ex.: `api/admin/assets/route.ts` com 1 linha lógica, `pool/PoolTable.tsx`). | Revisão e diffs difíceis; `wc -l` subestima o tamanho real. | Formatador (Prettier/Biome) e lint no CI. |
| Baixa | `src/lib/game.ts:381`, `src/lib/truco-rules.ts:5` | `steps` duplica `SCORE_STEPS`. | Divergência futura. | Importar `SCORE_STEPS`. |
| Baixa | `package.json` | Sem ESLint; nome/descrição genéricos (`main: index.js`). | — | Adicionar `next lint`/ESLint ao CI. |

APIs do Next: nenhum uso obsoleto encontrado (ver início). `runtime = 'nodejs'` é o padrão e pode ser removido, sem impacto.

## 6. UI/UX e acessibilidade

| Gravidade | Arquivo:linha | Problema | Impacto | Correção sugerida |
|---|---|---|---|---|
| Média (A06, pendente?) | `src/app/sinuca/sinuca.css` | Transbordamento a 320 px. Nenhuma mudança de CSS da sinuca desde a última auditoria. | Rolagem horizontal. **Não reverificado** no navegador. | Igual ao relatório anterior. |
| Média (A08, pendente) | `src/components/truco-tutorial.css:18` | Foco do tutorial perdido ao mudar para celular. Sem mudanças desde então. | Teclado/leitor de tela. | Igual ao relatório anterior. |
| Média (N09) | `src/components/RoomCameras.tsx:60` | Botão de câmera alterna estado sem `aria-pressed`; o vídeo de cada lugar não diz se a câmera está ligada ou falhou; com N02, a lista de "câmeras ativas" passa a incluir quem só assiste. | Indicação de estado confusa. | `aria-pressed`, estado por pessoa (`conectando/ligada/falhou`) e corrigir N02. |
| Baixa (N10) | `src/app/room/[code]/page.tsx` (efeito inicial e `command`) | `localStorage.getItem/setItem('truco-name')` sem `try/catch` (o de `truco-card-motion` tem). | Em navegadores com armazenamento bloqueado pode lançar `SecurityError` e quebrar a carga da sala. **Não reproduzido**. | Envolver em `try/catch`. |
| Baixa (A09) | balão de emote | Sem região viva. | Leitor de tela não anuncia. | `aria-live="polite"`. |

## 7. Testes — o que falta cobrir

| Gravidade | Área | Lacuna | Sugestão |
|---|---|---|---|
| Alta | `game.ts` | `leave`/`kick` depois do fim da partida combinados com `rematch` e `finish-vote` (N01). | Teste unitário: voto → saída → voto do outro não inicia partida. |
| Alta | Câmeras | Nenhum teste de `RoomCameras` (N02, A05): espectador sem câmera, falha de envio de oferta/resposta. | Teste Playwright com `--use-fake-device-for-media-stream` e 3 contextos (2 jogadores + 1 espectador). |
| Alta | CI (A07) | Sem pipeline; E2E com `test.skip` condicional em 9 specs (`admin-password`, `custom-mode`, `decision-notices`, `eleven`, `pool`, `result`, `room-upgrades`, `table-details`, `trick-results`). | Workflow com `typecheck`, `npm test`, `build` e E2E contra `next start`. |
| Média | `rooms.ts` | A01 sem teste de rejeição; concorrência CAS entre parceiros. | Teste com `FileRoomStore` e duas promessas simultâneas. |
| Média | Rotas | `assets`/`events` não devem gravar (N07); limites de taxa. | Teste de que GET de asset não altera `version`. |
| Baixa | Domínó/sinuca | Um teste de servidor cada (`domino-rooms.test.ts`, `pool-rooms.test.ts`). Não verificado se a sinuca (que aceita `leave`) tem o mesmo problema de N01. | Portar o teste de N01 para `pool/game.ts`. |

---

## Correções rápidas (menos de 30 min cada)

1. **N01**: em `leave`/`kick`, `r.rematchVotes = r.rematchVotes.filter(id => id !== target)` (e o mesmo para `finishVotes`); em `rematch`, exigir `r.players.length === size(r)`. Mais um teste unitário.
2. **N02 (paliativo)**: em `RoomCameras`, só chamar `register` quando `local` existir; o espectador continua recebendo ofertas de quem transmite. (Depois rever o fluxo para quem só assiste.)
3. **N10**: `try/catch` nas leituras/gravações de `truco-name`.
4. **A03**: `headers()` em `next.config.ts` com `Content-Security-Policy: frame-ancestors 'none'` e `X-Frame-Options: DENY` (validar em preview).
5. **A04**: `rateLimit` e verificação de membro em `/api/camera-config`.
6. **N06**: trocar `scryptSync` por `scrypt` assíncrono.
7. Unificar a extração de IP (`x-forwarded-for`) num helper usado por todas as rotas (inclui `sinuca/rooms/route.ts:3`).
8. `game.ts:381`: usar `SCORE_STEPS`.
9. `aria-pressed` no botão de câmera e `aria-live` no balão de emotes.
10. Atualizar os seletores desatualizados dos E2E apontados em A07 ("Como jogar", "truco" minúsculo, texto de treino).

## Status dos achados anteriores (2026-11-16)

| Id | Status |
|---|---|
| A01 retirada sem rodada | Pendente (mitigação parcial pela janela de 5 s) |
| A02 limite em memória | Pendente; agravado por N05 |
| A03 enquadramento | Pendente |
| A04 TURN/config de câmera | Pendente |
| A05 sinalização sem nova tentativa | Pendente |
| A06 sinuca a 320 px | Provavelmente pendente (sem mudança no CSS; não reverificado) |
| A07 E2E/CI | Pendente |
| A08 foco do tutorial | Pendente |
| A09 emotes/SSE social | Pendente |
| A10 custo de sincronização | Pendente; agravado por N02 e N07 |
| A11 operação/retenção | Pendente (sem endpoint de saúde, limpeza de salas ou monitoramento no código) |

## Limites

Sem pentest, carga, build, E2E, inspeção do banco de produção, teste em iPhone/Safari ou WebRTC entre redes. Desempenho e bundle foram avaliados pelo código, não medidos. Regras da casa foram conferidas contra o código e testes existentes, não contra um especialista.

---

## Correções aplicadas (20/11/2026)

Nada foi commitado. Verificação: `npm run typecheck` ok; `npm test` 95/95; `next build` ok (diretório isolado); conferência manual no navegador local (partida contra bot, sinuca a 320 px sem rolagem lateral, cabeçalhos, `/api/health`, `/api/camera-config`). Resultado da suíte E2E: ver a última linha desta seção.

| Id | O que mudou |
|---|---|
| N01 | `leave`/`kick` retiram o voto de revanche/encerramento; revanche exige mesa completa e votos de todos os presentes; `reconcile` cancela uma partida com lugar vazio (recupera salas já travadas). Teste de regressão em `game.test.ts`. |
| A01 | Puxar tentos exige `pullWindow` (o `pullUntil` da rodada). Janela diferente ou ausente → 409 sem alterar o placar; devolver continua livre. O cliente envia a janela. Teste em `rooms.test.ts`. |
| N02 | Câmeras: registro marca `live`. Quem só assiste só se registra quando há alguém transmitindo; dois clientes sem vídeo nunca se conectam; quem transmite faz a oferta. |
| A05 | Falha ao enviar oferta/resposta descarta o peer e tenta de novo; sinal só é marcado como visto depois de processado; oferta sem resposta expira em 20 s. |
| A09 | Nova migração `202611200001_social_revision.sql`: `game_revisions.social_revision` e notificação Realtime de chat/sinais/câmera; SSE repassa a revisão social. Sinais visíveis por 2 s (antes 1 s) e anunciados com `role="status"`/`aria-live`. **A migração precisa ser aplicada no Supabase.** |
| A10 | GET só grava quando o jogo mudou ou a presença tem mais de 20 s; polling envia `known=` e recebe `{unchanged:true}` quando nada mudou. A migração também deixa de recriar `game_memberships` a cada atualização. |
| N07 | `readRoom` (somente leitura) para arquivos do modo personalizado, SSE e configuração de câmera. |
| N08 | `listOpen(game)` filtra por modalidade no banco. |
| A03 | `next.config.ts`: `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (câmera só na própria origem, sem microfone/localização), `nosniff`. |
| A04 | `/api/camera-config?room=` exige participação na sala e tem limite de taxa. (TURN ainda precisa ser provisionado.) |
| N05 | `clientIp()` único em todas as rotas; criação de identidade anônima limitada por IP (20/min). |
| N06 | Verificação e troca de senha admin com `scrypt` assíncrono. |
| A06 | Sinuca: mesa decorativa limitada à largura da tela; 320 px sem rolagem horizontal (conferido). |
| A08 | Ao fechar o tutorial com o botão escondido (celular), o foco vai para a mesa. Teste E2E ajustado para exigir foco visível. |
| N09 | `aria-pressed` no botão de câmera e contagem de câmeras ligadas anunciada. |
| N10 | `localStorage` do nome protegido com `try/catch`. |
| A07 | `.github/workflows/ci.yml` (typecheck, testes, build, Playwright). `playwright.config.ts` sobe servidor isolado na porta 3002 com armazenamento em arquivo — nunca o Supabase de `.env.local` —, então os testes condicionados a 3002 voltam a rodar. Seletores desatualizados corrigidos. |
| A11 | `/api/health` (vida + acesso ao armazenamento). |
| Qualidade | `SCORE_STEPS` reaproveitado em `reconcile`. |

| A02 | Migração `202611200002_rate_limits_and_retention.sql` (aplicada): `rate_limit_hit` atômico no Postgres. Login/senha admin, criação de identidade anônima e criação de salas (truco, dominó, sinuca) usam `sharedRateLimit`, válido para todas as instâncias; leituras frequentes continuam por instância. Verificado no Supabase: 2 permitidas, a 3ª bloqueada. |
| Desempenho | Token de acesso validado localmente pela JWKS ES256 do projeto (`jwt.ts`, com teste); a chamada a `/auth/v1/user` só acontece quando a validação local não é possível. |
| A11 | `purge_stale_rooms(dias)` criada (não agendada) e seção de operação em `docs/deployment.md` (saúde, rollback, retenção, migrações). |
| E2E | Testes desatualizados corrigidos: contagem de sinais (botão "Mais" das frases, `16db3c3`), rótulo visível do bot, foco do tutorial. `FileRoomStore` tenta de novo o `rename` bloqueado pelo Windows. |

### Não corrigido (com motivo)

- **A04 TURN**: exige contratar/provisionar um serviço TURN e definir `TURN_URL`/`TURN_SECRET`; o código já está pronto e protegido.
- **Agendar a retenção**: apagar salas é permanente; precisa da sua decisão sobre o prazo antes de agendar com `pg_cron`.
- **Monitoramento de erros** (Sentry ou similar): exige criar conta/serviço externo.
- **N03 e N04**: `docs/modo-personalizado.md` descreve esse comportamento como intencional (cada equipe puxa para si; o modo manual não encerra por abandono e exige unanimidade).
- **Refatorações sem defeito associado**: tipagem de `applyCommand`/`playerView`, unificação dos três laços de acesso e divisão da página da sala. Mudanças grandes e arriscadas que não corrigem nenhum comportamento; melhor numa etapa própria.
