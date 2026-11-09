# Dominó da casa — primeira versão

Modalidade escolhida: duplas 2x2, duplo-seis, 28 pedras, sete para cada pessoa, sem compra, partida até 100 pontos. Regulamento registrado na sala como `duplas-100-v1`.

## Regras da sala

- Os parceiros ocupam lugares opostos. A ordem segue os assentos.
- A primeira mão começa com quem recebeu o 6–6, que deve jogar essa pedra.
- Nas mãos seguintes, a saída avança um assento e pode usar qualquer pedra.
- Cada pedra precisa encaixar numa das duas pontas. Quando encaixa nas duas, o jogador escolhe a extremidade.
- Passar só é permitido se não houver encaixe em nenhuma ponta.
- A batida termina a mão quando alguém joga sua última pedra. Sua dupla recebe somente a soma das pedras restantes dos adversários.
- Quatro passes consecutivos encerram a mão por tranca. Vence a menor soma conjunta das mãos da dupla, recebendo a soma adversária. Empate não dá pontos.
- A primeira dupla a alcançar ou ultrapassar 100 vence. Há quatro segundos entre as mãos.
- A jogada tem 30 segundos. Ao expirar, o servidor joga uma pedra válida; se não houver encaixe, passa.
- Ausência contínua de 90 segundos causa derrota da equipe; ausência simultânea dos dois lados cancela a partida.

Essas opções de saída, tranca e contagem foram adotadas como os padrões anunciados para esta versão. O dossiê fornecido contém variantes distintas; elas não estão misturadas neste regulamento.

## Interface e salas

- A página de truco oferece o botão Dominó com ícone de pedras.
- `/domino` permite criar uma sala, entrar por código/link, consultar as salas abertas e treinar com bots.
- Todos os humanos confirmam Estou pronto. O anfitrião pode preencher lugares vazios com bots já prontos.
- Clicar numa pedra válida a joga se houver uma única opção. Caso haja duas, aparecem as escolhas Esquerda e Direita.
- A mesa mostra a sequência orientada das pedras, os valores das pontas, o jogador da vez e a quantidade de pedras de cada participante.
- Chat público com envio por Enter. Não há sinais privados nem visualização das pedras do parceiro.
- Todos precisam concordar com a revanche. Os bots concordam após um pedido humano.

## Implementação e segurança

- Motor independente em `src/lib/domino.ts`; API em `/api/domino/rooms`.
- O servidor embaralha com aleatoriedade criptográfica, valida as jogadas e gera uma visão contendo somente a mão do solicitante.
- A sessão anônima, persistência privada e gravação com comparação de versão reutilizam a infraestrutura existente do Supabase.
- O campo `game: domino` identifica o jogo. As APIs e listas dos dois jogos rejeitam/filtram salas da outra modalidade.
- Comandos têm identificador de idempotência e revisão. Atualizar a página recupera a mesma participação.
- Não foram alteradas políticas de acesso do banco nem liberada leitura direta de documentos privados.
- Os bots escolhem apenas entre encaixes válidos da própria mão. A estratégia inicial prioriza descartar pedras mais pesadas.

## Validação

- Testes de conjunto, saída, encaixe/orientação, passe ilegal, batida, tranca/empate, meta, privacidade, bots, revanche e abandono.
- Testes de isolamento entre truco e dominó, autorização de acesso e idempotência.
- Partida completa com quatro sessões independentes e comparação do resultado final.
- Navegação pelo novo botão, treino com bots e layout em computador e celular.
