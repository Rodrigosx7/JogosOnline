# Modo personalizado e administração

O tutorial interativo fica na página inicial e pode ser aberto na sala sem navegação ou pausa da partida. Comparação de cartas, simulação do placar e resolução de mãos usam funções compartilhadas com o motor em `src/lib/truco-rules.ts`.

## Painel

- Endereço: `/admin`. Usuário e hash scrypt da senha ficam em variáveis privadas do servidor, junto de uma chave separada para assinar sessões de oito horas.
- O acesso inicial está no arquivo local ignorado `.data/admin-access.txt`; não o envie ao repositório. A senha não é guardada em texto puro no servidor publicado.
- Pode configurar o nome e a disponibilidade do modo, uma foto para cada uma das 40 cartas e áudios para embaralhar, distribuir, jogar, Truco, Seeeis, Nove, Onze, aceite, corrida, vitória e derrota.
- Imagens: PNG/JPG/WebP. Áudios: MP3/OGG/WAV. Limite de 3 MB por arquivo. O servidor verifica o formato binário e não aceita HTML/SVG.
- A prévia usa acesso administrativo. O armazenamento Supabase é privado. Em uma sala personalizada, os arquivos só são entregues a participantes ou espectadores autorizados daquela sala e quando referenciados na configuração dela.
- Salvar publica para novas salas. Cada sala guarda uma cópia da configuração usada na criação; substituir ou remover uma foto no painel não quebra salas existentes. Remover uma referência não exclui o objeto que uma sala antiga ainda possa usar.
- O modo normal não recebe a configuração personalizada. As imagens mantêm valor e naipe; não alteram a força das cartas. O controle de silêncio também interrompe os áudios enviados pelo administrador.

## Criar uma sala

Selecione Normal ou Personalizado. No personalizado, escolha Tentos normais ou Tentos manuais. A formação 1x1/2x2, a mesa clássica/Skol e a visibilidade continuam independentes.

### Tentos normais

Pontuação, mão de 11, capar, corridas, vitória e abandono seguem o motor normal, com as fotos e os áudios personalizados.

### Tentos manuais

- Cada jogador pode puxar ou devolver de 1 a 11 tentos por ação para sua própria equipe, em qualquer momento da partida, mesmo fora de sua vez, durante pedidos e durante conferência das cartas.
- O placar pode ir de 0 a 99. Há intervalo mínimo de um segundo por jogador entre movimentações.
- Cada movimento informa quem puxou/devolveu, a quantidade e os totais anterior/novo. Uma mão animada leva os tentos até a pilha, visível também a adversários e espectadores.
- Ganhar uma mão não muda o placar automaticamente. Os jogadores fazem as movimentações. O resultado das vazas continua sendo calculado normalmente.
- Mão de 11 e capar continuam disponíveis conforme os tentos puxados. A fase especial é estabelecida na nova distribuição; puxar tentos não redistribui cartas nem reinicia o prazo.
- Nenhuma vitória pelo placar encerra sozinha. Inclusive o erro de trucar estando com 11 resolve a mão e distribui outra; a partida manual continua até todos confirmarem o encerramento.
- O botão Votar para encerrar alterna o voto do participante. Todos os jogadores sentados precisam votar; espectadores não votam. Bots acompanham um voto humano. Ao completar a unanimidade, vence quem tiver mais tentos naquele momento; igualdade encerra em empate.
- O abandono automático não encerra esse modo; os prazos das jogadas continuam funcionando. Atualizar ou voltar à mesma sessão recupera a participação. A confirmação de todos é obrigatória para terminar.
- O encerramento por unanimidade pode ocorrer durante qualquer fase. Revanche mantém o tipo da sala e exige as confirmações normais, zerando o placar e os votos.

## Infraestrutura

O bucket privado `custom-game-assets` é criado pelo servidor ao primeiro envio administrativo. A configuração atual fica em `settings/current.json` e os arquivos têm identificadores aleatórios imutáveis. No desenvolvimento sem Supabase, usa-se `.data/custom-mode`.

As variáveis `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` e `ADMIN_SESSION_SECRET` devem existir na Vercel antes de publicar o painel. Nenhuma chave ou senha entra no cliente, no Git ou no exemplo de ambiente.


## Alterar a senha do administrador

No painel, use a seção Alterar senha. Informe a senha atual, uma nova senha/frase de 10 a 128 caracteres e a confirmação. Espaços são permitidos. O botão Mostrar nova senha facilita a conferência. A senha nova deve ser diferente da atual.

A alteração é imediata e independente de Salvar configurações. O usuário permanece o mesmo e a sessão que fez a alteração é renovada; as outras sessões administrativas são invalidadas. A senha antiga deixa de autenticar, mesmo que ainda seja a senha inicial nas variáveis do servidor.

O servidor grava somente hash scrypt com salt aleatório e uma versão de sessão no objeto privado `settings/admin-credentials.json`. O arquivo local de acesso inicial não é atualizado pelo site e deixa de representar a senha depois que ela for trocada. Não há senha nova em texto puro na configuração, nas salas ou no repositório.
