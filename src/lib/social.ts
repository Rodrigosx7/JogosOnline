export const SIGNAL_DURATION_MS = 1000;
export const SIGNAL_OPTIONS = [
  { kind: 'zap', label: 'Zap', emoji: '😉' },
  { kind: 'copeta', label: 'Copeta', emoji: '😏' },
  { kind: 'espadilha', label: 'Espadilha', emoji: '😛' },
  { kind: 'pica-fumo', label: 'Pica-fumo', emoji: '😗' },
  { kind: 'strong', label: 'Carta forte', emoji: '💪' },
  { kind: 'weak', label: 'Sem jogo', emoji: '🤏' },
  { kind: 'ack', label: 'Entendi', emoji: '👍' },
] as const;
export type SignalKind = typeof SIGNAL_OPTIONS[number]['kind'];
export type ChatMessage = { id: string; playerId: string; name: string; text: string; at: number };
export type PartnerSignal = { id: string; playerId: string; team: number; kind: SignalKind; at: number };
