// Shared by the authoritative game and the tutorial. This module has no server dependencies.
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
export const SUITS = ['clubs', 'hearts', 'spades', 'diamonds'] as const;
export const BIDS = [3, 5, 7, 9, 11];
export const SCORE_STEPS = [0, 3, 5, 7, 9, 11];
export type RuleCard = { id: string; rank: string; suit: string };

export function cardStrength(card: RuleCard): number {
  const special = ['7-diamonds', 'A-spades', '7-hearts', '4-clubs'].indexOf(`${card.rank}-${card.suit}`);
  return special >= 0 ? 20 + special : RANKS.indexOf(card.rank) + 1;
}
export function makeDeck() {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ id: `${rank}-${suit}`, rank, suit })));
}
export function scoreAfterWin(previous: number, amount: number) {
  const current = SCORE_STEPS.findLastIndex(score => score <= previous);
  const advance = BIDS.indexOf(amount) + 1;
  // The house has a specific jump for a truco won from five.
  return { score: amount === 5 && previous === 5 ? 11 : SCORE_STEPS[current + advance] ?? 11,
    victory: current + advance >= SCORE_STEPS.length };
}
export function handWinner(results: (number | null)[]): number | null | undefined {
  const [a, b, c] = results;
  if (results.length >= 2) {
    if (a === null && b !== null) return b;
    if (a !== null && (b === null || b === a)) return a;
  }
  if (results.length === 3) {
    if (c !== null) return c;
    return a ?? b ?? null;
  }
  return undefined;
}
