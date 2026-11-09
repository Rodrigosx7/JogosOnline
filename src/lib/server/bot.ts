import { applyCommand, cardStrength, playerView, type Card, type Room } from '../game';

// This strategy receives exactly the same filtered information as a human player.
export function chooseBotCommand(view: ReturnType<typeof playerView>) {
  const cards = [...view.hand as Card[]].sort((a, b) => cardStrength(a) - cardStrength(b) || a.id.localeCompare(b.id));
  const strengths = cards.map(cardStrength);
  const strong = strengths.filter(n => n >= 9).length;
  const manilhas = strengths.filter(n => n >= 20).length;
  const ownTeam = view.players.find((p: { id: string }) => p.id === view.playerId).seat % 2;
  const won = view.trickResults.includes(ownTeam);
  if (view.legal.runResponse) return { type: 'run-response', answer: manilhas > 0 || strong >= 2 ? 'play' : 'run' };
  if (view.legal.eleven) return { type: 'eleven', answer: manilhas > 0 || strong >= 2 ? 'play' : 'run' };
  if (view.legal.respond) {
    const confident = manilhas > 0 || strong >= 2 || (won && strong > 0);
    const accept = confident || (view.pending.proposed === 5 && (strong > 0 || won));
    return { type: 'respond', answer: view.scores[ownTeam] !== 11 && confident && manilhas >= 2 && view.pending.proposed < 11 ? 'raise' : accept ? 'accept' : 'run' };
  }
  if (!view.legal.play || !cards.length) return null;
  if (view.scores[ownTeam] !== 11 && view.legal.raise && (manilhas >= 2 || (manilhas > 0 && strong >= 2 && view.stake < 7))) return { type: 'raise' };
  const best = Math.max(0, ...view.trick.map((play: { card: Card | null }) => play.card ? cardStrength(play.card) : 0));
  const leaders = view.trick.filter((play: { card: Card | null }) => play.card && cardStrength(play.card) === best);
  const partnerWinning = leaders.length > 0 && leaders.every((play: { seat: number }) => play.seat % 2 === ownTeam);
  const partnerWeak = view.signals?.some((signal: { playerId: string; team: number; kind: string }) => signal.team === ownTeam && signal.playerId !== view.playerId && signal.kind === 'weak');
  // Save stronger cards when leading; otherwise spend the smallest winning card.
  const card = partnerWinning ? cards[0] : !view.trick.length && partnerWeak ? cards.at(-1)! : cards.find(c => cardStrength(c) > best) ?? cards[0];
  return { type: 'play', cardId: card.id, covered: false };
}

export function advanceBot(room: Room, now: number): Room {
  const bots = room.players.filter(p => p.isBot).sort((a, b) => a.seat - b.seat);
  if (!bots.length) return room;
  if ((room.status === 'finished' || room.status === 'cancelled') && room.rematchVotes.some(id => room.players.some(p => p.id === id && !p.isBot))) {
    for (const bot of bots) if (!room.rematchVotes.includes(bot.id)) room = applyCommand(room, bot.id, { type: 'rematch' }, now);
  }
  if (room.status === 'playing' && room.mode === '2x2') {
    for (const bot of bots) {
      const own = playerView(room, bot.id, now);
      const received = own.signals.findLast((s: { playerId: string; team: number }) => s.team === bot.seat % 2 && room.players.some(p => p.id === s.playerId && !p.isBot));
      if (received) (room.botPendingSignalAcks ??= {})[bot.id] = { id: received.id, at: received.at };
      const queued = room.botPendingSignalAcks?.[bot.id];
      if (now < (room.handStartedAt ?? 0) + 3500) continue;
      const previous = room.signals?.findLast(s => s.playerId === bot.id);
      if (previous && now - previous.at < 2000) continue;
      const acknowledge = queued && now - queued.at < 5000 && room.botAcknowledgedSignals?.[bot.id] !== queued.id;
      if (!acknowledge && room.botSignalHands?.[bot.id] === room.handNumber) continue;
      const special = own.hand.find((card: Card) => cardStrength(card) >= 20) as Card | undefined;
      const kind = acknowledge ? 'ack' : special ? ({ '4-clubs': 'zap', '7-hearts': 'copeta', 'A-spades': 'espadilha', '7-diamonds': 'pica-fumo' } as Record<string, string>)[special.id] : own.hand.some((c: Card) => cardStrength(c) >= 9) ? 'strong' : 'weak';
      room = applyCommand(room, bot.id, { type: 'signal', kind }, now);
      (room.botSignalHands ??= {})[bot.id] = room.handNumber;
      if (acknowledge) (room.botAcknowledgedSignals ??= {})[bot.id] = queued!.id;
    }
  }
  const bot = bots.find(p => {
    const view = playerView(room, p.id, now);
    // Humans answer first; after a run vote their bot partner must also decide.
    const humans = room.players.filter(v => !v.isBot && v.seat % 2 === p.seat % 2);
    const votes = view.pending?.runVotes ?? view.eleven?.runVotes ?? [];
    const humanAnswered = humans.every(v => votes.includes(v.id));
    return view.legal.runResponse || view.legal.play || (humanAnswered && (view.legal.respond || view.legal.eleven));
  });
  if (!bot) { room.botAction = null; return room; }
  const view = playerView(room, bot.id, now);
  if (!view.legal.play && !view.legal.respond && !view.legal.eleven && !view.legal.runResponse) { room.botAction = null; return room; }
  const key = `${room.revision}:${bot.id}`;
  if (room.botAction?.key !== key) {
    // Persist the delay: refreshes and concurrent requests cannot reset it.
    room.botAction = { key, at: Math.max(now + 900, (room.handStartedAt ?? 0) + 3500) };
    return room;
  }
  if (room.botAction.at > now) return room;
  const command = chooseBotCommand(view);
  room.botAction = null;
  return command ? advanceBot(applyCommand(room, bot.id, command, now), now) : room;
}
