'use client';
import { useEffect, useRef, useState } from 'react';
import { SIGNAL_OPTIONS, type ChatMessage, type PartnerSignal } from '../lib/social';

type Props = { playerId: string; chat: ChatMessage[]; busy: boolean; onSend: (command: Record<string, unknown>) => Promise<boolean | undefined> };
export function RoomSocial({ playerId, chat, busy, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const lastMessage = chat.at(-1)?.id;
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [lastMessage]);
  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    if (await onSend({ type: 'chat', text })) setDraft('');
  }
  return <section className="room-social" aria-label="Chat e sinais">
    <div className="room-chat"><h3>Chat da sala</h3><div className="chat-messages" ref={log} role="log" aria-label="Mensagens da sala" aria-live="polite" aria-relevant="additions">{chat.length ? chat.map(message => <div className={`chat-message ${message.playerId === playerId ? 'chat-own' : ''}`} key={message.id}><div><strong>{message.name}</strong><time dateTime={new Date(message.at).toISOString()}>{new Date(message.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p></div>) : null}</div><form onSubmit={sendMessage} className="chat-form"><label className="sr-only" htmlFor="chat-message">Mensagem para todos da sala</label><textarea id="chat-message" maxLength={240} rows={2} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy && draft.trim()) event.currentTarget.form?.requestSubmit(); } }} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Sua mensagem…" /><div><small>{draft.length}/240</small><button className="button primary" type="submit" disabled={busy || !draft.trim()}>Enviar</button></div></form></div>
  </section>;
}

export function HandSignals({ signals, playerId, busy, now, onSend }: { signals: PartnerSignal[]; playerId: string; busy: boolean; now: number; onSend: Props['onSend'] }) {
  const own = signals.findLast(signal => signal.playerId === playerId);
  const cooling = !!own && now - own.at < 2000;
  return <div className="hand-signals" role="group" aria-label="Sinais da mesa">{SIGNAL_OPTIONS.map(signal => <button key={signal.kind} type="button" disabled={busy || cooling} onClick={() => void onSend({ type: 'signal', kind: signal.kind })} aria-label={`Sinalizar ${signal.label}`}><span aria-hidden="true">{signal.emoji}</span></button>)}</div>;
}
