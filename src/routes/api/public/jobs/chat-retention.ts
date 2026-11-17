import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
export const Route = createFileRoute('/api/public/jobs/chat-retention')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { purgeRideChats } = await import('@/lib/ride-chat.server');
    return Response.json(await purgeRideChats(supabaseAdmin));
  } } },
});
