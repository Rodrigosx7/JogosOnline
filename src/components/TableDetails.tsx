import type { ReactNode } from 'react';

export function TableTentos({ scores, selfTeam }: { scores: number[]; selfTeam: number }) {
  return <div className="table-tentos" aria-label="Tentos na mesa">{[selfTeam, 1 - selfTeam].map((team, index) => <div key={team} className={`tento-pile tento-pile-${index}`} role="img" aria-label={`${index === 0 ? 'Nós' : 'Eles'}: ${scores[team]} tentos`} data-testid="tento-pile" data-team={team} data-score={scores[team]}><span className="tento-label">{index === 0 ? 'Nós' : 'Eles'} <b>{scores[team]}</b></span><div className="tento-seeds" aria-hidden="true">{Array.from({ length: scores[team] }, (_, i) => <i className="tento-seed" key={i} data-testid="tento-seed" style={{ transform: `rotate(${[22, -28, 65, -12, 38][i % 5]}deg) translateY(${i % 2 ? 2 : -1}px)` }} />)}{scores[team] === 0 && <span className="tento-zero">—</span>}</div></div>)}</div>;
}

export function TrucoRequest({ proposed, caller, canRespond, waitingForPartner = false, seconds, children }: { proposed: number; caller: string; canRespond: boolean; waitingForPartner?: boolean; seconds: number; children: ReactNode }) {
  return <section className="hand-truco-request" role="alertdialog" aria-label={`Pedido de ${proposed} tentos de ${caller}`} aria-describedby="truco-request-description" data-testid="truco-overlay"><p id="truco-request-description" className="hand-truco-caption"><strong>{caller} {proposed === 5 ? 'trucou!' : 'aumentou!'}</strong><span>{proposed} tentos</span></p>{canRespond ? <div className="hand-truco-responses">{children}</div> : <p className="hand-truco-waiting">{waitingForPartner ? 'Você correu. Aguarde seu parceiro.' : 'Aguardando resposta…'}</p>}<span className="hand-truco-seconds">{seconds}s</span></section>;
}

export function BidIcon() {
  return <svg className="bid-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V5a2 2 0 0 1 4 0v7M12 10V4a2 2 0 0 1 4 0v8M16 10V7a2 2 0 0 1 4 0v8c0 5-3 7-7 7h-1c-3 0-5-2-6-4l-3-5a2 2 0 0 1 3-2l2 2" /></svg>;
}

export function TrickResults({ results, selfTeam, mode, handNumber, previous = false, complete = false }: { results: (number | null)[]; selfTeam: number; mode: string; handNumber: number; previous?: boolean; complete?: boolean }) {
  return <section className="trick-results" data-previous={previous} aria-label="Resultados das vazas"><h3>Vazas <small>{previous ? 'Mão anterior' : 'Mão'} {handNumber}</small></h3><ol>{[0, 1, 2].map(index => {
    const result = results[index];
    const outcome = result === undefined ? 'pending' : result === null ? 'draw' : result === selfTeam ? 'won' : 'lost';
    const text = result === undefined ? complete ? 'Não disputada' : 'Aguardando' : result === null ? 'Empate' : result === selfTeam ? mode === '2x2' ? 'Sua dupla' : 'Você' : mode === '2x2' ? 'Adversários' : 'Adversário';
    return <li key={index} className={`trick-result-${outcome}`} data-testid="trick-result" data-outcome={outcome}><strong>Vaza {index + 1}</strong><span>{outcome === 'won' ? '✓ ' : outcome === 'lost' ? '× ' : ''}{text}</span></li>;
  })}</ol></section>;
}
