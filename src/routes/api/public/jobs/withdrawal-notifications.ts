import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
export const Route = createFileRoute('/api/public/jobs/withdrawal-notifications')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { retryWithdrawalNotifications } = await import('@/lib/withdrawal-notifications.server');
    return Response.json(await retryWithdrawalNotifications(supabaseAdmin));
  } } },
});
