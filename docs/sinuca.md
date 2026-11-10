# Sinuca da casa — Bola 8

## Escopo

Disponível em `/sinuca`, no mesmo site do truco e do dominó. O usuário escolheu Bola 8 semelhante a 8 Ball Pool, em 1x1 e duplas 2x2. A pesquisa anexada descreve outras modalidades e motores comerciais; esta entrega aproveita o navegador e a infraestrutura existente.

## Regras publicadas

- Branca mais 15 bolas. Lisas 1–7, listradas 9–15, preta 8.
- Saída sorteada. A branca pode ser reposicionada atrás da linha de saída; para abrir legalmente é preciso encaçapar bola de objeto ou levar quatro bolas de objeto distintas às tabelas.
- Mesa aberta depois da saída. Primeiro encaçapamento legal posterior define o grupo. Se houver mistura, a primeira bola que caiu determina o grupo. Nenhum grupo é atribuído em tacada com falta.
- A bola 8 na saída é recolocada em lugar livre, mesmo com falta; não há vitória instantânea. Outras bolas encaçapadas permanecem fora.
- Fora da saída, primeiro contato deve ser com bola própria, ou com a 8 se o grupo já estava limpo. Em mesa aberta, pode tocar qualquer grupo, mas não a 8 enquanto nenhum grupo estiver completamente limpo.
- Falta por branca encaçapada, nenhum contato, primeiro contato ilegal ou nenhuma bola de objeto encaçapada/tabela após o contato. O adversário recebe branca na mão em qualquer ponto livre, inclusive na falta de saída.
- Uma bola própria encaçapada legalmente mantém a equipe. Bola adversária que caiu permanece fora, mas não mantém a vez sozinha.
- Sem chamada para bolas comuns; a caçapa da preta precisa ser marcada antes da tacada. Só pode ganhar na preta se o grupo já estava totalmente limpo antes da tacada. Preta antecipada, em caçapa errada ou acompanhada de falta perde.
- No 1x1, quem encaçapa continua. No 2x2, os parceiros ficam opostos e alternam em toda tacada, mesmo se a dupla continuar. Ao passar a vez, entra o próximo jogador da outra equipe.
- Relógio de 45 segundos; timeout é falta e branca na mão para o outro lado. Posicionar a branca não reinicia o prazo. Ausência contínua de 120 segundos perde por abandono, resolvida cronologicamente; se ambos os lados atingirem juntos, cancela.
- Revanche precisa da confirmação de todos os jogadores. Bots acompanham o voto humano. O próximo abridor avança um assento.

## Salas e controles

Criar sala pública/privada ou treino com bots. Entrada por lista, link ou código e apelido. Prontidão de cada jogador no lobby, ocupação de vagas, completar com bots, mudança para espectador e remoção pelo anfitrião somente antes de começar. Espectadores assistem e conversam; não tacam nem votam revanche. Jogadores podem sair antes/depois da partida; espectadores também durante.

Na mesa: arrastar para mirar, slider e botões para ajuste fino, força de 5% a 100%, seletor de efeito na branca, branca na mão com arrasto ou sliders, confirmação de posição e seleção da caçapa da 8. Números de caçapas permanecem legíveis com a câmera girada no celular. Som de taco, bolas, tabela e caçapa, com silêncio persistido no navegador. Chat reutiliza Enter para enviar.

## Implementação

- `src/lib/pool/physics.ts`: passo fixo de 240 Hz e busca contínua do primeiro contato dentro de cada passo para bolas, segmentos de tabela, bocas arredondadas e caçapas. Atrito/restituição/efeito aproximados; resultados limitados ao campo 2D. Replay amostrado com posições adicionais nos contatos.
- `rules.ts`: adjudicação independente da física e da interface.
- `game.ts`: fases de lobby, tacada em movimento, resolução, próximos jogadores, prazos, privacidade de sessões e terminais.
- `bot.ts`: gera candidatas geométricas e verifica as melhores na mesma física/regras do servidor. Não tem precisão ou física diferentes dos humanos.
- `src/lib/server/pool-rooms.ts` e `/api/sinuca/rooms`: sessão anônima existente, validação dos parâmetros, revisões, idempotência e CAS. O cliente só envia mira/força/efeito/caçapa/posição permitida, nunca resultado ou posições finais.
- Canvas interpola o replay autoritativo usando tempo do servidor. Reabrir no meio de uma tacada retoma o ponto atual. Polling com revisão conhecida evita baixar o replay inteiro quando nada mudou.
- Mesmo armazenamento privado do Supabase, discriminador `game: pool` e guardas para impedir acesso/listagem cruzada em truco/dominó. Sem mudanças de RLS ou novo schema.

## Limites

Física própria 2D para diversão entre amigos; efeitos aproximados. Não há salto/massé, câmera 3D, dinheiro, moedas, ranking, torneios ou tacos com vantagens. A versão usa defaults casuais e não se apresenta como cópia integral de Miniclip ou de um regulamento oficial. Todos os gráficos e sons são gerados pelo próprio site.

## Referências

- Miniclip — branca na mão e efeitos: https://support.miniclip.com/hc/en-us/articles/203747476-How-to-Move-the-Cue-Ball-8-Ball-Pool
- WPA — seção 4, Bola 8: https://www.wpapool.com/wp-content/uploads/2026/01/2026.01.02-WPA-Rules.pdf

As diferenças desta versão incluem não chamar bolas comuns, reposicionar automaticamente a 8 na saída e dar branca na mão em qualquer ponto na falta de saída.
