# Publica��o na Vercel

Publicado em 7 de novembro de 2026.

- URL p�blica: https://truco-da-casa.vercel.app
- Projeto: rodrigojst26111/truco-da-casa
- Deployment: dpl_33z4xXByq7mQDoUEUmGnrunV5cXL
- Supabase: credenciais definidas como Secret no ambiente Production; estado e cartas continuam privados no servidor.
- Artefatos locais, arquivos .env, testes, mapas e dados locais exclu�dos do upload por .vercelignore.
- SSE limitado a60 segundos, com reconex�o e polling de fallback.

## Valida��o

A URL de produ��o respondeu HTTP200 sem login ou bypass. Os quatro testes Playwright passaram contra essa URL: partidas completas 1x1 e2x2, placar consistente, cartas privadas, revanche, layout m�vel, revis�o/idempot�ncia e cookie adulterado. Teste real de interface tamb�m passou: criar sala, entrar por segunda sess�o, prontid�o e jogar carta.20 testes de motor/servidor e build passaram antes do deploy.

## Pr�xima publica��o

Usar vercel deploy --prod no diret�rio do projeto. Configurar mudan�as de segredos no ambiente Production e publicar novamente. Nunca passar arquivos .env como c�digo ou exibir valores em relat�rios.

## Atualiza��o de jogabilidade

Cartas jogadas permanecem durante a m�o inteira em grupos por vaza, inclusive na tela final. Limpeza apenas na pr�xima distribui��o. Jogada com clique �nico, op��o de encobrir antes do clique, distribui��o animada e chamada de truco.27 testes unit�rios/integrados e seis fluxos de navegador passaram localmente; testes adicionais cobriram a reten��o na tela final. O intervalo entre vazas n�o remove cartas anteriores.

Atualiza��o publicada em https://truco-da-casa.vercel.app, deployment dpl_GLzTNXrDpmVTTjUzGks9h1wZUiyn. Teste p�blico de interface passou: distribui��o, truco, clique �nico e persist�ncia de cartas entre vazas.

## Distribui��o e mesa ampliadas

Deployment dpl_CxKH136QBoxrQSAjWQuXiGLdNdjx: entrega sequencial de tr�s cartas por jogador em3,3 segundos, com recupera��o para participantes que aguardavam no lobby. Mesa de520px no desktop e420px no celular.27 testes passaram; fluxos reais1x1 e2x2 validaram distribui��o em todas as sess�es e aus�ncia de transbordamento em390px.

## Mesa sem pain�is de vaza

Deployment dpl_5qPgWzH9DLeNL762vdyak1Rw9Ztk. A pedido do usu�rio, a apresenta��o anterior de tr�s pain�is foi substitu�da: somente a vaza atual aparece, com uma carta posicionada em dire��o a cada jogador. O conjunto completo continua vis�vel durante a confer�ncia e � retirado antes da pr�xima vaza. O hist�rico de jogadas permanece no servidor. Testes de interface1x1 e2x2 validam posi��es relativas, aus�ncia dos pain�is e remo��o das cartas anteriores.

## Treino com bot

Deployment dpl_8k8sSXrwdxfvAPvv6EWtP5RtMis4. Bot individual com estratégia baseada somente no estado público e nas próprias cartas. Ações no servidor, espera persistida, respostas ao truco e revanche automática após solicitação humana. Bots não recebem sessão de autenticação nem associação de acesso ao banco. Migração 202611070002 aplicada no Supabase. Validação: 31 testes unitários/integrados e partida completa no navegador com recarga e revanche.


## Mão de 11 e pontuação da casa — 8 de novembro de 2026

Deployment dpl_r7cbbzqB7Ra9mBrPtP3Nf2eveyhF. Mãos de 3 pontos param em 11; valores aumentados ultrapassam e vencem. No 11, a equipe escolhe jogar por 5 ou correr e entregar 3; no 11 a 11, ambas escolhem. Cartas dos parceiros visíveis somente durante a decisão, nunca as dos adversários. Primeira resposta por equipe é definitiva. Prazo de 30 segundos; silêncio corre, com ordem de jogo resolvendo prazos simultâneos. Truco na mão de 11 encerra a partida por derrota do solicitante. Bot decide e evita aumento proibido. Validado com 36 testes de regras/servidor, build e typecheck, partidas completas 1x1/2x2 e contra bot, privacidade, revanche e interface da mão de 11 em sessões independentes (incluindo celular).


## Mão junto à mesa, truco central e tentos — 8 de novembro de 2026

Deployment dpl_3aBrc4TsEGhxuwKVYbgvfV4tkuLS. Cartas em leque junto à borda da mesa, com mão ilustrada. Tentos representados por sementes vermelhas e pretas, uma por ponto, orientados por equipe de cada participante. Pedido de truco persistente no centro: nome de quem pediu, valor, prazo e botões para aceitar, correr e aumentar; aguarda resposta também na tela do solicitante. Identidade pública do solicitante incluída no pedido. Removido o texto de vaza da mesa. Validação: 36 testes de regras/servidor, build/typecheck, cliques reais em 1x1 e 2x2, contagem de tentos, persistência do pedido e responsividade em 390px.


## Chat, sinais privados e 11 a 11 obrigatório — 8 de novembro de 2026

Deployment dpl_5XcA1wrQojG1wZ6Q1wmfAgdEPhF6. Removida a mão desenhada; mantidas as cartas em leque junto à mesa. Chat por sala, texto de até 240 caracteres, últimas 50 mensagens, autor confirmado pelo servidor e intervalo de um segundo. Sinais predefinidos em duplas, visíveis somente à própria equipe, expiram em oito segundos e têm intervalo de dois segundos. Atualizações sociais possuem revisão separada para preservar jogadas concorrentes. Em 11 a 11, a mão inicia automaticamente valendo cinco: ambos jogam, sem decisão de correr; o bot também joga. Salas antigas nessa fase são atualizadas preservando o prazo. Validação: 40 testes de regras/servidor, typecheck/build e cinco fluxos de navegador cobrindo privacidade entre quatro sessões, sinais, chat, cartas em leque e mão de 11.


## Treino em duplas com bots — 8 de novembro de 2026

Deployment dpl_EJDFAFes2XynK1tG2stK6DcCQwHe. Selecionar 2x2 e Treinar com bots preenche os três assentos restantes, com Bot parceiro em posição oposta. Os três bots jogam e aceitam revanche. A pessoa decide pedidos e mão de 11 da própria dupla. Bots enviam sinais somente à própria equipe; o parceiro confirma sinais humanos com Entendi uma vez por sinal. Estratégia recebe somente o estado autorizado de cada bot. Retirado da interface o histórico automático Conversa da mesa; chat mantido. Validação: 42 testes de regras/servidor, build/typecheck, partida completa simulada em duplas, privacidade dos sinais e fluxo real de treino 2x2 no navegador.


## Truco junto às cartas, votos por dupla e emojis públicos — 8 de novembro de 2026

Deployment dpl_13rSoP169Rwa2r1nPjB6ytVHpPbu. Botão de aumento ao lado direito do leque, com posição conferida no desktop e celular. No 2x2, aceitar ou contra-aumentar é suficiente; correr exige os dois parceiros, também na decisão da mão de 11. O primeiro voto em correr preserva o prazo e aguarda o parceiro. Identificadores de decisão permitem respostas concorrentes sem confundir mãos ou pedidos; respostas tardias de decisões resolvidas não são reaplicadas. Bot parceiro também vota após corrida humana. Sinais são exibidos a todos os participantes da sala, somente como emojis na interface; cartas continuam protegidas. Validação: 46 testes de regras/servidor, build/typecheck e sete fluxos de navegador, incluindo votos, sinais públicos e posição do botão.


## Sinais junto ao leque e vez acima da mesa — 8 de novembro de 2026

Deployment dpl_FU4kYWyQVTBDobzKkxV5SHJyoJ1X. Emojis movidos da lateral para uma barra abaixo das cartas, acessível em viewport de 390x844 sem rolar. Sinais visíveis por dois segundos, com a mesma duração no servidor e na interface. Confirmações dos bots são enfileiradas para preservar sinais recebidos durante a distribuição ou intervalo entre sinais. Vez e cronômetro centralizados acima da mesa; removidos da lateral. Validação: 46 testes de regras/servidor, build/typecheck e fluxos de navegador para 1x1/2x2, alinhamento, controles dentro da tela e sinais curtos entre quatro sessões.


## Respostas ao truco junto às cartas — 8 de novembro de 2026

Deployment dpl_Aqt3fGdny4YiDCoMs59zUNmFEvv4. Pedido persistente movido do feltro para o lado direito do leque, sem fundo cobrindo a mesa. Controles vermelhos para correr, verdes para aceitar e laranjas para contra-aumentar, com ícones e rótulos acessíveis. Botão de pedir truco redesenhado em laranja com relevo e ícone de mão. Mantidos o nome do solicitante, valor, prazo e espera pelo voto do parceiro. Validação: build/typecheck e três testes reais de navegador (1x1, 2x2 e votos), verificando posição ao lado das cartas e ausência de sobreposição da mesa em 390px.


## Respostas em linha e placar acima da mesa — 8 de novembro de 2026

Deployment dpl_ADLQgkNdSLiBn17BnqJgAwuYBf1C. Correr, aceitar e contra-aumentar alinhados horizontalmente, com a mesma altura. Em telas estreitas, a faixa fica junto ao leque, logo acima das cartas, preservando botões legíveis. Placar movido da lateral para um cabeçalho compacto acima do feltro, junto da vez e do cronômetro. Validação: build/typecheck e testes 1x1/2x2 com cliques reais, alinhamento horizontal dos três botões, cabeçalho centralizado e controles acessíveis em 390x844.


## Salas abertas e cabeçalho compacto — 8 de novembro de 2026

Deployment dpl_pkQZLSqG45QmnZCXXdAdSrQ36bW6. Lista de salas com vagas na página inicial, atualizada a cada cinco segundos; só salas explicitamente listadas, aguardando jogadores e com anfitrião ativo nos últimos 90 segundos. Resumo público contém somente código, apelido do anfitrião, modo e ocupação. Salas privadas existentes e treinos ficam fora da lista; checkbox permite criar por convite. Salas cheias ou iniciadas desaparecem. Cabeçalho compacto com código e convite no canto, placar e vez em linhas alinhadas. Removidos o texto de formação/manilhas, dica de toque e rodapé da partida. Validação: 47 testes de regras/servidor, build/typecheck, testes de listagem/entrada/privacidade e apresentação em 1x1/2x2; consulta Supabase validada.


## Desktop visual polish - 2026-11-08
- Adaptive desktop table height, compact card fan and signals, framed chat, improved felt and opponent cards.
- Desktop motion for card arrivals, turn highlight, bids and signals; reduced-motion preference preserved.
- Local build and four Playwright desktop/table checks passed.
- Production: https://truco-da-casa.vercel.app
- Deployment: dpl_GsMwUa7vidyZ4nYKQaMVWuKqG2sj (READY).

## ZIP identity adapted - 2026-11-08
- Imported only BrandMark/Brand from the supplied design package; retained current card rendering and rules.
- Added favicon, Apple touch icon, Open Graph image and accessible image description.
- Adapted surface borders, shadows and lettering to the existing layout.
- Preserved sounds, signals, inline bid responses, open-room placement and result/replay behavior.
- Build passed; five Playwright checks passed (open rooms, results/replay, sounds, 1x1 table, 2x2 table).
- Production deployment: dpl_E4DWMLc3hZqX6Jo3DN9YhmqDnzZX.

## House score steps and partner decisions - 2026-11-08
- Ordinary progression: 0, 3, 5, 7, 9, 11, then victory. Accepted truco progression: 0->5, 3->7, 5->11, 7->11, 9->victory. Higher bids advance additional score steps.
- The score remains within 0/3/5/7/9/11 even after victory. Existing invalid scores normalize to the nearest lower valid step (values above 11 clamp to 11).
- Only the side at eleven forfeits by raising, including counter-raises. Bots avoid this penalty and the other side can raise normally.
- No advance warning in the interface; after the error both teams receive outcome-specific playful messages.
- Partner decision bubbles show play/accept/run/raise for eight seconds, including after a decision settles; visible to their own team.
- Optional TRUCO_BUILD_DIR isolates local QA builds from simultaneous home-page work.
- Validation: 50 unit/integration checks, production build and six Playwright checks passed.
- Production deployment: dpl_7haVWJFUf6JjoMyvFhLhSXUR2i8m.

## Home room placement and hand actions - 2026-11-08
- Restored available rooms to the right of creation on desktop while preserving the new landing artwork and styling; stacked directly below creation on mobile.
- Moved voluntary run to a red button immediately to the right of Truco, with a compact mobile layout.
- Removed the empty chat greeting.
- Validation: build, three existing browser tests, desktop/mobile alignment checks and a real run command passed.
- Production deployment: dpl_2jhHv11WcSkxvMTvr2veBPKASGUN.

## Run payout and Seeeis label - 2026-11-08
- Running from a request, timing out a request, or voluntarily leaving a hand awards the ordinary 3-value step, regardless of previous accepted increases.
- Winning a played accepted hand still awards its accepted value to either side. Existing score-step progression remains intact.
- The 7-value raise is labeled Seeeis! in the hand action and counter-raise buttons; the internal value remains 7.
- Hid the chat field caption visually while retaining its accessible label.
- Validation: 51 unit/integration tests, three browser checks and production build passed.
- Production deployment: dpl_5ecfn6NdXNYKeHN7mSMccmk2JLxb.

## Card motion, decision announcements and mixed bot rooms - 2026-11-08
- Card distribution defaults on independently of OS reduced-motion; users can disable it in Regras da casa. Other reduced-motion handling stays in place.
- Truco and eleven accept/run decisions are announced publicly. A final run displays the message for 1800ms before new distribution; first-run partner votes remain private to their team until settled.
- Future hand start aligns the turn deadline, bot delay, shuffle audio and visual delivery after the notice.
- Emotes expire after 1000ms with a client expiration timer.
- Hosts can fill empty waiting seats with ready bots, preserving human seats and requiring all humans to be ready. Server authorization and existing bot privacy policies apply.
- Validation: 53 unit/integration tests, ten Playwright checks and a three-human/one-bot browser flow passed.
- Production deployment: dpl_A9eVkQ3zRUqUXM2h2Yv54B1MgDTP.

## Partner cards at their seat and rules review - 2026-11-08
- Authorized partner cards now replace the closed backs at the partner's seat during the existing eleven-hand visibility periods.
- Removed the separate partner-hand panel below the table. Server card permissions unchanged.
- Build and 1x1/2x2 eleven browser checks passed, including mobile width and partner-only card payloads.
- Complete implemented-rule and interaction review: docs/regras-para-revisao.md.
- Production deployment: dpl_2kK4PQNYNndza8KfvjHR8vAPEeb8.

## Perspective-based trick results and fixed eleven stake - 2026-11-08
- Added a three-row trick summary outside the felt. Green means the viewer's side won; red means the opponent won; draws and pending/unplayed tricks are neutral and text-labeled.
- Preserves the last hand summary, clearly labeled, until the new hand records its first result.
- Accept announcements now name Truco, Seeeis, Nooove or Onze instead of a generic increase.
- Accepted eleven hands stay at five. The side below eleven cannot raise; the eleven side retains the punitive Truco action.
- Validation: 54 unit/integration tests, browser decision notices, perspective/color checks in four sessions and both eleven formats passed. Build passed.
- Production deployment: dpl_DeSyKgwSwPc5fBLkPFbLU9DLHkvL.

## Reference-inspired room finish and compact top summary - 2026-11-08
- Moved trick results next to the scoreboard; compact stacked header on mobile remains above the felt and within the initial viewport.
- Applied reference-inspired dark felt, wood rim, gold trim, parchment panels, chat and action styling. Existing game functions retained.
- Moved eleven play/run selection into the hand request area with Jogar por 5 tentos and Correr e entregar 3 tentos.
- Replaced user-facing pontos/ponto wording with tentos/tento. Updated tests and review documentation.
- Illegal-eleven result uses a dedicated readable result panel without played cards competing with the message.
- Chat Enter submits; Shift+Enter retains a line break; composing text does not submit.
- Validation: 54 rules tests, build, desktop motion/layout, eleven privacy/actions, result overlap, per-team summary and multi-session chat checks passed.
- Production deployment: dpl_AjsJpkNjfkRB639Xr943oTPt2hD1.

## Compact room navigation - 2026-11-08
- Grouped sound, room-code chip and invite into one aligned header cluster.
- Abbreviated visible code without wrapping; click copies the complete code, available in the tooltip.
- Simplified invite styling and added a people icon with compact mobile text.
- Validation: build, viewport alignment at 320/360/390/768/1366 and clipboard code/invite flows passed.
- Production deployment: dpl_7KffS14etvAkBGMJcixCLefbxg2b.

## Domino 2x2 release - 2026-11-08
- Added the Dominó button and stone icon to the home navigation, linking to /domino.
- Implemented the selected duplo-seis rules: four players, opposite partners, seven stones each, no purchase, first opening 6–6, rotating later starter, two-ended placement, legal-only passes, batida/tranca and a 100-point target.
- Added private server views, persistent anonymous sessions, CAS/idempotency, public/private rooms, invite entry, bots, host filling, chat, timers, abandonment and unanimous replay.
- Reused private Supabase storage with an explicit game discriminator. Truco APIs/lists and domino APIs/lists reject/filter the other game's rooms. No access-policy changes.
- Validation: 62 unit/integration checks; full match and replay in four independent browser sessions; practice/mobile entry; existing Truco open-room regression. Public Supabase practice/create/read test passed after deploy.
- Rules and defaults: docs/domino.md.
- Production: https://truco-da-casa.vercel.app/domino
- Deployment: dpl_EFT86KhLRuYivHy3v5kn8zjDyvE4 (READY).


## Truco: lobby, espectadores e regras da casa — 2026-11-09
- Publicado: https://truco-da-casa.vercel.app
- Deployment: dpl_AME9VnoViwHB76KtSHezwx8PcNW7 (READY).
- Pronto centralizado na mesa, estado de cada participante, destaque Sua vez e resultado sem placar final artificial.
- Tema clássico preservado; opção de mesa de bar amarela Skol ao criar.
- Espectadores com chat e estado público, entrada em mesa cheia, troca para assento livre somente no lobby. Saída, transferência do anfitrião e remoção restrita ao anfitrião no lobby.
- Corrida normal no 2x2 exige confirmação do parceiro; Jogar ou silêncio mantém a mão. Recusas de aumento pagam o valor já aceito (3/5/7/9); após aceite, corrida paga o valor aceito.
- Capar disponível apenas durante a decisão em 11 a 3; um parceiro da equipe com 3 força o jogo por 5.
- Testes confirmam 3 + 7 = 9, 7 + 5 = 11, 7 + 7 vence, 9 + 5 vence; mão de 11 a partir de 0 chega a 11 e a partir de 3/5/7/9 vence.
- Tentos manuais adiados a pedido do usuário; nenhuma opção manual publicada.
- Validação: 68 testes de motor/API/segurança, tipagem e build; navegador em sessões independentes, celular e PC, consensos, capar, privacidade, bots e resultado. Verificação pública com Supabase: tema, espectador sem cartas, troca de lugar no lobby, saída e transferência do anfitrião.


## Tutorial e modo personalizado — 2026-11-09
- Production: https://truco-da-casa.vercel.app
- Deployment: dpl_FwXka2pqMCzp7jXjLpsoXfzxYiPG (READY).
- Tutorial: 16 capítulos, comparador de cartas abertas/encobertas, simuladores de tentos e empates, demonstração de mão, 12 casos guiados e 13 exercícios. Consulta em diálogo na sala sem enviar jogadas ou interromper os prazos.
- Força, baralho, pontuação e resolução de mãos compartilhados entre motor e tutorial, preservando o comportamento existente.
- /admin: login privado, fotos das 40 cartas, 11 eventos de áudio, prévias, nome/disponibilidade do modo e publicação de configurações para novas salas.
- Modo personalizado separado do normal; escolha de tentos normais/manuais na criação. Arquivos privados no Supabase, acesso autorizado por sala e cópia imutável da configuração por sala.
- Manual: puxar/devolver em qualquer fase, animação pública, mão de 11/capar pelo placar e encerramento somente com unanimidade dos jogadores. Comandos concorrentes protegidos por idempotência, CAS e identificador da partida.
- Acesso administrativo inicial guardado somente no arquivo local ignorado .data/admin-access.txt; servidor publicado usa hash scrypt e sessão assinada. Variáveis privadas configuradas na Vercel; nenhum segredo enviado ao GitHub.
- Validação: 75 testes de motor/API/segurança; tipagem e build; navegador no celular/PC para tutorial, som, modo normal, criação personalizada, upload e sigilo, snapshots, animação em sessões independentes e votação. Conferência pública passou para login, upload privado/Supabase, configuração persistida, sala manual com bot e unanimidade.
- GitHub: Rodrigosx7/JogosOnline, main; tutorial 5f7a9da e personalizado 0fb3f1f. Publicação feita pela Vercel CLI.


## Alteração de senha administrativa — 2026-11-09
- Deployment dpl_5Cbzz6Vi9XpzTEPWq2w7SFctZuDm, READY, https://truco-da-casa.vercel.app/admin.
- Adicionada seção Alterar senha: senha atual, nova senha/frase de 10 a 128 caracteres, confirmação e opção de mostrar a nova senha.
- Hash scrypt persistido em objeto privado do Supabase; a versão da sessão muda para invalidar sessões antigas, mantendo renovada somente a que fez a alteração. Login inicial por ambiente preservado até a primeira troca.
- Verificação: 76 testes de motor/API/segurança, tipagem/build e teste de navegador local alterando/restaurando a senha, rejeitando a antiga e revogando outra sessão. Conferência publicada confirmou login atual e formulário; nenhuma senha de produção foi alterada durante a verificação.
- Código: 4729ad9, enviado ao GitHub.

## Sinuca Bola 8 — 2026-11-10
- Produção: https://truco-da-casa.vercel.app/sinuca; deployment dpl_DdD1DeYfJ5Z2sGbMyfiFvrSjkUzV, READY.
- Código 0e425b5 enviado ao GitHub, main. Modalidades 1x1 e 2x2, parceiros alternando tacadas, treino e preenchimento com bots, salas abertas/convite, espectadores, chat e revanche unânime.
- Mesa 2D responsiva, mira, força, efeitos aproximados, posicionamento da branca, caçapa da preta marcada, sons e botão de silenciar. Física e decisão das jogadas no servidor; reprodução sincronizada para todos.
- Regras casuais próprias de Bola 8 documentadas em docs/sinuca.md; sem alteração das regras de Truco ou Dominó.
- Validação: 88 testes de regras/física/servidor, tipagem/build, sete testes de navegador para sinuca/dominó/truco e conferência de salas abertas. Partida completa de bots finalizada em 21 tacadas.
- Conferência publicada com duas sessões independentes: criação privada, entrada, prontidão, saída, reprodução idêntica com 107 quadros e posições finais iguais após a primeira tacada; persistência real no Supabase.
