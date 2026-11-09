import { createClient } from '@supabase/supabase-js';
import { identity } from '@/lib/server/auth';
import { failure, rateLimit } from '@/lib/server/http';
import { accessRoom } from '@/lib/server/rooms';
import { cloudConfigured } from '@/lib/server/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const playerId = await identity();
    rateLimit(`events:${playerId}`, 30);
    const { code } = await context.params;
    // Verify membership before constructing a subscription with server credentials.
    await accessRoom(code, playerId);
    if (!cloudConfigured()) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const encoder = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let stopped = false;
        let keepalive: ReturnType<typeof setInterval>;
        let lifetime: ReturnType<typeof setTimeout>;
        const send = (value: string) => { if (!stopped) controller.enqueue(encoder.encode(value)); };
        const channel = supabase.channel(`room:${code}:${crypto.randomUUID()}`).on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'game_revisions', filter: `code=eq.${code}`,
        }, event => {
          // Never forward the database payload, even though this table is sanitized.
          const revision = event.new.revision;
          if (Number.isSafeInteger(revision)) send(`data: ${JSON.stringify({ revision })}\n\n`);
        });
        cleanup = () => {
          if (stopped) return;
          stopped = true;
          clearInterval(keepalive); clearTimeout(lifetime);
          request.signal.removeEventListener('abort', cleanup);
          void supabase.removeChannel(channel);
          try { controller.close(); } catch { /* stream already cancelled */ }
        };
        request.signal.addEventListener('abort', cleanup, { once: true });
        send(': connected\n\n');
        channel.subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') cleanup();
        });
        keepalive = setInterval(() => send(': keepalive\n\n'), 15_000);
        // Bound server resources; EventSource reconnects, rechecking membership and auth.
        lifetime = setTimeout(cleanup, 55_000);
        if (request.signal.aborted) cleanup();
      },
      cancel() { cleanup(); },
    });
    return new Response(stream, { headers: {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    } });
  } catch (error) { return failure(error); }
}
