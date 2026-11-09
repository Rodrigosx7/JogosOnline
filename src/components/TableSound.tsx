'use client';

import { useEffect, useRef, useState } from 'react';
import type {CustomConfig,SoundEvent} from '../lib/custom-mode';

type SoundView = {
  code?:string;playerId?:string;players?:{id:string;seat:number|null}[];winner?:number|null;
  custom?:{config:CustomConfig;scoreMode:string}|null;handNotice?:{id:string;decision:string}|null;
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
  sound(kind: 'shuffle' | 'deal' | 'play' | 'truco', seats = 2, delay = 0, skipDeal=false) {
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
      if(!skipDeal)for (let i = 0; i < seats * 3; i++) rustle(.7 + i * (seats === 4 ? .17 : .34), .11, .16, 2800);
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
  const clips=useRef(new Set<HTMLAudioElement>()),timers=useRef(new Set<ReturnType<typeof setTimeout>>()),unlocked=useRef(false);
  function stopClips(){for(const timer of timers.current)clearTimeout(timer);timers.current.clear();for(const clip of clips.current){clip.pause();clip.src='';}clips.current.clear();}
  function playClip(event:SoundEvent,delay=0){const asset=view?.custom?.config.sounds[event];if(!asset||!view?.code)return false;if(muted||!unlocked.current||document.hidden)return true;const url=`/api/rooms/${encodeURIComponent(view.code)}/assets/${asset}`;const play=()=>{if(muted||document.hidden)return;const clip=new Audio(url);clip.volume=.8;clips.current.add(clip);clip.onended=()=>clips.current.delete(clip);clip.onerror=()=>clips.current.delete(clip);void clip.play().catch(()=>clips.current.delete(clip));};if(delay>0){const timer=setTimeout(()=>{timers.current.delete(timer);play();},delay*1000);timers.current.add(timer);}else play();return true;}
  useEffect(() => {
    const engine = new TableAudio(); audio.current = engine;
    try { engine.muted = localStorage.getItem(preferenceKey) === 'true'; } catch {}
    setMuted(engine.muted);
    const unlock = () => {unlocked.current=true;engine.unlock();};
    const visibility = () => { if (document.hidden) {engine.stop();stopClips();} };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', visibility);
      engine.dispose(); stopClips();audio.current = null;
    };
  }, []);
  useEffect(() => {
    const old = previous.current; previous.current = view;
    if (!view || !old) return;
    if(view.status==='finished'&&old.status!=='finished'&&view.winner!==null&&view.winner!==undefined){const self=view.players?.find(p=>p.id===view.playerId);if(self?.seat!==null&&self?.seat!==undefined)playClip(view.winner===self.seat%2?'win':'lose');}
    if(view.status!=='playing')return;
    if(view.handNotice&&view.handNotice.id!==old.handNotice?.id)playClip(view.handNotice.decision==='run'?'run':'accept');
    const newHand = view.handStartedAt !== old.handStartedAt || view.handNumber !== old.handNumber || old.status !== 'playing';
    if (newHand) {
      audio.current?.stop();
      const delay=Math.max(0,(view.handStartedAt??0)-(typeof view.serverTime==='number'?view.serverTime:view.serverTime?new Date(view.serverTime).getTime():Date.now()))/1000;
      const customShuffle=playClip('shuffle',delay),customDeal=playClip('deal',delay+.7);
      if(!customShuffle)audio.current?.sound('shuffle',view.mode==='2x2'?4:2,delay,!!view.custom?.config.sounds.deal);
      else if(!customDeal)audio.current?.sound('deal',view.mode==='2x2'?4:2,delay+.7);
      return;
    }
    const sameTrick = view.trickNumber === old.trickNumber;
    if (view.trick.some(play => !sameTrick || !old.trick.some(p => p.seat === play.seat))) if(!playClip('play'))audio.current?.sound('play');
    if (view.pending && (!old.pending || view.pending.id !== old.pending.id || view.pending.proposed !== old.pending.proposed || view.pending.team !== old.pending.team)) if(!playClip(({5:'truco',7:'six',9:'nine',11:'eleven'} as Record<number,SoundEvent>)[view.pending.proposed]))audio.current?.sound('truco');
  }, [view]);
  function toggle() {
    const next = !muted; setMuted(next);
    try { localStorage.setItem(preferenceKey, String(next)); } catch {}
    if (audio.current) {
      audio.current.muted = next;
      if (next) {audio.current.stop();stopClips();} else audio.current.unlock();
    }
  }
  return <button className="table-sound-toggle" type="button" onClick={toggle} aria-label={muted ? 'Ativar sons' : 'Silenciar sons'} aria-pressed={muted} title={muted ? 'Ativar sons' : 'Silenciar sons'}>
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4 6 8H3v8h3l5 4Z" />
      {muted ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
    </svg>
  </button>;
}
