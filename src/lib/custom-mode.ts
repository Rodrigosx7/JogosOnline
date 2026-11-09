export const SOUND_EVENTS = ['shuffle', 'deal', 'play', 'truco', 'six', 'nine', 'eleven', 'accept', 'run', 'win', 'lose'] as const;
export type SoundEvent = typeof SOUND_EVENTS[number];
export const SOUND_LABELS: Record<SoundEvent,string> = { shuffle:'Embaralhar',deal:'Distribuir',play:'Jogar carta',truco:'Truuuco!',six:'Seeeis!',nine:'Nooove!',eleven:'Onze!',accept:'Aceitou',run:'Correu',win:'Vitória',lose:'Derrota' };
export type CustomConfig = { version: string; name: string; enabled: boolean; cards: Record<string,string>; sounds: Partial<Record<SoundEvent,string>> };
export const defaultCustomConfig = (): CustomConfig => ({ version:'initial',name:'Mesa dos amigos',enabled:true,cards:{},sounds:{} });
export const validAssetId = (id: string) => /^[a-f0-9-]{36}\.(png|jpg|webp|mp3|ogg|wav)$/.test(id);
export function referencedAsset(config: CustomConfig, id: string) { return validAssetId(id) && [...Object.values(config.cards),...Object.values(config.sounds)].includes(id); }
