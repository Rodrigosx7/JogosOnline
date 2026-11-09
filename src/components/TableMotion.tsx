import { CSSProperties } from 'react';
import { PlayingCard } from './Cards';
export const DEAL_ANIMATION_MS = 3300;

export function DealAnimation({ seats, selfSeat }: { seats: number; selfSeat: number | null | undefined }) {
  return <div className="deal-animation" data-testid="dealing-animation" role="status" aria-label="Embaralhando e distribuindo as cartas"><div className="shuffle-stack" aria-hidden="true"><PlayingCard back small /><PlayingCard back small /><PlayingCard back small /></div>{Array.from({ length: seats * 3 }, (_, i) => {
    const seat = i % seats; const relative = selfSeat == null ? seat : (seat - selfSeat + seats) % seats;
    const position = relative === 0 ? ['50%', '83%'] : seats === 2 || relative === 2 ? ['50%', '17%'] : relative === 1 ? ['13%', '50%'] : ['87%', '50%'];
    return <span key={i} className="dealt-card" data-deal-seat={seat} style={{ '--deal-left': position[0], '--deal-top': position[1], '--deal-delay': `${700 + i * (seats === 4 ? 170 : 340)}ms`, '--deal-offset': `${(Math.floor(i / seats) - 1) * 16}px`, '--deal-rotation': `${(Math.floor(i / seats) - 1) * 9}deg` } as CSSProperties} aria-hidden="true"><PlayingCard back small /></span>;
  })}<span className="deal-caption">Embaralhando e distribuindo…</span></div>;
}

export function TrucoCallout({ proposed }: { proposed: number }) {
  return <div className="truco-callout" data-testid="truco-callout" role="status"><span data-testid="truco-overlay"><strong>{proposed === 5 ? 'TRUCO!' : `VALE ${proposed}!`}</strong><span>Vale {proposed} tentos</span></span></div>;
}
