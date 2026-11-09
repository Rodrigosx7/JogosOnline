'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { DominoIcon, DominoRules, DominoStone } from '@/components/DominoPieces';
import { RoomSocial } from '@/components/RoomSocial';
import type { DominoCommand, DominoView, End } from '@/lib/domino';
import '../../domino.css';

export default function DominoRoom({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params), endpoint = `/api/domino/rooms/${encodeURIComponent(code)}`;
  const [view, setView] = useState<DominoView | null>(null), current = useRef<DominoView | null>(null);
  const [join, setJoin] = useState(false), [name, setName] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), flight = useRef(false), reading = useRef(false);
  const [connected, setConnected] = useState(true), [now, setNow] = useState(Date.now()), offset = useRef(0);
  const [selected, setSelected] = useState<string | null>(null), [copied, setCopied] = useState(false);
  const receive = useCallback((next: DominoView) => {
    if (current.current && (next.revision < current.current.revision || (next.revision === current.current.revision && next.socialRevision < current.current.socialRevision))) return;
    current.current = next; offset.current = next.serverTime - Date.now(); setView(next); setJoin(false); setConnected(true);
  }, []);
  const refresh = useCallback(async () => {
    if (reading.current) return; reading.current = true;
    try {
      const response = await fetch(endpoint, { cache: 'no-store' }), data = await response.json();
      if (response.status === 403) { setJoin(true); return; }
      if (!response.ok) throw Error(data.error); receive(data);
    } catch (err) { setConnected(false); if (!current.current) setError(err instanceof Error ? err.message : 'Não foi possível abrir a mesa.'); }
    finally { reading.current = false; }
  }, [endpoint, receive]);
  useEffect(() => {
    setName(localStorage.getItem('truco-name') ?? ''); void refresh(); let last = Date.now();
    const timer = setInterval(() => { const gap = document.hidden ? 15000 : current.current?.status === 'waiting' ? 2500 : 750; if (Date.now() - last >= gap) { last = Date.now(); void refresh(); } }, 250);
    const tick = setInterval(() => setNow(Date.now()), 500);
    const visible = () => { if (!document.hidden) void refresh(); }; document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); clearInterval(tick); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  useEffect(() => setSelected(null), [view?.revision]);
  async function command(value: Record<string, unknown>) {
    if (flight.current) return false; flight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: value as DominoCommand, revision: current.current?.revision ?? 0, requestId: crypto.randomUUID() }) });
      const data = await response.json();
      if (response.status === 409) { receive(data); throw Error('A mesa mudou. Confira a jogada e tente novamente.'); }
      if (!response.ok) throw Error(data.error); receive(data);
      if (value.type === 'join') localStorage.setItem('truco-name', name.trim());
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar a jogada.'); return false; }
    finally { flight.current = false; setBusy(false); }
  }
  async function invite() { try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError('Copie o endereço da página para convidar seus amigos.'); } }
  const self = view?.players.find(p => p.id === view.playerId), team = (self?.seat ?? 0) % 2;
  const seconds = view?.deadline ? Math.min(view.status === 'between' ? 4 : 30, Math.max(0, Math.ceil((view.deadline - now - offset.current) / 1000))) : 0;
  function play(stoneId: string, end?: End) {
    const move = view?.legal.moves.find(move => move.id === stoneId); if (!move || busy) return;
    if (end || move.ends.length === 1) void command({ type: 'play', stoneId, end: end ?? move.ends[0] });
    else setSelected(stoneId);
  }
  return <main className="domino-page domino-room"><header className="domino-header"><a className="domino-brand" href="/domino"><DominoIcon /><span>dominó <small>da casa</small></span></a><nav><a href="/">♣ Truco</a><button className="domino-button" onClick={invite}>{copied ? 'Copiado ✓' : 'Convidar amigos'}</button></nav></header>
    {!connected && <p className="domino-alert" role="status">Reconectando à mesa…</p>}{error && <p className="domino-alert" role="alert">{error}<button aria-label="Fechar aviso" onClick={() => setError('')}>×</button></p>}
    {join ? <section className="domino-panel domino-join"><h1>Seu lugar está guardado.</h1><form onSubmit={event => { event.preventDefault(); void command({ type: 'join', name }); }}><label htmlFor="domino-join-name">Como te chamam?</label><input id="domino-join-name" required minLength={2} maxLength={24} value={name} onChange={event => setName(event.target.value)} /><button className="domino-button domino-primary" disabled={busy}>Entrar na mesa</button></form></section> : !view ? <p className="domino-loading">{error ? 'Confira o convite da mesa.' : 'Preparando as pedras…'}</p> : <>
    <div className="domino-match-heading"><div className="domino-score" aria-label="Placar do dominó"><span>Sua dupla <strong>{view.scores[team]}</strong></span><i>:</i><span><strong>{view.scores[1 - team]}</strong> Adversários</span><small>Até 100 · Mão {view.handNumber || 1}</small></div><details className="domino-rules-details"><summary>Regras da mesa</summary><div><DominoRules /></div></details></div>
    <div className="domino-room-grid"><section className="domino-play-area" aria-label="Mesa de dominó"><p className="domino-turn" role="status">{view.status === 'waiting' ? `${view.players.length} de 4 jogadores` : view.status === 'between' ? `Próxima mão em ${seconds}s` : view.status === 'finished' || view.status === 'cancelled' ? 'Partida encerrada' : `${self?.seat === view.currentSeat ? 'Sua vez' : `Vez de ${view.players.find(p => p.seat === view.currentSeat)?.name}`} · ${seconds}s`}</p>
    <div className="domino-table">{[0, 1, 2, 3].map(seat => {
      const player = view.players.find(p => p.seat === seat), relative = (seat - (self?.seat ?? 0) + 4) % 4;
      return <div className={`domino-seat domino-seat-${relative} ${view.status === 'playing' && view.currentSeat === seat ? 'domino-seat-active' : ''}`} key={seat}><div className="domino-avatar">{player?.name.slice(0, 1).toUpperCase() ?? '+'}</div><strong>{player?.name ?? 'Lugar livre'}</strong><small>{player ? view.status === 'waiting' ? player.ready ? 'Pronto ✓' : 'Aguardando' : `${player.count} pedras · ${seat % 2 === team ? 'Sua dupla' : 'Adversário'}` : `Dupla ${seat % 2 + 1}`}</small>{!player && view.status === 'waiting' && <button className="domino-seat-button" disabled={busy} onClick={() => void command({ type: 'seat', seat })}>Sentar aqui</button>}</div>;
    })}
    {view.status === 'waiting' ? <div className="domino-table-message"><DominoIcon /><h2>A parceria começa aqui.</h2><p>Chame os amigos ou complete com bots.</p></div> : <><div className="domino-chain-area">{!!view.board.length && <div className="domino-open-ends"><span>Esquerda <b>{view.board[0].left}</b></span><span>Direita <b>{view.board.at(-1)!.right}</b></span></div>}<div className="domino-chain" aria-label="Pedras jogadas">{view.board.map(stone => <DominoStone key={stone.id} a={stone.left} b={stone.right} horizontal={stone.left !== stone.right} />)}</div>{!view.board.length && <p className="domino-board-empty">{view.handNumber === 1 ? 'A saída é com o 6–6.' : 'Aguardando a primeira pedra.'}</p>}</div>
    {(view.status === 'between' || view.status === 'finished' || view.status === 'cancelled') && <div className="domino-result" role="region" aria-label="Resultado do dominó"><h2>{view.status === 'cancelled' ? 'Mesa encerrada.' : view.status === 'finished' ? view.winner === team ? 'Essa foi da sua dupla!' : 'A outra dupla venceu.' : view.result?.winner === null ? 'Tranca empatada!' : view.result?.reason === 'batida' ? `${view.result.name} bateu!` : 'Jogo trancado!'}</h2><p>{view.status === 'cancelled' ? view.lastMove : view.result ? `${view.result.winner === null ? 'Ninguém pontua' : `${view.result.winner === team ? 'Sua dupla' : 'A outra dupla'} recebe ${view.result.points} pontos`}.` : view.lastMove}</p>{view.result && <small>Pedras restantes: sua dupla {view.result.totals[team]} · adversários {view.result.totals[1 - team]}</small>}{view.status === 'between' ? <span>Novas pedras em {seconds}s</span> : <button className="domino-button domino-primary" disabled={busy || view.rematchVotes.includes(view.playerId)} onClick={() => void command({ type: 'rematch' })}>{view.rematchVotes.includes(view.playerId) ? 'Aguardando os amigos…' : view.winner === team ? 'Jogar novamente' : 'Pedir revanche'}</button>}</div>}</>}
    </div>
    {view.status === 'playing' && <section className="domino-own-hand" aria-label="Suas pedras"><p className="domino-last-move" aria-live="polite">{view.lastMove}</p><div className="domino-hand-stones">{view.hand.map(stone => <button className={`domino-stone-button ${selected === stone.id ? 'stone-selected' : ''}`} key={stone.id} disabled={busy || !view.legal.moves.some(move => move.id === stone.id)} aria-label={`Jogar pedra ${stone.a} e ${stone.b}`} onClick={() => play(stone.id)}><DominoStone a={stone.a} b={stone.b} /></button>)}</div>{selected && <div className="domino-end-choice" role="group" aria-label="Escolha a ponta"><span>Onde encaixar?</span>{view.legal.moves.find(m => m.id === selected)?.ends.map(end => <button className="domino-button" key={end} disabled={busy} onClick={() => play(selected, end)}>{end === 'left' ? `Esquerda · ${view.board[0].left}` : `Direita · ${view.board.at(-1)!.right}`}</button>)}<button className="domino-button" aria-label="Cancelar seleção" onClick={() => setSelected(null)}>×</button></div>}{view.legal.pass && <button className="domino-button domino-primary" disabled={busy} onClick={() => void command({ type: 'pass' })}>Passar — sem encaixe</button>}</section>}
    </section><aside className="domino-sidebar">{view.status === 'waiting' && <section className="domino-panel domino-waiting"><h2>Fechou a formação?</h2><p>As duplas ficam em posições opostas.</p><button className="domino-button domino-primary" disabled={busy || !view.legal.ready} onClick={() => void command({ type: 'ready' })}>{self?.ready ? 'Você está pronto ✓' : 'Estou pronto'}</button>{view.legal.fillBots && <button className="domino-button" disabled={busy} onClick={() => void command({ type: 'fill-bots' })}>Completar com bots</button>}<small>{view.players.filter(p => p.ready).length} de 4 prontos</small></section>}<RoomSocial playerId={view.playerId} chat={view.chat} busy={busy} onSend={command} /></aside></div></>}
  </main>;
}
