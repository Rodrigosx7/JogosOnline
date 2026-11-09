# Servidor e persistência

`npm run dev` funciona sem Supabase. O servidor cria `.data/rooms` e uma chave aleatória em `.data/session-secret`; não publique nem versione esse diretório. A identidade é um cookie HttpOnly assinado, SameSite=Lax. O cookie fica Secure em produção. Recarregar ou reiniciar o servidor preserva salas e identidade. Apagar cookies perde a identidade; o convite não permite assumir um jogador existente.

O adaptador local usa escrita temporária + rename e comparação de versão serializada por sala. É destinado a **um único processo Node com disco persistente**. Não use vários workers, instâncias ou disco efêmero para hospedar partidas. `npm run build && npm start` exige Supabase por padrão; para um piloto em uma única máquina com disco persistente, configure explicitamente `ALLOW_LOCAL_STORE=1`. `APP_SESSION_SECRET` é opcional e precisa de pelo menos 32 caracteres; se usado, mantenha o mesmo valor entre reinícios.

## Supabase

1. Crie um projeto e aplique `supabase/migrations/202611070001_private_game_rooms.sql`.
2. Habilite autenticação anônima nas configurações de Auth.
3. Defina somente no servidor `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
4. Use HTTPS no domínio de produção.

O servidor cria/renova sessões anônimas via Auth e guarda access/refresh tokens em cookies HttpOnly. O cliente não envia `playerId`; o servidor valida o usuário em Auth. A chave service-role nunca é enviada ao navegador. O estado completo e cartas privadas ficam em `game_rooms`, sem acesso direto para os papéis anon/authenticated. Postgres aplica compare-and-swap sobre a versão de armazenamento, incluindo deduplicação dos últimos 128 requestIds por participante, no mesmo registro.

`game_memberships` e `game_revisions` são atualizadas pela mesma transação. A projeção tem apenas código e revisão e RLS permite leitura somente aos participantes. `/api/rooms/[code]/events` verifica a participação, assina essa projeção via Supabase Realtime no servidor e encaminha somente a revisão por SSE. Nenhuma credencial ou payload completo sai na conexão. A assinatura é removida ao desconectar; cada conexão dura até 55 segundos e a reconexão verifica a sessão novamente. Sem Supabase o endpoint retorna 204. A interface mantém polling autorizado como fallback, para reconciliar prazos e registrar presença; não aumenta a revisão pública apenas por heartbeat. É necessário manter o polling ativo para a presença do jogador.

As rotas rejeitam mutações entre origens diferentes, limitam o corpo JSON e a frequência por identidade; criação também tem limite por IP. Os limites em memória são uma proteção básica por instância. Antes de exposição pública ampla, adicione limites distribuídos e proteção contra abuso de criação de identidades na infraestrutura/Supabase. Não há limpeza automática de salas nesta versão. A configuração em nuvem e as políticas SQL precisam ser validadas no projeto de destino; sem credenciais, apenas o adaptador local é testado.

## Contrato

- `POST /api/rooms`: `{mode:'1x1'|'2x2', name}` → `{code}`.
- `GET /api/rooms/[code]`: estado filtrado para o participante autenticado; terceiros recebem 403.
- `POST /api/rooms/[code]`: `{command, revision, requestId}`. `join` com nome usa o convite para ocupar uma vaga. Outros comandos exigem participação e a revisão atual. Conflitos retornam 409 com a visão atual. Repetir um requestId não repete a jogada.

O convite contém 144 bits aleatórios. Comandos aceitos: join, seat, ready, play, raise, respond, run e rematch. Toda pontuação, cartas, turno e relógio são calculados no servidor.
