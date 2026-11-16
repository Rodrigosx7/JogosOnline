export const SIGNAL_DURATION_MS = 1000;
export const SIGNAL_OPTIONS = [
  { kind: 'zap', label: 'Zap', emoji: '😉' },
  { kind: 'copeta', label: 'Copeta', emoji: '😏' },
  { kind: 'espadilha', label: 'Espadilha', emoji: '😛' },
  { kind: 'pica-fumo', label: 'Pica-fumo', emoji: '😗' },
  { kind: 'strong', label: 'Carta forte', emoji: '💪' },
  { kind: 'weak', label: 'Sem jogo', emoji: '🤏' },
  { kind: 'ack', label: 'Entendi', emoji: '👍' },
  { kind: 'phrase-0', label: 'ladraoo', emoji: 'ladraoo' },
  { kind: 'phrase-1', label: 'truco covarde', emoji: 'truco covarde' },
  { kind: 'phrase-2', label: 'seu barriga', emoji: 'seu barriga' },
  { kind: 'phrase-3', label: 'arigato', emoji: 'arigato' },
  { kind: 'phrase-4', label: 'alcoolatra', emoji: 'alcoolatra' },
  { kind: 'phrase-5', label: 'recebaaa', emoji: 'recebaaa' },
  { kind: 'phrase-6', label: 'poar', emoji: 'poar' },
  { kind: 'phrase-7', label: 'baleia jubarte', emoji: 'baleia jubarte' },
] as const;
export type SignalKind = typeof SIGNAL_OPTIONS[number]['kind'];
export type ChatMessage = { id: string; playerId: string; name: string; text: string; at: number };
export type PartnerSignal = { id: string; playerId: string; team: number; kind: SignalKind; at: number };
