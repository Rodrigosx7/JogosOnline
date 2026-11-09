'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type OpenRoom = { code: string; mode: '1x1' | '2x2'; host: string; players: number; capacity: number };

export function OpenRooms() {
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const refresh = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    setRefreshing(true);
    try {
      const response = await fetch('/api/rooms', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Não foi possível atualizar as salas.');
      const data = await response.json();
      setRooms(data.rooms);
      setError('');
    } catch {
      setError('Não foi possível atualizar as salas. Tente novamente.');
    } finally {
      active.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <section className="landing-rooms" aria-labelledby="open-rooms-title">
      <div className="landing-rooms-heading">
        <h2 id="open-rooms-title">Salas abertas</h2>
        <span className="landing-live-badge"><span aria-hidden="true" />Ao vivo</span>
      </div>
      <div className="landing-rooms-toolbar">
        <p>Tem lugar livre. Escolha uma mesa e entre.</p>
        <button type="button" disabled={refreshing} onClick={() => void refresh()}><span aria-hidden="true">↻</span>{refreshing ? 'Atualizando…' : 'Atualizar salas'}</button>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {loading ? <p className="landing-rooms-empty" role="status">Procurando mesas…</p> : !rooms.length ? (
        <div className="landing-rooms-empty">
          <span aria-hidden="true">♣</span>
          <div><h3>A primeira mesa pode ser a sua.</h3><p>Nenhuma sala com vagas agora. Crie uma mesa e convide a turma.</p></div>
          <a href="#nickname" onClick={() => document.getElementById('nickname')?.focus()}>Abrir uma mesa <span aria-hidden="true">→</span></a>
        </div>
      ) : (
        <ul className="landing-room-list">
          {rooms.map(room => (
            <li key={room.code} data-testid="open-room" data-room-code={room.code}>
              <div className="landing-room-avatars" aria-hidden="true">
                <span>{room.host.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span>
                <span>{room.players > 1 ? `+${room.players - 1}` : '♣'}</span>
              </div>
              <div className="landing-room-info"><h3>Mesa de {room.host}</h3><p>{room.players} de {room.capacity} jogadores <span>· {room.mode === '2x2' ? 'Em duplas' : 'Cara a cara'}</span></p></div>
              <a href={`/room/${room.code}`}>Entrar <span aria-hidden="true">→</span></a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
