# Truco da casa

Jogo de truco mineiro para amigos: 1x1 e 2x2, baralho de 40 cartas, manilhas fixas e mãos de **3 → 5 → 7 → 9 → 11** tentos. Sem truco, o placar segue 0 → 3 → 5 → 7 → 9 → 11 → vitória. Com truco: 0 → 5, 3 → 7, 5 → 11, 7 → 11, 9 → vitória. O placar nunca ultrapassa 11; o vencedor é registrado separadamente.

Na mão de 11, confira as cartas do parceiro e escolha jogar por 5 ou correr e entregar 3. No 11 a 11, ambos são obrigados a jogar por 5 tentos, sem correr. Um aceite basta; só corre se todos da equipe correrem; prazo de 30 segundos, sem resposta corre. Pedir truco na mão de 11 perde a partida.

Publicado: https://truco-da-casa.vercel.app

Produ��o com Supabase validada; detalhes em `docs/deployment.md`.

## Rodar no computador

Requer Node.js 22 ou mais recente.

```sh
npm install
npm run dev
```

Abra http://localhost:3000. Crie uma sala e copie o convite. Para testar sozinho, abra o convite em perfis/janelas anônimas independentes: abas normais do mesmo perfil compartilham a mesma identidade.

No celular conectado à mesma rede, use o endereço IP do computador e a porta 3000. O servidor precisa estar acessível pela rede e pelo firewall. Links de localhost funcionam apenas no mesmo aparelho.

O desenvolvimento funciona sem contas externas: o servidor salva salas em `.data/rooms`, com identidades locais protegidas. Esse adaptador exige um único processo e disco persistente. Não é adequado a múltiplas instâncias ou hospedagem com disco efêmero.

## Hospedagem com Supabase

Consulte `docs/server-setup.md` e aplique a migração em `supabase/migrations`. Ative autenticação anônima no projeto e configure as variáveis de `.env.example` em `.env.local` ou no provedor de hospedagem. A chave service role fica exclusivamente no servidor.

Sem credenciais de um projeto, a integração remota não pode ser validada. A aplicação recusa iniciar persistência local em produção, salvo configuração explícita de `ALLOW_LOCAL_STORE=1` para servidor único com disco persistente.

## Verificação

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npx playwright test
```

O teste ponta a ponta abre sessões independentes e joga partidas completas nos dois modos, confere sigilo, resultado e revanche.

## Regras e operação

Cada participante recebe três cartas; ganha a mão quem vencer duas vazas, respeitando os desempates. Carta coberta somente a partir da segunda vaza. Aumento só na vez de jogar ou como resposta a outro aumento. Quem corre entrega o último valor estabelecido. Primeiro comando válido responde pela dupla.

Prazos: 30 segundos para jogar/responder; jogada automática da menor carta aberta; ausência de resposta corre. Abandono após 90 segundos sem contato. A atualização da página não reinicia os prazos. Prazos vencidos são reconciliados pelo servidor em cada consulta/comando; não há worker externo obrigatório.

Sem bots, chat, espectadores, apostas financeiras ou cadastro com senha. Cartas privadas, cobertas e cartas não jogadas nunca fazem parte da visão dos adversários. Perder os dados do navegador perde a identidade anônima.

## Dominó

A entrada **Dominó** na página inicial abre `/domino`. A modalidade inicial é 2x2, duplo-seis, sete pedras por participante, sem compra e vitória a partir de 100 pontos. Inclui salas por convite, salas abertas, treino/complemento com bots, chat e revanche.

Regras e validação: `docs/domino.md`. O motor e as APIs são separados dos de truco; somente a sessão e o armazenamento privado são compartilhados.
