# Validação inicial da FUT-DB

Data: 7 de novembro de 2026. Testes HTTP reais, primeiro sem chave e depois com a chave da conta em que o usuário efetuou login pessoalmente.

## Resultados observados

| Requisição | HTTP | Resultado |
| --- | --- | --- |
| `GET https://api.fut-db.com/api/doc/v1/swagger.json` | 200 | OpenAPI válido; versão declarada 27. |
| `GET https://api.fut-db.com/api/players?page=1` | 401 | Acesso exige autenticação; corpo vazio. |
| `GET https://api.fut-db.com/api/clubs?page=1` | 401 | Acesso exige autenticação; corpo vazio. |
| `GET https://api.fut-db.com/api/rarities?page=1` | 401 | Acesso exige autenticação; corpo vazio. |
| `GET https://app.futdatabase.com/` | 200 | Página acessível com links de login, registro e “Get Your API Key”. |
| `GET https://fut-db.com/identity/account/register?returnUrl=%2Fapp` | 200 | Cadastro acessível: e-mail, senha e confirmação. Informa envio da chave ao e-mail cadastrado. |

O teste verifica que as rotas respondem e exigem autenticação; não verifica cobertura do catálogo nem concessão efetiva do plano gratuito. As três respostas 401 não trouxeram `Retry-After`; isso não permite deduzir a cota gratuita.

## Contrato público

A [documentação OpenAPI](https://api.fut-db.com/api/doc/v1/swagger.json) define autenticação por `X-AUTH-TOKEN`. O modelo de jogador contém campos para versão da carta, atleta base, overall, posição, posições alternativas, clube, liga, nacionalidade, raridade e atributos. Vários campos aceitam nulo, portanto precisam ser conferidos com uma chave gratuita real. Preços, busca e alguns outros recursos são identificados como premium.

O [site do fornecedor](https://app.futdatabase.com/) anuncia chave gratuita e estatísticas adicionais no plano premium. Não foi localizada uma cota gratuita explícita nas páginas consultadas. Não presumir que a cota premium seja a gratuita.

## Como obter e configurar a chave

1. Abrir o [cadastro oficial](https://fut-db.com/identity/account/register?returnUrl=%2Fapp).
2. Preencher e-mail, senha e confirmação; enviar o cadastro pessoalmente.
3. Conferir a caixa de entrada e spam. A página informa que a chave será enviada para o endereço fornecido. Seguir eventual confirmação solicitada no e-mail.
4. Inserir a chave em `.env.local` na raiz deste projeto, depois de `FUTDB_API_KEY=`. O arquivo foi criado vazio e está coberto pelo `.gitignore`.

Não incluir a chave em código do navegador, parâmetro de URL, relatório ou commit. O programa de validação deverá carregar esse arquivo explicitamente ou receber a variável de ambiente; arquivos `.env.local` não são carregados automaticamente por qualquer comando do terminal. Nenhuma conta ou assinatura foi criada nesta etapa.

## Próximo teste autenticado

- Começar com uma única página de jogadores e registrar status, paginação e preenchimento dos campos mínimos, sem registrar a chave.
- Se a autenticação falhar, interromper; se houver limite, respeitar a resposta. Não fazer teste de carga para descobrir a cota.
- Consultar pequenas amostras adicionais para localizar cartas base, especiais e goleiros; ampliar no máximo até a amostra planejada de 30 cartas, conforme a cota permitir. Registrar explicitamente tipos que não forem encontrados, sem assumir ausência no catálogo inteiro.
- Conferir identificação de atleta/versão, posições, overall e metadados de entrosamento. Testar uma imagem válida a partir de um identificador retornado e verificar se é retrato ou carta completa.
- Comparar amostras com referências públicas e registrar cobertura, nulos, data e limitações. A adequação ao draft e as permissões de exibição/armazenamento permanecem pendentes.

## Teste autenticado com a conta gratuita

O usuário efetuou login no navegador. O dashboard exibia um API-Token existente e `Premium: No access`. A chave foi lida somente para a consulta solicitada e aplicada na interface oficial Swagger da própria FUT-DB. Não houve criação/redefinição de chave, contratação de premium ou exposição da credencial no relatório/chat. `.env.local` continua sem chave configurada.

Uma única consulta autenticada foi executada: `GET https://api.fut-db.com/api/players?page=1`.

**Resultado: HTTP 429**, com corpo:

```json
{"message":"Too many requests. Please try again later.","code":429}
```

Cabeçalhos observados na resposta, excluindo qualquer credencial:

```text
date: Sat, 07 Nov 2026 16:04:53 GMT
x-premium: 0
x-ratelimit-limit: 0
x-ratelimit-remaining: 0
x-ratelimit-retry-after: 2026-11-08T16:04:54+00:00
```

O horário indicado para nova tentativa equivale a **8 de novembro de 2026, às 13h04min54s, em America/Sao_Paulo**. É um cabeçalho específico do fornecedor; não garante que a cota passará a ser positiva nessa data. Nenhuma outra chamada autenticada foi feita após o 429.

**Interpretação limitada:** a conta consultada apresenta cota zero, não apenas saldo zero. O resultado não permite validar atributos, tipos de carta ou imagens e não comprova o motivo da restrição. Pode depender de ativação/liberação da conta ou de política do fornecedor; não há evidência suficiente para escolher uma causa. Também não prova que todas as contas gratuitas sejam bloqueadas. Os exemplos exibidos abaixo da resposta no Swagger são modelos do contrato, não dados reais retornados.

**Próximo passo externo:** conferir eventuais instruções de ativação no e-mail de cadastro. Se a conta já estiver ativada, pedir esclarecimento ao suporte do fornecedor sobre `x-ratelimit-limit: 0` no plano gratuito, sem enviar a chave. O site oferece [Discord](https://discord.gg/KHGemdz2Vq) e contato de suporte na [página inicial](https://fut-db.com/). Nenhuma mensagem foi enviada em nome do usuário. Uma nova tentativa deve respeitar o horário informado ou uma liberação expressa do fornecedor; não repetir chamadas para tentar contornar o limite.

**Situação:** chave localizada e chamada autenticada realizada; validação dos dados do plano gratuito impedida pela cota zero desta conta. Não considerar a FUT-DB aprovada como fonte gratuita para o projeto neste momento.
