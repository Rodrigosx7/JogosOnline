'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { OpenRooms } from '../components/OpenRooms';
import { DominoIcon } from '../components/DominoPieces';
import { TrucoTutorial } from '../components/TrucoTutorial';
import './home.css';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mode, setMode] = useState('1x1');
  const [variant,setVariant]=useState('normal'),[scoreMode,setScoreMode]=useState('normal');
  const [code, setCode] = useState('');
  const [tableTheme, setTableTheme] = useState('classic');
  const [listed, setListed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(event: FormEvent, practice = false) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), mode, variant, scoreMode:variant==='custom'?scoreMode:'normal', tableTheme, practice, listed: listed && !practice }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível abrir a mesa. Tente novamente.');
      localStorage.setItem('truco-name', name.trim());
      router.push(`/room/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confira sua conexão e tente novamente.');
      setBusy(false);
    }
  }

  function join(event: FormEvent) {
    event.preventDefault();
    const value = code.trim().split('/').filter(Boolean).pop()?.replace(/[^a-zA-Z0-9_-]/g, '');
    if (value) router.push(`/room/${value}`);
  }

  return (
    <main className="landing">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="Truco da casa, início">
          <span className="landing-brand-club" aria-hidden="true">♣</span>
          <span>truco<small>da casa</small></span>
        </a>
        <p className="landing-header-note">Baralho na mesa. Amigos por perto.</p>
        <nav className="landing-nav" aria-label="Navegação principal"><a className="landing-domino-link" href="/domino"><DominoIcon />Dominó</a>
          <a className="landing-rules-link" href="#regras">Como jogar</a>
          <a className="landing-nav-join" href="#room-code" onClick={() => document.getElementById('room-code')?.focus()}>Entrar na mesa</a>
        </nav>
        <span className="landing-header-ornament" aria-hidden="true">♣</span>
      </header>

      <section className="landing-hero" aria-labelledby="welcome-title">
        <div className="landing-intro">
          <p className="landing-eyebrow">O bom e velho truco. Agora online.</p>
          <h1 id="welcome-title">Pode chegar.<br />A mesa é sua.</h1>
          <p className="landing-description">Chame a turma, distribua as cartas e deixe o blefe por sua conta.</p>
          <div className="landing-art">
            <Image src="/images/truco-felt-cards.png"
              alt="As quatro manilhas do truco: sete de ouros, ás de espadas, sete de copas e quatro de paus sobre uma mesa de feltro verde."
              width={1840} height={855}
              sizes="(max-width: 600px) 94vw, (max-width: 900px) 540px, (max-width: 1100px) 51vw, 760px" preload />
          </div>
          <div className="landing-caption">
            <span>Sem download</span><i aria-hidden="true">·</i><span>Sem cadastro</span><i aria-hidden="true">·</i><span>Só chamar e jogar</span>
          </div>
          <a className="landing-tutorial-link" href="#regras">Aprender a jogar</a>
        </div>

        <div className="landing-panel">
          <div className="landing-panel-ribbon"><span aria-hidden="true">♣</span>Tem lugar para você.</div>
          <div className="landing-panel-body">
            <form className="landing-create" onSubmit={create} aria-busy={busy}>
              <h2>Vamos abrir uma mesa?</h2>
              <p className="landing-form-description">Você cria. Seus amigos chegam pelo convite.</p>
              <label htmlFor="nickname">Como te chamam?</label>
              <input id="nickname" placeholder="Seu apelido" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={24} required autoComplete="nickname" />
              <fieldset className="landing-modes variant-picker"><legend>Qual modo vamos jogar?</legend><div><button type="button" aria-pressed={variant==='normal'} onClick={()=>setVariant('normal')}><span>Normal</span><small>Regras da casa</small></button><button type="button" aria-pressed={variant==='custom'} onClick={()=>setVariant('custom')}><span>Personalizado</span><small>Fotos e áudios da turma</small></button></div></fieldset>{variant==='custom'&&<fieldset className="landing-modes variant-picker"><legend>Como puxar os tentos?</legend><div><button type="button" aria-pressed={scoreMode==='normal'} onClick={()=>setScoreMode('normal')}><span>Tentos normais</span><small>Placar automático</small></button><button type="button" aria-pressed={scoreMode==='manual'} onClick={()=>setScoreMode('manual')}><span>Tentos manuais</span><small>Placar livre; todos votam para encerrar</small></button></div></fieldset>}<fieldset className="landing-modes">
                <legend>Qual é a formação?</legend>
                <div>
                  <button type="button" aria-pressed={mode === '1x1'} onClick={() => setMode('1x1')}><span>1 × 1</span><small>Cara a cara</small></button>
                  <button type="button" aria-pressed={mode === '2x2'} onClick={() => setMode('2x2')}><span>2 × 2</span><small>Em duplas</small></button>
                </div>
              </fieldset>
              <fieldset className="landing-modes table-theme-picker"><legend>Escolha a mesa</legend><div><button type="button" aria-pressed={tableTheme === 'classic'} onClick={() => setTableTheme('classic')}><span className="theme-swatch theme-classic" /><small>Clássica</small></button><button type="button" aria-pressed={tableTheme === 'skol'} onClick={() => setTableTheme('skol')}><span className="theme-swatch theme-skol">SKOL</span><small>Mesa de bar</small></button></div></fieldset><label className="landing-public-option"><input type="checkbox" checked={listed} onChange={event => setListed(event.target.checked)} />Mostrar na lista de salas abertas</label>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="landing-button landing-primary" disabled={busy} type="submit">{busy ? 'Abrindo a mesa…' : 'Criar minha mesa'}<span aria-hidden="true">→</span></button>
              <button className="landing-button landing-practice" disabled={busy} type="button" onClick={event => {
                if (event.currentTarget.form?.reportValidity()) void create(event, true);
              }}>{mode === '2x2' ? 'Treinar com bots' : 'Treinar contra bot'}</button>
              {!listed && <p className="landing-private-note">Sala privada. Entrada somente por convite.</p>}
            </form>
            <form onSubmit={join} className="landing-invite">
              <label htmlFor="room-code">Já tem um convite?</label>
              <div><input id="room-code" placeholder="Código ou link da mesa" value={code} onChange={e => setCode(e.target.value)} required maxLength={200} autoCapitalize="none" spellCheck={false} /><button className="landing-button landing-primary" type="submit">Entrar <span aria-hidden="true">→</span></button></div>
            </form>
          </div>
        </div>
        <OpenRooms />
      </section>

      <section id="regras" className="landing-rules" aria-label="Tutorial completo do Truco da Casa"><TrucoTutorial /></section>
      <footer className="landing-footer"><span>Truco da casa</span><p>A melhor parte é quem senta à mesa.</p><a href="/admin">Administração</a></footer>
    </main>
  );
}
