'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DominoIcon, DominoRules, DominoStone } from '@/components/DominoPieces';
import './domino.css';

export default function DominoHome() {
  const router = useRouter();
  const [name, setName] = useState(''), [code, setCode] = useState(''), [listed, setListed] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [rooms, setRooms] = useState<{ code: string; host: string; players: number }[]>([]);
  const [listError, setListError] = useState(false);
  useEffect(() => {
    setName(localStorage.getItem('truco-name') ?? '');
    async function refresh() {
      if (document.hidden) return;
      try { const response = await fetch('/api/domino/rooms'); if (!response.ok) throw Error(); const data = await response.json(); setRooms(data.rooms); setListError(false); }
      catch { setListError(true); }
    }
    void refresh(); const timer = setInterval(refresh, 5000); return () => clearInterval(timer);
  }, []);
  async function create(event: FormEvent, practice = false) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/domino/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), listed, practice }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      localStorage.setItem('truco-name', name.trim()); router.push(`/domino/room/${data.code}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível abrir a mesa.'); setBusy(false); }
  }
  return <main className="domino-page"><header className="domino-header"><a className="domino-brand" href="/domino"><DominoIcon /><span>dominó <small>da casa</small></span></a><nav><a href="/">♣ Truco</a><a href="/sinuca">🎱 Sinuca</a><a href="#domino-rules">Como jogar</a></nav></header>
    <section className="domino-home-grid"><div className="domino-intro"><span className="domino-eyebrow">Sete pedras. Uma boa parceria.</span><h1>Encaixe a pedra.<br />Chame a turma.</h1><p>Dominó em duplas, do jeito de casa. Jogue com amigos ou complete a mesa com bots.</p><div className="domino-art" aria-hidden="true"><DominoStone a={6} b={6} /><DominoStone a={6} b={4} /><DominoStone a={3} b={2} /></div><p className="domino-format">2 × 2 · Duplo-seis · Sem compra · Até 100</p></div>
    <section className="domino-panel"><h2>Vamos abrir uma mesa?</h2><p>Você e seu parceiro contra a outra dupla.</p><form onSubmit={event => void create(event)}><label htmlFor="domino-name">Como te chamam?</label><input id="domino-name" required minLength={2} maxLength={24} autoComplete="nickname" placeholder="Seu apelido" value={name} onChange={event => setName(event.target.value)} /><label className="domino-checkbox"><input type="checkbox" checked={listed} onChange={event => setListed(event.target.checked)} />Mostrar nas salas abertas de dominó</label>{error && <p className="error" role="alert">{error}</p>}<button className="domino-button domino-primary" disabled={busy}>{busy ? 'Abrindo…' : 'Criar mesa de dominó'}</button><button className="domino-button" type="button" disabled={busy} onClick={event => { if (event.currentTarget.form?.reportValidity()) void create(event, true); }}>Treinar com bots</button></form>
      <form className="domino-invite-form" onSubmit={event => { event.preventDefault(); const value = code.trim().split('/').filter(Boolean).pop(); if (value && /^[A-Za-z0-9_-]{18,64}$/.test(value)) router.push(`/domino/room/${value}`); else setError('Confira o código ou link da mesa de dominó.'); }}><label htmlFor="domino-code">Já tem um convite?</label><div><input id="domino-code" placeholder="Código ou link do dominó" required value={code} onChange={event => setCode(event.target.value)} /><button className="domino-button">Entrar</button></div></form></section>
    <section className="domino-panel domino-open"><h2>Salas abertas</h2><p>Escolha uma mesa com lugar livre.</p>{listError && <p role="alert">Não foi possível atualizar as salas.</p>}{!rooms.length ? <p className="domino-empty">A primeira mesa pode ser a sua.</p> : <ul>{rooms.map(room => <li key={room.code}><div><strong>Mesa de {room.host}</strong><small>{room.players} de 4 jogadores</small></div><a className="domino-button" href={`/domino/room/${room.code}`}>Entrar</a></li>)}</ul>}</section></section>
    <section id="domino-rules" className="domino-home-rules"><h2>O combinado da mesa</h2><DominoRules /></section></main>;
}
