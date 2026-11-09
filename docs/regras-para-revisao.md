# Truco da casa — regras e reações implementadas

Revisão do código de 8 de novembro de 2026. Este documento descreve o comportamento atual do site, incluindo os tentos que merecem confirmação. A pontuação é a regra da casa combinada nesta conversa.

## Sala, formação e início

- Há 1x1 e 2x2. Em duplas, os parceiros ficam em posições opostas.
- A pessoa entra com apelido. Pode abrir uma sala, entrar pelo convite/código ou escolher uma sala aberta na página inicial.
- Salas marcadas como públicas aparecem enquanto aguardam jogadores, têm vagas e o anfitrião está ativo. Salas privadas dependem do convite.
- Antes da partida, **Sentar aqui** permite trocar para um lugar vazio. Trocar de lugar desfaz a prontidão daquele jogador.
- **Estou pronto** confirma a participação. Depois do clique, aparece **Você está pronto ✓**, desativado. A interface não oferece um botão para desmarcar.
- A partida começa com exatamente dois ou quatro participantes e todos prontos. Os assentos e a modalidade ficam fixos durante o jogo.
- **Completar com bots** aparece para o anfitrião enquanto houver lugares livres. Preenche somente os lugares vazios. Os bots já entram prontos; os humanos continuam precisando confirmar.
- Se todos os humanos já estiverem prontos, completar os lugares com bots pode iniciar imediatamente a partida.
- Há treino individual e treino em duplas. No treino em duplas, uma pessoa joga com três bots.
- Atualmente não há botão para remover um bot, expulsar alguém ou substituir um participante durante a partida.

## Baralho, força e ordem

O baralho tem 40 cartas: 4, 5, 6, 7, Q, J, K, A, 2 e 3 nos quatro naipes. Não há 8, 9, 10 ou coringas.

Cada jogador recebe três cartas, sem repetição. O baralho completo é embaralhado novamente em cada mão. Não existe vira.

As manilhas, da maior para a menor, são:

1. **4♣ — Zap**.
2. **7♥ — Copeta**.
3. **A♠ — Espadilha**.
4. **7♦ — Pica-fumo**.

Todas vencem qualquer carta comum. Entre as cartas comuns: **3 > 2 > A > K > J > Q > 7 > 6 > 5 > 4**. Cartas comuns de mesmo valor empatam, independentemente do naipe.

O primeiro distribuidor é sorteado. O jogador seguinte na ordem dos assentos começa. O distribuidor avança um assento em cada nova mão, inclusive depois de empate geral.

Uma **vaza** termina quando todos jogam uma carta. Uma **mão** tem até três vazas. Os tentos são definidos pelo resultado da mão.

## Pontuação completa

O placar começa em 0 e depois utiliza somente **3, 5, 7, 9 e 11**. O valor da mão determina quantas etapas avançam; não é uma soma comum.

| Placar antes | Mão de 3 | Truco aceito, mão de 5 | Mão de 7, chamada “Seeeis!” | Mão de 9 | Mão de 11 |
|---|---|---|---|---|---|
| 0 | 3 | 5 | 7 | 9 | 11 |
| 3 | 5 | 7 | 9 | 11 | Vitória |
| 5 | 7 | 11 | 11 | Vitória | Vitória |
| 7 | 9 | 11 | Vitória | Vitória | Vitória |
| 9 | 11 | Vitória | Vitória | Vitória | Vitória |
| 11 | Vitória | Vitória | Vitória | Vitória | Vitória |

**Vitória** encerra a partida e mantém 11 no placar. Não aparecem 12, 14 ou 16.

Há uma regra específica: ganhar um truco de 5 quando já se tem 5 leva diretamente a 11.

Se alguém **correr de um pedido**, o adversário recebe o valor já estabelecido: pedir 5 e recusar entrega 3; pedir 7 e recusar entrega 5; pedir 9 e recusar entrega 7; pedir 11 e recusar entrega 9. O prazo de resposta usa a mesma regra. Depois de aceitar, correr durante a mão entrega o valor aceito. No 2x2, o botão Correr abre uma consulta ao parceiro: ambos precisam correr; se o parceiro escolher Jogar ou não responder em 30 segundos, a mão continua com novo prazo.

Exemplos: um adversário em 0 vai para 3; em 3 vai para 5; em 9 vai para 11. Portanto, ver o placar chegar a 5 depois de uma corrida pode estar correto quando ele já estava em 3.

Se o truco for aceito e a mão for disputada até ter vencedor, **qualquer um dos lados** recebe o avanço do valor aceito. Quem pediu não tem vantagem na pontuação.

## Jogadas e resultado das vazas

Na sua vez, clicar numa carta já a joga. Não existe confirmação adicional. Fora da sua vez, as cartas ficam sem ação.

Na primeira vaza, todas as cartas são abertas. Na segunda e terceira, pode marcar **Jogar encoberta** e clicar numa carta. Ela é consumida, fica fechada e perde para qualquer carta aberta. Sua identidade não é revelada depois.

Se todas as cartas forem encobertas, a vaza empata. Não há obrigação de jogar a maior carta depois de um empate.

- A maior carta de um único lado vence a vaza.
- Cartas máximas iguais de adversários empatam.
- Duas cartas máximas iguais da mesma dupla não empatam entre si. Se um adversário também tiver esse valor máximo, haverá empate.
- Quem jogou a carta vencedora começa a próxima vaza.
- Se dois parceiros tiverem o mesmo máximo vencedor, começa quem jogou primeiro.
- Depois de empate, começa quem iniciou a vaza empatada.

| Resultado das vazas | Resultado da mão |
|---|---|
| A ganha as duas primeiras | A ganha |
| Primeira empata; A ganha a segunda | A ganha |
| A ganha a primeira; segunda empata | A ganha |
| A ganha a primeira; B ganha a segunda; A ganha a terceira | A ganha |
| A ganha a primeira; B ganha a segunda; B ganha a terceira | B ganha |
| A ganha a primeira; B ganha a segunda; terceira empata | A ganha pela primeira |
| Duas primeiras empatam; A ganha a terceira | A ganha |
| As três empatam | Ninguém pontua; nova mão |

Os mesmos resultados valem trocando A por B.

As cartas são mostradas junto à posição de quem jogou. Permanecem até todos jogarem e por mais **2,5 segundos** para conferência. Depois são recolhidas. A mesa mostra somente a vaza atual, sem os quadrados das vazas antigas.

## Truco, aumentos e botões

A sequência interna é **3 → 5 → 7 → 9 → 11**, sem pular níveis. O nível 7 aparece no botão como **Seeeis!**. O pedido não soma tentos imediatamente.

Pode pedir aumento na própria vez, antes de jogar a carta. O primeiro pedido pode partir de qualquer lado. Depois de um aceite, somente o lado que recebeu o último aumento pode aumentar novamente; os lados alternam.

| Situação | O que pode apertar | O que acontece ou aparece |
|---|---|---|
| Sua vez, mão comum | Carta, TRUCO!, Correr | Carta é jogada; truco abre pedido de 5; no 1x1 correr encerra; no 2x2 consulta o parceiro |
| Sua vez após receber e aceitar truco | Carta, Seeeis!, Correr | Pode propor 7; correr entrega o valor aceito, após concordância do parceiro no 2x2 |
| Próximos níveis permitidos | 9+ ou 11+ | Propõe o próximo nível |
| Sua equipe fez o último aumento aceito | Carta ou Correr | Não pode aumentar novamente até o outro lado aumentar |
| Não é sua vez | Chat e, no 2x2, emotes | Cartas não podem ser jogadas; não pode pedir aumento |
| Adversário pede truco | Correr, Aceitar, Seeeis! | As jogadas param; os três botões aparecem lado a lado perto das cartas |
| Adversário pede 7 | Correr, Aceitar, 9+ | Mesmo funcionamento, com o próximo aumento disponível |
| Adversário pede 9 | Correr, Aceitar, 11+ | Mesmo funcionamento |
| Adversário pede 11 | Correr ou Aceitar | Não existe aumento além de 11 |
| Sua equipe pediu e aguarda resposta | Aguardar, chat e emotes | Aparece que a outra equipe está respondendo |
| Todos já jogaram a vaza | Aguardar, chat e emotes | Aparece “Conferindo a vaza…”; as ações de jogo ficam bloqueadas |
| Distribuição em andamento | Aguardar | Cartas e ações de jogo ficam bloqueadas; emotes também |

**Aceitar** estabelece o valor proposto. A vez volta para quem foi interrompido pelo pedido, com novos 30 segundos.

**Aumentar** aceita implicitamente o pedido anterior e oferece o próximo nível. O outro lado passa a responder.

**Correr** encerra a mão quando a decisão da equipe estiver completa. O solicitante recebe somente a etapa comum de 3.

Quando a decisão se encerra, todos veem **Aceitou o truco!**, **Aceitou o aumento!** ou **Correu do pedido!**. Os avisos duram aproximadamente **1,8 segundo**. Depois de corrida, o aviso aparece antes da nova distribuição.

O pedido informa o nome de quem chamou, o valor proposto e o tempo restante. Os botões ficam perto das cartas, sem escurecer a mesa inteira. A decisão inicial da mão de 11 também fica nesse local, com Jogar por 5 tentos e Correr e entregar 3 tentos.

## Decisões em duplas

Estas regras valem tanto para responder a um pedido quanto para decidir jogar a mão de 11:

| Primeiro jogador | Parceiro | Resultado |
|---|---|---|
| Aceita/joga | Ainda não respondeu | A equipe aceita imediatamente |
| Aumenta o pedido | Ainda não respondeu | O aumento vale pela equipe |
| Corre | Ainda não respondeu | Aguarda o parceiro; não entrega tentos ainda |
| Corre | Também corre | A equipe corre |
| Corre | Aceita/joga | A equipe continua |
| Corre | Aumenta, em resposta a pedido | A equipe continua com o aumento |
| Corre | Não responde até acabar o tempo | A equipe corre |

Quem já votou em correr fica aguardando e não pode trocar seu voto naquele pedido. O parceiro ainda pode aceitar ou aumentar.

Junto ao parceiro aparece **“nome: correu”**, **“nome: foi!”** ou **“nome: aumentou”**, por até oito segundos, visível à própria dupla. A decisão final de aceite/corrida aparece para todos.

**Diferença atual:** o botão Correr durante uma vez normal, sem pedido pendente, encerra a mão imediatamente. Ele não consulta o parceiro. A votação dos dois existe nas respostas a pedidos e na decisão inicial da mão de 11.

## Mão de 11

Quando somente uma equipe chega a 11, a próxima mão começa com uma decisão antes de qualquer carta ser jogada.

- A equipe com 11 pode apertar **Jogar por 5 tentos** ou **Correr e entregar 3 tentos**.
- No 2x2, basta um parceiro aceitar; para correr, os dois precisam correr.
- O outro lado aguarda a decisão e não joga cartas nesse período.
- Durante a decisão, somente os participantes da dupla com 11 podem ver as cartas do próprio parceiro. Elas aparecem abertas na posição dele, no topo da mesa. As cartas da dupla adversária continuam fechadas.
- A dupla que ainda não está com 11 não recebe as cartas do próprio parceiro. Em 11 a 11, ambas podem ver as cartas do próprio parceiro durante a primeira vaza.
- Se a equipe aceitar, aparece **Aceitou jogar a mão de 11!**, a mão passa a valer 5 e o jogo começa. As cartas do parceiro voltam a ficar ocultas.
- Se correr, aparece **Correu da mão de 11!**, o outro lado avança uma etapa comum e novas cartas são dadas depois do aviso.
- Se não houver resposta em 30 segundos, conta como corrida.
- Aceitar não obriga a jogar até o fim: fora do 11 a 11, o botão Correr continua disponível na própria vez e entrega a etapa comum.

A mão de 11 aceita fica fixa em 5. A equipe abaixo de 11 não pode pedir Truco, Seeeis, nove ou onze nessa mão.

Se **a equipe com 11 pedir truco ou contra-aumentar**, perde a partida imediatamente. O botão permanece disponível e não há aviso antecipado dessa consequência.

Depois do erro:

- Quem perdeu vê **“Trucou de 11? Entregou a paçoca!”**.
- Quem apertou vê também **“O grito foi bonito. O momento, nem tanto. Essa partida ficou para o outro lado!”**.
- O parceiro de quem apertou recebe uma mensagem dizendo que a dupla foi junto.
- Quem ganhou vê **“Vitória de presente!”**, com o nome de quem trucou.

A equipe abaixo de 11 não tem botão de aumento na mão de 11. A equipe com 11 continua com o botão Truco, que provoca derrota imediata se for apertado.

## Quando está 11 a 11

- Os dois lados são obrigados a jogar. Não há decisão inicial de aceitar/correr.
- A mão começa valendo 5.
- Não há botão Correr.
- Quem vencer a mão vence a partida. O placar permanece 11 a 11 e a tela indica qual lado ganhou.
- Se as três vazas empatarem, ninguém ganha; distribui outra mão obrigatória.
- No 2x2, cada dupla vê as cartas restantes do próprio parceiro durante a primeira vaza. Na segunda e terceira, essa visão some.
- O botão Truco continua disponível na própria vez. Qualquer lado que apertar perde imediatamente, porque ambos estão com 11.

Vitória por truco indevido ou abandono pode acontecer com o vencedor abaixo de 11; nesses casos, o jogo não aumenta artificialmente o seu placar.

## Tempo, atualização e desconexão

- Cada jogada e cada resposta de pedido têm prazo de 30 segundos.
- Se acabar a vez, o servidor joga a menor carta disponível, aberta. Cartas de mesma força são escolhidas por uma ordem fixa de identificadores.
- Se acabar o prazo de um pedido, a equipe solicitada corre e o adversário recebe a etapa comum de 3.
- O primeiro voto de corrida da dupla não reinicia o prazo. Um aceite reinicia a vez de jogar com 30 segundos.
- A animação de distribuição dura cerca de 3,3 segundos e utiliza parte do prazo inicial da jogada. O contador fica oculto durante a animação.
- Depois de uma corrida anunciada, há uma pausa de 1,8 segundo antes da nova distribuição; essa pausa é considerada no início do novo prazo.
- Recarregar ou reconectar recupera o lugar e o estado pela sessão do navegador. Não reinicia o prazo.
- Uma aba aberta em segundo plano continua consultando a sala. Não conta automaticamente como abandono.
- Ausência contínua por 90 segundos causa derrota do lado daquele jogador. Bots não perdem por ausência.
- Se os dois lados atingirem o abandono simultaneamente, a partida é cancelada. Se um atingiu antes, esse lado já perdeu.
- Sem conexão, aparece **“Reconectando à mesa…”**. Jogadas inválidas ou com estado desatualizado mostram uma mensagem de erro; elas não são aplicadas duas vezes.

## Emotes, chat, som e animação

No 2x2, os emotes ficam perto das cartas e são visíveis para **todos** da mesa. Aparecem por cerca de um segundo, com intervalo mínimo de dois segundos entre envios.

Os sete botões são: 😉 Zap, 😏 Copeta, 😛 Espadilha, 😗 Pica-fumo, 💪 carta forte, 🤏 sem jogo e 👍 entendido. Na tela aparecem somente os emojis. Eles não expõem as cartas nem alteram suas forças.

O chat é da sala inteira. Enter envia a mensagem; Shift + Enter insere uma quebra de linha no campo. Aceita até 240 caracteres por mensagem e exige intervalo mínimo de um segundo entre envios. **Enviar** fica desativado com texto vazio. Não aparecem mais as frases de instrução que você pediu para retirar.

Há som ao embaralhar, distribuir, jogar e pedir aumento. O botão de alto-falante liga/desliga e salva a preferência no navegador. O áudio depende do primeiro clique/toque autorizado pelo navegador e não inclui voz gritando truco.

A distribuição fica ligada por padrão no PC e no celular. Pode desligar **Animar distribuição de cartas** em Regras da casa; a preferência também fica salva. As outras animações respeitam a configuração de movimento reduzido do sistema.

## Comportamento dos bots

- Jogam com suas próprias cartas e com as informações que um participante humano receberia; não consultam cartas secretas adversárias.
- Levam aproximadamente 0,9 segundo para agir, depois do período inicial de distribuição.
- Podem jogar, aceitar, correr e aumentar. Evitam pedir aumento quando sua equipe tem 11.
- Na mão de 11, aceitam se tiverem manilha ou pelo menos duas cartas fortes; caso contrário, tendem a correr.
- Em duplas com parceiro humano, aguardam primeiro a resposta dele. Se o humano votar em correr, o bot também decide e pode aceitar ou correr.
- Enviam sinais a partir das próprias cartas e podem responder com 👍 ao sinal do parceiro.
- Procuram poupar cartas quando o parceiro já está ganhando a vaza e consideram o sinal de jogo fraco do parceiro.
- Concordam com uma nova partida depois que um humano pede. Os outros humanos também precisam concordar.

## Fim da partida

- O vencedor vê **Jogar novamente**; o perdedor vê **Pedir revanche**.
- Depois do clique, aparecem respectivamente **Pronto para jogar ✓** e **Revanche pedida ✓**. O botão fica desativado para evitar repetição.
- A tela informa quantos participantes aceitaram. A partida só reinicia quando todos concordarem; os bots concordam automaticamente após um pedido humano.
- A nova partida zera os placares e mantém os participantes e as duplas.
- Na tela de cancelamento, a interface oferece **Voltar ao início**.

## Pontos para sua revisão

1. A tabela completa de pontuação, principalmente os aumentos de 7, 9 e 11.
2. Corrida sempre entregar a etapa comum, inclusive após aceitar aumentos.
3. O botão Correr fora de pedido encerrar a mão sem voto do parceiro.
4. A visão do parceiro é exclusiva da dupla com 11; em 11 a 11, vale para ambas.
5. A mão de 11 aceita tem valor fixo de 5, sem aumentos.
6. Em 11 a 11, ver o parceiro somente na primeira vaza.
7. O prazo inicial incluir o tempo da distribuição.
8. As cartas jogadas serem recolhidas por vaza, em vez de permanecerem até o fim da mão.

O resumo das três vazas fica fora do feltro. Verde indica vitória do próprio lado; vermelho, vitória adversária; amarelo, empate; neutro, aguardando ou não disputada. Ao iniciar outra mão, o resumo anterior permanece identificado até a primeira vaza da nova mão ser resolvida.

O resumo das vazas agora fica no topo, junto ao placar, em formato compacto no celular. O visual da sala usa feltro escuro, bordas de madeira e acabamentos claros com dourado. O resultado de truco indevido fica em painel separado e não exibe as cartas sobre a explicação.


## Atualização de salas, lobby e capar — 09/11/2026

- Ao criar, o anfitrião escolhe a mesa clássica ou a mesa de bar amarela Skol. Todos recebem o mesmo tema.
- O botão Estou pronto fica no centro da mesa; a lista mostra quem está pronto e quem falta. Pode clicar novamente para retirar a prontidão.
- O aviso Sua vez aparece junto das cartas e o indicador superior recebe destaque.
- Espectadores entram pelo convite usando Assistir à mesa, inclusive com a mesa cheia ou a partida iniciada. Veem somente cartas jogadas, contagens, chat e sinais públicos; nunca recebem mãos fechadas ou cartas do parceiro.
- Antes de começar, um jogador pode ir para espectador; um espectador pode ocupar um lugar vazio. A prontidão é reiniciada para esse participante.
- Só o anfitrião remove pessoas, e somente no lobby. A pessoa removida não pode voltar àquela sala usando a mesma sessão. Ao sair, o anfitrião transfere a função para outro participante.
- Sair da sala fica disponível no lobby e ao fim da partida; espectadores também podem sair durante o jogo. Jogadores não trocam de função nem são removidos durante a partida.
- Em 11 a 3, durante a decisão inicial, qualquer parceiro da equipe com 3 pode Capar: inicia jogo obrigatório por 5 tentos. Essa opção não aparece em outros placares nem depois de resolvida a decisão.
- Ganhar uma mão de 11 saindo de 0 chega a 11; saindo de 3, 5, 7 ou 9 vence a partida. Ganhar 7 saindo de 3 chega a 9; ganhar 5 saindo de 7 chega a 11; ganhar 5 saindo de 9 vence.
- O fim da partida informa vitória ou derrota e não exibe um placar final limitado artificialmente a 11 a 11.
- Tentos manuais foram adiados a pedido do usuário; pontuação segue automática.
