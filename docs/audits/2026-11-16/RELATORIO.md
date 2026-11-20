# Auditoria ECC — Truco da casa

Data: 16/11/2026 (America/Sao_Paulo). Revisão auditada: `14f96e4`.
Produção: https://truco-da-casa.vercel.app

## Parecer

**68/100 — adequado para beta controlada; corrigir os achados de prioridade alta antes de ampliar o público.** A nota é um julgamento de engenharia a partir das evidências abaixo, não uma certificação. Não foi comprovado vazamento de cartas privadas ou acesso administrativo sem autenticação nos caminhos examinados.

Método: ECC `production-audit`, complementado pelos critérios de `security-review` e `accessibility`. O skill `agent-architecture-audit` foi consultado e descartado: o site não contém uma aplicação de agentes/LLM à qual esse procedimento se aplique. Nenhum código foi enviado a scanners externos. Não foram alteradas regras, credenciais nem configurações de produção durante a auditoria.

## Achados por prioridade

### A01 — Alta: puxar tentos não identifica a rodada

- Evidência: `src/lib/server/rooms.ts:143–146`; `src/lib/game.ts:220–229`.
- O servidor aceita revisão antiga para ações manuais se `matchId` ainda for o mesmo. `pullUntil` e `pullLimit` pertencem à janela atual, mas o comando não leva `handNumber` nem um identificador de janela.
- Reprodução isolada: um comando retido da primeira mão, com revisão 4, foi aplicado na mão 2 com revisão 9: HTTP 200 e placar `[3,0]`.
- Impacto: pedido atrasado ou reenviado pode retirar tentos de uma rodada diferente. A idempotência por `requestId` não protege um comando que nunca chegou antes.
- Correção: emitir `pullWindowId` a cada mão encerrada, exigir esse identificador para retiradas positivas e rejeitar janelas antigas. Preservar devoluções fora da janela.
- Prova: `manual-stale-command.json`; reprodução em `reproduce-manual-stale.mts`.

### A02 — Alta: limites de acesso não são compartilhados entre instâncias

- Evidência: `src/lib/server/http.ts:26–32`, `src/app/api/admin/auth/route.ts`.
- O controle de tentativas usa um `Map` na memória de um processo. Cada função/instância da Vercel tem contagem própria, que também se perde no reinício.
- Impacto: o limite declarado de cinco tentativas de login por minuto não é uma garantia global. Criação de salas, autenticação anônima e uploads também podem consumir mais recursos do que o limite sugere.
- Correção: contador persistente/atômico ou limitação na borda, com chaves de IP/identidade adequadas. Não foi realizado ataque de força bruta ou teste de carga em produção.

### A03 — Média: falta proteção contra enquadramento em outro site

- Evidência HTTP: `/`, `/admin`, `/como-jogar`, `/sinuca`, `/domino` responderam sem `Content-Security-Policy: frame-ancestors` e sem `X-Frame-Options`.
- Evidência de configuração: `next.config.ts` não define esses cabeçalhos.
- Impacto: páginas podem ser incorporadas em frames por outros sites, abrindo espaço para clickjacking. Não foi testado abuso contra uma sessão administrativa real.
- Correção: definir política de enquadramento e CSP compatível com imagens, áudio e WebRTC; validar em preview.

### A04 — Média: vídeo ainda depende de conexão direta

- Evidência: `src/app/api/camera-config/route.ts:5–6`; inventário de variáveis da Vercel nesta sessão e confirmação do responsável: não há TURN configurado.
- A aplicação fornece STUN e só adiciona relay se `TURN_URL` e `TURN_SECRET` existirem.
- Impacto: determinados NATs, operadoras e redes corporativas podem impedir a conexão. Não se pode prometer vídeo em todas as redes.
- Correção: provisionar TURN e testar entre redes distintas. Antes de habilitar o serviço, limitar `/api/camera-config` por identidade e associação a sala; hoje basta obter uma identidade anônima para solicitar a configuração.

### A05 — Média: falha transitória na sinalização não provoca nova tentativa

- Evidência: `src/components/RoomCameras.tsx:50–62` e `src/app/room/[code]/page.tsx` (`cameraCommand`).
- `cameraCommand` retorna `false` em falha de rede/HTTP. Quem envia oferta/resposta aguarda o resultado, mas não verifica esse `false`. A conexão já fica no mapa; a criação da próxima oferta exige que ela não exista. Alguns sinais também são marcados como vistos antes de concluir o processamento.
- Impacto: uma falha no momento da oferta/resposta pode deixar o vídeo parado até desligar/ligar. O fluxo feliz com duas sessões foi validado anteriormente; a recuperação de falha não tem prova equivalente.
- Correção: fila com confirmação, repetição limitada, limpeza do peer malsucedido e indicação visível de estado. Validar perda de uma oferta e de uma resposta.

### A06 — Média: sinuca transborda em telas estreitas

- Reprodução em produção: `/sinuca`, viewport de 320 pixels, largura do documento de **376 pixels**. Em 390 e 1440 pixels não ocorreu esse transbordamento.
- Evidência: `runtime.json`, registros `production-public`; estilos em `src/app/sinuca/sinuca.css`.
- Impacto: rolagem horizontal e formulário menos utilizável em aparelhos pequenos ou zoom elevado.
- Correção: identificar o item de tamanho mínimo na grade/formulário, usar `min-width:0` e reorganizar campos/botões abaixo do limite real. Verificar também 360 pixels e zoom.

### A07 — Alta para qualidade de entrega: suíte E2E desatualizada e sem gate automatizado

- `npm test` executa testes de motores/servidor, mas não Playwright. Não há workflow versionado em `.github/` neste checkout.
- No build de produção, seis fluxos selecionados passaram e dois falharam. O tutorial móvel ainda procura o link antigo “Aprender a jogar”, enquanto a navegação foi alterada para “Como jogar”.
- As duas verificações antigas de partidas completas falham antes do ciclo da partida por procurar a string “Truco” com maiúscula; a marca renderizada é “truco”. Isso não prova defeito na partida.
- `tests/desktop-visual.spec.ts` ainda busca “Treinar com bots”, incompatível com o texto atual de treino em duplas.
- `tests/custom-mode.spec.ts`, `tests/pool.spec.ts` e outros testes importantes têm `test.skip` condicionado ao endereço `localhost:3002` e/ou arquivo local de credenciais. Executar a suíte em outro ambiente pode omitir esses cenários.
- Correção: atualizar seletores e expectativas para o comportamento atual; criar fixtures independentes do endereço e credenciais de teste descartáveis; executar tipos, testes, build e E2E numa rotina de entrega. Não alterar testes apenas para torná-los verdes: preservar as verificações de privacidade e comportamento.

### A08 — Média: foco do tutorial pode ser perdido ao mudar para celular

- Reprodução: abrir o diálogo no desktop, reduzir para 390 pixels, fechar com Escape. O botão que deveria recuperar o foco está oculto por `src/components/truco-tutorial.css:18`.
- Evidência: segundo teste de `tests/tutorial.spec.ts`, relatório `e2e-production-build.json`.
- Impacto: usuários de teclado/tecnologias assistivas perdem o ponto de retorno.
- Correção: devolver foco a um controle visível estável quando o botão original estiver oculto, ou manter uma forma acessível de voltar à consulta. A retirada visual do tutorial no celular foi uma decisão de produto anterior; o achado é sobre o foco, não sobre desfazer essa decisão.

### A09 — Média: emotes dependem de uma janela muito curta de polling

- Evidência: `src/lib/social.ts:1` define duração de 1 segundo; a página consulta aproximadamente a cada 750 ms. O servidor altera `socialRevision`, mas a projeção SQL/notificação é baseada em `revision`.
- Impacto: rede lenta ou aba em segundo plano pode perder uma frase/emote inteiro. Além disso, o balão não tem região viva própria para anunciar a reação a leitores de tela.
- Correção: notificar revisão social ou usar entrega explícita de eventos; ajustar expiração no cliente com uma janela de apresentação legível e anúncio acessível. Não prolongar indefinidamente sinais antigos na mesa.

### A10 — Média: custo de sincronização cresce com cada espectador/jogador

- Evidência: `src/app/room/[code]/page.tsx:31`, `src/lib/server/rooms.ts:125–159`, `src/lib/server/auth.ts:34–37`, migrações SQL.
- A consulta periódica faz autenticação remota, leitura e gravação CAS do documento, mesmo quando só registra presença. A projeção SQL ainda remove/recria associações na atualização da sala.
- Uma sala com quatro clientes ativos pode gerar aproximadamente 5,3 consultas por segundo apenas pelo intervalo de 750 ms, antes de considerar jogadas e SSE. Isso é uma estimativa do código, não um benchmark de carga.
- Impacto: custo, latência e concorrência no armazenamento aumentam com o número de salas. SSE existe, mas não elimina o polling.
- Correção: separar heartbeat de leitura, reduzir gravações de presença e rever a projeção de membros. Medir antes/depois com carga controlada em staging.

### A11 — Média: operação e retenção precisam de rotina explícita

- Não foram encontrados endpoint de saúde/dependências, rotina de expiração de salas, monitoramento de erro da aplicação ou procedimento claro de rollback nos arquivos examinados.
- Os documentos de deploy registram histórico de publicações, mas contêm trechos antigos de regras, layout e testes. Salas e sinalizações de câmera podem permanecer no último documento persistido além da expiração de apresentação.
- Impacto: falhas externas ficam difíceis de diagnosticar; dados/arquivos crescem sem uma política operacional demonstrada.
- Correção: documentar rollback com verificação pós-retorno, métricas/alertas, retenção de salas e limpeza de sinalizações expiradas. Confirmar políticas do projeto Supabase antes de excluir qualquer dado. Não foi feita exclusão de dados de produção.

## Evidências e verificações

- Checkout inicial limpo, `main` sincronizada com `origin/main`, revisão `14f96e4`.
- `npm test`: **92 passaram, 0 falharam**.
- `npm run typecheck`: passou.
- Build isolado com `TRUCO_BUILD_DIR=.next-audit npm run build`: passou; rotas de truco, dominó, sinuca, administração e câmera foram geradas.
- Produção: cinco páginas públicas responderam HTTP 200; `/api/admin/config` respondeu 401 sem sessão; `/api/rooms` respondeu 200 com `no-store, private`.
- Quinze verificações de páginas públicas em 1440, 390 e 320 pixels: sem erros JavaScript capturados; um transbordamento em `/sinuca` a 320 pixels. Isso não constitui uma auditoria completa de leitor de tela ou de contraste.
- Playwright no build de produção local: 6/8 passaram — início responsivo, API/idempotência/cookie adulterado, interação 1x1, interação 2x2, chat/emojis entre sessões e entrada/treino de dominó. Dois testes do tutorial falharam pelos motivos acima.
- Os E2E antigos de partidas completas encerraram antes do loop por expectativa textual desatualizada; ver `e2e-full-matches.json`. A verificação independente por API concluiu as duas partidas e suas revanches: 1x1 em 58 passos, placar `[11,5]`; 2x2 em 91 passos, placar `[5,11]`. Evidência: `full-match-independent.json`.
- No build de produção local foram conferidas 18 combinações de jogo/fase/largura: truco, dominó e sinuca; lobby e partida; 1440, 390 e 320 pixels. Nenhum transbordamento horizontal, botão fora da largura ou erro JavaScript foi registrado nesses cenários sem câmera ativa. Evidência: `runtime-production-build.json` e capturas PNG.
- O primeiro ensaio em `next dev` apresentou falha de WebSocket HMR e páginas sem hidratação nesse ambiente. Seus erros de interação não foram classificados como defeitos de produção. Os cenários foram repetidos em `next start`.
- Uploads: autorização administrativa, limite de corpo e identificação binária de formato examinados; testes existentes passaram. Não foi acessada uma conta administrativa real.
- Banco: RLS/revogação de acesso às cartas e CAS presentes nas migrações/código. Não foi feita uma inspeção privilegiada das políticas efetivamente aplicadas no banco em produção.

## Ordem recomendada de correção

1. Vincular retiradas manuais à janela da rodada, com prova de atraso/reenvio e concorrência entre parceiros.
2. Tornar a suíte E2E confiável e parte da rotina de entrega; corrigir foco do tutorial e transbordamento da sinuca.
3. Persistir limites de acesso e proteger enquadramento.
4. Completar confiabilidade do vídeo: TURN, limitação de configuração e recuperação de sinalização.
5. Melhorar entrega acessível dos emotes e reduzir custo de sincronização.
6. Documentar monitoramento, rollback e retenção com o responsável pelo banco.

## Limites da conclusão

Não inclui pentest externo, carga de produção, inspeção de segredos, acesso administrativo real, certificação WCAG, testes em iPhone/Safari físico ou conectividade WebRTC entre operadoras. Câmeras foram examinadas pelo código e pelas evidências de teste desta sessão; não há garantia de todas as combinações de dispositivos/redes. Os demais achados distinguem reprodução, inspeção de código e estimativas.
