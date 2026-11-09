'use client';

import { useEffect, useRef, useState } from 'react';

type SoundView = {
  serverTime?: number | string; status: string; handNumber: number; handStartedAt?: number; mode: string;
  trickNumber: number; trick: { seat: number }[];
  pending: { id?: string | null; proposed: number; team: number } | null;
};
const preferenceKey = 'truco-sound-muted';

// Synthesized locally: no downloads, microphone access or third-party audio.
class TableAudio {
  context: AudioContext | null = null;
  sources = new Set<AudioScheduledSourceNode>();
  muted = false;
  unlock() {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Audio is optional; unsupported browsers still play normally. */ }
  }
  stop() {
    for (const source of this.sources) { try { source.stop(); } catch {} }
    this.sources.clear();
  }
  dispose() { this.stop(); void this.context?.close().catch(() => {}); }
  sound(kind: 'shuffle' | 'deal' | 'play' | 'truco', seats = 2, delay = 0) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted || document.hidden) return;
    const start = ctx.currentTime + delay;
    const track = (source: AudioScheduledSourceNode, nodes: AudioNode[]) => {
      this.sources.add(source);
      source.onended = () => { this.sources.delete(source); source.disconnect(); nodes.forEach(n => n.disconnect()); };
    };
    const rustle = (delay: number, duration: number, level: number, frequency: number) => {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .6;
      const at = start + delay;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + .008);
      gain.gain.exponentialRampToValueAtTime(.001, at + duration);
      source.connect(filter).connect(gain).connect(ctx.destination);
      track(source, [filter, gain]); source.start(at); source.stop(at + duration);
    };
    if (kind === 'shuffle') {
      for (let i = 0; i < 9; i++) rustle(i * .065, .07, .14, 1800 + i % 3 * 500);
      for (let i = 0; i < seats * 3; i++) rustle(.7 + i * (seats === 4 ? .17 : .34), .11, .16, 2800);
    } else if (kind === 'truco') {
      [330, 440, 660].forEach((frequency, i) => {
        const source = ctx.createOscillator(), gain = ctx.createGain(), at = start + i * .09;
        source.type = 'triangle'; source.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.12, at + .015);
        gain.gain.exponentialRampToValueAtTime(.001, at + .22);
        source.connect(gain).connect(ctx.destination); track(source, [gain]);
        source.start(at); source.stop(at + .23);
      });
    } else rustle(0, kind === 'play' ? .16 : .11, .22, kind === 'play' ? 900 : 2800);
  }
}

export function TableSound({ view }: { view: SoundView | null }) {
  const [muted, setMuted] = useState(false);
  const audio = useRef<TableAudio | null>(null);
  const previous = useRef<SoundView | null>(null);
  useEffect(() => {
    const engine = new TableAudio(); audio.current = engine;
    try { engine.muted = localStorage.getItem(preferenceKey) === 'true'; } catch {}
    setMuted(engine.muted);
    const unlock = () => engine.unlock();
    const visibility = () => { if (document.hidden) engine.stop(); };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', visibility);
      engine.dispose(); audio.current = null;
    };
  }, []);
  useEffect(() => {
    const old = previous.current; previous.current = view;
    if (!view || !old || view.status !== 'playing') return;
    const newHand = view.handStartedAt !== old.handStartedAt || view.handNumber !== old.handNumber || old.status !== 'playing';
    if (newHand) {
      audio.current?.stop(); audio.current?.sound('shuffle', view.mode === '2x2' ? 4 : 2, Math.max(0, (view.handStartedAt ?? 0) - (typeof view.serverTime === 'number' ? view.serverTime : view.serverTime ? new Date(view.serverTime).getTime() : Date.now())) / 1000);
      return;
    }
    const sameTrick = view.trickNumber === old.trickNumber;
    if (view.trick.some(play => !sameTrick || !old.trick.some(p => p.seat === play.seat))) audio.current?.sound('play');
    if (view.pending && (!old.pending || view.pending.id !== old.pending.id || view.pending.proposed !== old.pending.proposed || view.pending.team !== old.pending.team)) audio.current?.sound('truco');
  }, [view]);
  function toggle() {
    const next = !muted; setMuted(next);
    try { localStorage.setItem(preferenceKey, String(next)); } catch {}
    if (audio.current) {
      audio.current.muted = next;
      if (next) audio.current.stop(); else audio.current.unlock();
    }
  }
  return <button className="table-sound-toggle" type="button" onClick={toggle} aria-label={muted ? 'Ativar sons' : 'Silenciar sons'} aria-pressed={muted} title={muted ? 'Ativar sons' : 'Silenciar sons'}>
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4 6 8H3v8h3l5 4Z" />
      {muted ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
    </svg>
  </button>;
}
