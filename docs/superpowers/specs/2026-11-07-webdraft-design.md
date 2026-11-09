# WebDraft — pesquisa e plano da primeira versão

Pesquisa documental realizada em 7 de novembro de 2026. Atualização: uma consulta autenticada da FUT-DB retornou HTTP 429 com cota zero nesta conta; ver [relatório de validação](../../validacao-futdb.md). Nenhuma assinatura foi contratada ou aplicação implementada.

## 1. Objetivo e decisões

Criar um site em português para dois amigos disputarem um draft com cartas do EA Sports FC 27. Cada um monta um elenco e vence quem alcançar a maior pontuação, combinando overall e entrosamento.

**Confirmado pelo usuário:** começar em 1 contra 1; escolhas compartilhadas em rodadas por posição; cartas base e especiais; pontuação por overall e entrosamento; prioridade para dados gratuitos. Outras modalidades ficam para depois.

**Propostas adotadas para fechar o plano:** 11 titulares, formação 4-3-3 fixa, 30 segundos por escolha, entrada por link e apelido, sem cadastro visível. São defaults do planejamento, não respostas dadas pelo usuário. O apelido é apenas apresentação; cada participante tem uma identidade de sessão própria.

O sucesso da primeira versão é dois amigos conseguirem criar uma sala, entrar por navegadores diferentes, completar o draft e receber o mesmo resultado explicado, inclusive após atualizar a página.

Não entram agora: partidas de futebol simuladas, conexão à conta EA, exportação de elencos para o jogo, reservas, troca de formação, dinheiro ou premiações, chat, matchmaking, ranking global e salas com mais de duas pessoas.

## 2. Pesquisa das cartas e APIs

### Conclusão

Há fornecedores que anunciam catálogo e API de FC 27. Isso torna a proposta tecnicamente viável, mas **ainda não confirma acesso gratuito a todas as cartas, cobertura completa das promoções nem autorização para redistribuir imagens e manter uma cópia do catálogo**.

**Resultado do teste inicial:** a chave da conta gratuita foi localizada, mas a primeira consulta autenticada retornou `x-ratelimit-limit: 0`, `x-ratelimit-remaining: 0` e HTTP 429. A FUT-DB continua candidata, sem aprovação de viabilidade gratuita. A cobertura real dos dados permanece não validada.

| Fonte | Evidência encontrada | Decisão para este projeto |
| --- | --- | --- |
| EA Community API | A EA lista FUT.GG, FUTBIN e FUTWIZ como parceiros e informa que não aceita novas solicitações no momento. O programa trata de dados de contas autorizadas. | Não depender dela para um novo aplicativo. [Anúncio oficial](https://www.ea.com/games/ea-sports-fc/news/pitch-notes-fc26-community-api-update). |
| FUT-DB | Anuncia FC 27, acesso com chave gratuita e recursos premium. O plano premium anunciado custa €79/mês, inclui 20 mil requisições/dia e libera estatísticas e preços adicionais. | Primeira candidata à validação gratuita; não contratar premium. [Site e planos](https://app.futdatabase.com/). |
| DataFluxor FUT Data | Anuncia FC 27, catálogo de versões, atributos e imagens por US$29/mês e 100 mil requisições. O sandbox usa dados ilustrativos. | Alternativa paga documentada, sem contratação no escopo atual. [Produto](https://datafluxor.com/fut-data). |
| FUT.GG | Declara manter uma base de todas as cartas. | Referência para comparar amostras; isso não concede uma API pública ou permissão de extração. [Sobre a base](https://www.fut.gg/about/). |
| Ratings da EA | A EA descreve a base de ratings como cobertura dos itens base de FC 27. | Referência de cartas base, insuficiente para comprovar todas as versões especiais. [Ratings](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-ratings-deep-dive). |

Os valores são os anunciados na consulta e devem ser reconferidos antes de uma eventual compra. Uma chave paga do fornecedor não comprova, por si, direitos sobre os ativos da EA.

### O que a documentação técnica confirma

O [OpenAPI da FUT-DB](https://api.fut-db.com/api/doc/v1/swagger.json) identifica a versão 27, autenticação pelo cabeçalho `X-AUTH-TOKEN`, listagem paginada em `GET /api/players`, consulta individual e imagem do jogador. Há endpoints de clubes, ligas, nações e raridades. O modelo distingue identificação da versão e identificação base do atleta. Muitos campos são anuláveis; constarem no contrato não garante que venham preenchidos no plano gratuito. A imagem do jogador também não deve ser presumida como uma carta completa renderizada.

### Primeira etapa obrigatória: comprovar os dados

1. Usar uma chave gratuita da FUT-DB, fornecida/configurada pelo responsável pelo projeto, somente no servidor.
2. Medir paginação, limite gratuito efetivo, cobertura por posição e presença dos campos mínimos: identidade estável do atleta e da versão, edição, nome, overall, posição principal, clube, liga, nacionalidade e tipo de carta.
3. Comparar 30 cartas com referências visíveis: 10 base, 10 especiais de diferentes campanhas e 10 goleiros, incluindo versões do mesmo atleta. Registrar os campos ausentes e a data da consulta. Essa amostra valida adequação inicial, não certifica completude do catálogo.
4. Identificar se as imagens são retratos, fundos ou cartas prontas e se podem ser exibidas/armazenadas. Os [termos da FUT-DB](https://fut-db.com/terms), seção 7, restringem reprodução, distribuição e modificação sem permissão explícita. Esclarecer a permissão aplicável ao uso proposto antes de copiar ou publicar conteúdo. Nenhum contato com o fornecedor foi autorizado ou enviado nesta pesquisa.
5. Registrar quantidade de cartas válidas, tipos cobertos, campos preenchidos, licença/condições aplicáveis e custo observado. Nunca anunciar “todas as cartas” apenas com base na descrição comercial.

**Critério de saída:** fonte gratuita adequada e uso permitido, com dados suficientes para o modo descrito. Se não houver, entregar o protótipo com cartas fictícias identificadas como demonstração e registrar a dependência externa; não apresentar o produto como integrado ao FC 27. A integração real fica pendente, sem scraping de áreas restritas, contratação automática ou troca silenciosa por dados de outra edição.

## 3. Regras do duelo

### Entrada e início

- Um participante cria a sala e recebe um link de convite imprevisível. O outro entra com apelido. O link permite entrar, não assumir a identidade de um participante existente.
- A sala aceita exatamente duas identidades; uma terceira recebe “sala cheia”. Ambos confirmam que estão prontos antes do início.
- Antes de começar, mostrar regras, pontuação, cronômetro e data da base utilizada. Sortear quem terá prioridade na primeira rodada.

### Rodadas e cartas

- Usar a sequência fixa: GK, LB, CB, CB, RB, CM, CM, CM, LW, ST, RW. Cada posição corresponde a um espaço do 4-3-3 de cada participante.
- Cada rodada oferece cinco atletas diferentes elegíveis pela posição principal. Um participante escolhe, depois o outro escolhe entre as quatro cartas restantes. A prioridade alterna por rodada. São 11 rodadas e 22 escolhas; não existe fase posterior de trocas.
- Proposta de sorteio inicial: overall mínimo 75; para cada opção, 80% de chance de buscar uma carta base e 20% uma especial. Sortear primeiro o atleta elegível e depois uma versão elegível dele, evitando que atletas com muitas versões dominem o sorteio. Se a categoria especial não tiver candidato válido, usar base e registrar isso no diagnóstico.
- Preparar as 11 ofertas antes do início, com 55 atletas distintos no duelo inteiro. Isso impede repetição, inclusive de versões diferentes, e garante que escolhas anteriores não deixem posições futuras sem opções. Cartas não escolhidas não reaparecem nesse duelo.
- Validar a capacidade de montar as 11 ofertas antes de liberar o início. Se faltarem candidatos, informar indisponibilidade; não misturar posições, edições ou inventar atributos para completar o conjunto.
- A configuração 80/20, o piso 75 e a ausência de repetição são propostas de balanceamento, versionadas junto das regras e ajustáveis após jogar com amigos.
- Os dois veem as mesmas opções, os elencos parciais e a pontuação provisória. Apenas o participante da vez pode confirmar uma escolha. Não há desfazer nem novo sorteio por atualizar a página.

### Tempo, resultado e revanche

- O prazo é de 30 segundos por escolha, medido no servidor. Ao vencer, uma opção disponível é selecionada aleatoriamente pelo servidor.
- Uma escolha manual válida abre imediatamente o próximo turno, com prazo de 30 segundos a partir da confirmação no servidor. Uma escolha automática abre o próximo turno a partir do vencimento anterior, acrescido de 30 segundos. Na igualdade entre horário atual e vencimento, o prazo já expirou. Isso acelera escolhas antecipadas sem conceder tempo adicional em reconexões.
- O navegador solicita a resolução do prazo; leituras e comandos também reconciliam prazos vencidos. Guardar os vencimentos programados e avançar deterministicamente os turnos já expirados, sem depender de um processo em memória ou de aba aberta. O último resultado é persistido mesmo quando calculado após uma reconexão.
- Vincular o sorteio automático à semente privada e ao número do turno, de modo que tentativas repetidas de resolver o mesmo prazo produzam a mesma opção dentre as disponíveis.
- Atualizar a página recupera o duelo pela mesma sessão. Se a pessoa apagar os dados do navegador ou mudar de dispositivo, não poderá recuperar essa identidade anônima na v1. O relógio continua durante desconexões.
- Cada rodada mantém a mesma prioridade até ambos escolherem; só então a prioridade é invertida para a próxima posição. Em 11 rodadas alguém começa seis vezes e o outro cinco. Explicar essa diferença e inverter a prioridade inicial na revanche.
- A revanche exige aceite dos dois, cria um novo duelo e novas ofertas. A sala de espera expira após 24 horas sem iniciar. Resultados ficam acessíveis aos participantes por 30 dias.

### Pontuação própria e transparente

Para cada titular, atribuir um ponto por cada condição:

1. Existe pelo menos outro titular do mesmo clube.
2. Existe pelo menos outro titular da mesma liga.
3. Existe pelo menos outro titular da mesma nacionalidade.

Um único companheiro pode satisfazer mais de uma condição. Cada condição vale no máximo um ponto por titular; entrosamento total varia de 0 a 33. Um identificador ausente não cria ligação. Não existem regras especiais para ídolos, heróis, treinadores ou cartas promocionais nesta versão: são as mesmas três condições para todos, com dados reais disponíveis. Essa é uma regra do WebDraft, não a reprodução do entrosamento oficial da EA.

`Pontuação = média do overall dos 11 titulares + 10 × (entrosamento total / 33)`

Exemplo: overall médio 85 e entrosamento 22 geram 91,67 pontos. Mostrar as duas parcelas e as conexões por jogador. Apresentar duas casas decimais, mas comparar o valor exato por aritmética inteira equivalente: `3 × soma dos overalls + 10 × entrosamento`. Se empatar, declarar empate e oferecer revanche; não usar critério oculto ou sorteio para escolher vencedor.

## 4. Implementação proposta

### Abordagens e arquitetura

O usuário escolheu rodadas por posição em vez de uma mesa aberta. Isso permite ofertas compartilhadas com posições iguais para os dois. A primeira versão limita-se ao duelo; estruturas de sala e regras devem admitir novos modos sem implementá-los agora.

Para a parte técnica, a recomendação do planejamento é **Next.js com TypeScript e Tailwind CSS, Supabase para Postgres, autenticação anônima e Realtime**, e Vercel para hospedagem inicial. Usar versões estáveis compatíveis no momento da implementação e fixá-las no lockfile. Evitar um servidor WebSocket próprio neste início.

O Supabase documenta [sessões anônimas](https://supabase.com/docs/guides/auth/auth-anonymous), que dispensam e-mail/senha, e [controle por linha no banco](https://supabase.com/docs/guides/database/postgres/row-level-security). A escolha permite uma interface de apelido com identidades separadas. O [plano gratuito](https://supabase.com/pricing) tem cotas; o [Vercel Hobby](https://vercel.com/pricing) destina-se a uso pessoal e não comercial. A proposta é aproveitar essas opções para jogar com amigos, sem prometer custo zero em qualquer escala ou uso comercial.

### Dados e integridade

- Separar catálogo de atletas, versões de cartas e snapshots importados; manter também salas, participantes, duelos, ofertas, escolhas e resultados. Cada duelo fixa uma versão das regras e do catálogo. Atualizações do fornecedor não alteram partidas já iniciadas.
- Criar um adaptador de fornecedor com operações de paginação/listagem e leitura de metadados/imagens. O motor do draft usa tipos internos, sem depender dos identificadores de um site específico. A fonte inicial é FUT-DB; DataFluxor permanece apenas alternativa de pesquisa.
- Após comprovar permissão e limites, sincronizar o catálogo por comando administrativo manual, no máximo uma vez por dia, respeitando a cota gratuita. Não depender de cron pago. Aplicar atualização completa apenas após validar o lote; manter o último snapshot válido em falha, com data visível.
- Persistir imagens somente se permitido. Preferir cartas desenhadas pelo próprio site com os dados liberados; usar retrato e ativos reais apenas quando houver permissão. Imagem ausente recebe um placeholder sem alterar overall ou pontuação. Não fazer hotlink como forma de contornar restrições.
- Ofertas futuras e semente de sorteio ficam inacessíveis ao cliente. Expor somente a rodada corrente, escolhas realizadas e dados necessários aos dois participantes. Clientes não podem gravar cartas, pontuações ou resultados diretamente.
- Processar início, escolha e expiração de turno em transações com bloqueio do duelo. Validar identidade, participação, turno, prazo, versão de estado e opção disponível; repetição do mesmo comando não pode duplicar escolha. O mesmo resolvedor atende escolha manual e automática.
- Realtime sinaliza atualização; o cliente busca o estado atual autorizado. Fazer sincronização adicional a cada 3 segundos durante a partida e na reconexão, resolvendo vencimentos também no servidor. Estado e relógio enviados pelo cliente nunca são fonte de verdade.
- Chaves de fornecedor e credenciais administrativas ficam no servidor. Aplicar RLS à leitura por participantes e negar escrita direta; páginas de sessão usam renderização dinâmica. Limitar criação de salas/entradas e proteger criação de sessão anônima contra abuso antes de disponibilizar o site amplamente.

### Interfaces propostas

- `POST /api/rooms`: criar sala para a sessão anônima.
- `POST /api/rooms/{invite}/join`: ocupar a segunda vaga ou recuperar a participação da mesma identidade.
- `POST /api/rooms/{id}/ready`: registrar prontidão; o segundo aceite inicia o duelo uma única vez.
- `GET /api/rooms/{id}`: obter estado autorizado, revisão, horário do servidor e vencimento atual; reconciliar prazos vencidos antes da resposta.
- `POST /api/matches/{id}/picks`: enviar identificador da opção, revisão esperada e chave de idempotência. O servidor determina jogador, posição e pontuação.
- `POST /api/matches/{id}/advance`: solicitar a resolução de prazo vencido; não aceita escolha de carta pelo cliente.
- `POST /api/rooms/{id}/rematch`: registrar aceite de revanche; o segundo aceite cria o próximo duelo.

Tipar estado da sala/duelo, oferta, escolha e decomposição da pontuação. Estados: espera, draft, finalizado, cancelado/expirado. Respostas de conflito incluem o estado atualizado. Diferenciar sala inexistente/cheia, participante sem acesso, turno inválido, oferta vencida e catálogo indisponível. Os contratos acima são propostas internas; não são endpoints do fornecedor.

### Experiência

Fluxo: início → criar/entrar → espera e regras → campo com dois elencos e cinco opções → resultado detalhado → revanche. Interface responsiva em português, com identidade própria de jogo de futebol, destaque para a vez de escolher, posição e cronômetro. Cartas devem ser legíveis no celular, acessíveis por teclado e identificáveis sem depender apenas da cor. O cronômetro deve alertar sem anunciar cada segundo a leitores de tela. Sem tela de cadastro, loja ou recursos fora do duelo.

## 5. Ordem de entrega e validação

1. **Viabilidade dos dados:** executar a validação da seção 2 e registrar o resultado. Sem essa etapa, integração real não pode ser considerada concluída.
2. **Motor isolado:** implementar ofertas, alternância, prazos, entrosamento e resultado com fixtures fictícias. Validar todas as regras antes de integrar sincronização.
3. **Duelo online:** implementar sessões, sala, persistência, transações, Realtime e recuperação do estado em dois navegadores.
4. **Interface completa:** concluir fluxo no desktop e celular, pontuação explicada, erros e revanche; integrar o catálogo aprovado.
5. **Piloto com amigos:** publicar em ambiente pessoal após configurar contas e segredos e medir duração, compreensão do resultado, problemas de conexão e variedade das ofertas. Ajustar pesos apenas em uma nova versão de regras, preservando resultados antigos.

### Testes de aceitação

- Dois navegadores independentes entram na mesma sala; um terceiro não ocupa vaga nem lê o duelo sem participação.
- Duelo completo gera 22 escolhas, 11 titulares por time, posições corretas, prioridade alternada e nenhuma repetição de atleta entre as 55 opções.
- Sorteios respeitam o catálogo fixado, a posição, o piso de overall e a configuração de categorias; fixtures controladas testam os caminhos de sorteio sem testes estatísticos frágeis.
- Duas requisições concorrentes, clique duplo, comando repetido e disputa entre timeout e clique confirmam no máximo uma escolha por turno.
- Atualizar, desconectar e reconectar não gera novo sorteio nem concede tempo extra; ausência de ambas as abas reconcilia os prazos corretamente no próximo acesso.
- Entrosamento cobre 0 e 33, relações parciais, um companheiro cobrindo múltiplas condições, dados ausentes e versões especiais. Pontuação cobre vitória e empate, inclusive diferenças ocultas pelo arredondamento de apresentação.
- Falha/limite da API preserva o último catálogo válido; importação parcial não substitui a base; imagem ausente mantém uma carta utilizável. Credenciais e ofertas futuras não aparecem no navegador.
- Revanche requer os dois aceites, troca a prioridade inicial e preserva o resultado anterior. Funciona em tela móvel e com teclado.

Registrar no piloto falhas de importação, idade do catálogo, conflitos de escolha, reconexões e tempo de conclusão, sem gravar tokens ou chaves nos logs. Usar testes unitários no motor, testes de integração nas transações/acesso e um fluxo de ponta a ponta com duas sessões.

### Dependências e limites do plano

As regras de jogo acima estão fechadas para uma v1 e podem ser implementadas com fixtures. O acesso real aos dados depende de chave gratuita, cobertura adequada e permissão de uso; essas são verificações externas, não garantias desta pesquisa. Não contratar, contatar fornecedores ou publicar a aplicação automaticamente a partir deste documento. Nenhum código de produto foi criado nesta etapa.
