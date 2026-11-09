import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Room } from '../game';

export interface Document<T> { state: T; requests: Record<string, string[]> }
export interface Stored<T> { version: number; document: Document<T> }
export interface RoomStore {
  listOpen(): Promise<Room[]>;
  get<T>(code: string): Promise<Stored<T> | null>;
  create<T>(code: string, document: Document<T>): Promise<boolean>;
  compareAndSwap<T>(code: string, version: number, document: Document<T>): Promise<boolean>;
}

const locks = new Map<string, Promise<unknown>>();
export async function serialized<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(action);
  locks.set(key, current);
  try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
}

// Development adapter: one Node process, persistent disk. Production uses Postgres CAS.
export class FileRoomStore implements RoomStore {
  constructor(private directory = path.join(process.cwd(), '.data', 'rooms')) {}
  async listOpen() {
    let files: string[];
    try { files = await readdir(this.directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    const rooms = await Promise.all(files.filter(file => /^[A-Za-z0-9_-]{18,64}\.json$/.test(file)).map(file => this.get<Room>(file.slice(0, -5))));
    return rooms.flatMap(room => room?.document.state.listed && room.document.state.status === 'waiting' ? [room.document.state] : []);
  }
  private file(code: string) {
    if (!/^[A-Za-z0-9_-]{18,64}$/.test(code)) throw new Error('Invalid room code');
    return path.join(this.directory, `${code}.json`);
  }
  async get<T>(code: string): Promise<Stored<T> | null> {
    try { return JSON.parse(await readFile(this.file(code), 'utf8')) as Stored<T>; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  private async write<T>(code: string, value: Stored<T>) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = this.file(code), temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await rename(temporary, target);
  }
  async create<T>(code: string, document: Document<T>) {
    return serialized(`file:${this.directory}:${code}`, async () => {
      if (await this.get(code)) return false;
      await this.write(code, { version: 0, document }); return true;
    });
  }
  async compareAndSwap<T>(code: string, version: number, document: Document<T>) {
    return serialized(`file:${this.directory}:${code}`, async () => {
      const stored = await this.get(code);
      if (!stored || stored.version !== version) return false;
      await this.write(code, { version: version + 1, document }); return true;
    });
  }
}

export function cloudConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
class SupabaseRoomStore implements RoomStore {
  async listOpen(): Promise<Room[]> {
    const after = new Date(Date.now() - 90_000).toISOString();
    const rows = await this.request(`game_rooms?select=document&document->state->>status=eq.waiting&document->state->>listed=eq.true&updated_at=gte.${encodeURIComponent(after)}&order=updated_at.desc&limit=40`);
    return rows.map((row: { document: Document<Room> }) => row.document.state);
  }
  private async request(route: string, init?: RequestInit) {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${route}`, {
      ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000), headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json', Prefer: 'return=representation', ...init?.headers,
      },
    });
    if (!response.ok) { if (response.status === 409) return []; throw new Error('Storage unavailable'); }
    return response.json();
  }
  async get<T>(code: string): Promise<Stored<T> | null> {
    const rows = await this.request(`game_rooms?code=eq.${encodeURIComponent(code)}&select=version,document&limit=1`);
    return rows[0] ?? null;
  }
  async create<T>(code: string, document: Document<T>) {
    const rows = await this.request('game_rooms', { method: 'POST', body: JSON.stringify({ code, version: 0, document }) });
    return rows.length === 1;
  }
  async compareAndSwap<T>(code: string, version: number, document: Document<T>) {
    const rows = await this.request(`game_rooms?code=eq.${encodeURIComponent(code)}&version=eq.${version}`, {
      method: 'PATCH', body: JSON.stringify({ version: version + 1, document, updated_at: new Date().toISOString() }),
    });
    return rows.length === 1;
  }
}
let instance: RoomStore | undefined;
export function roomStore(): RoomStore {
  if (!instance) {
    if (!cloudConfigured() && process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_STORE)
      throw new Error('Production storage not configured');
    instance = cloudConfigured() ? new SupabaseRoomStore() : new FileRoomStore();
  }
  return instance;
}
