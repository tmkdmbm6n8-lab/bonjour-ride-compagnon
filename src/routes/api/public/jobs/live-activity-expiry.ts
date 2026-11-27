import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { shouldCloseLiveActivityOffer } from '@/lib/live-activity-offers';

export const Route = createFileRoute('/api/public/jobs/live-activity-expiry')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const failure = await authenticateCronRequest(request);
        if (failure) return failure;

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { endRideOfferLiveActivities } = await import('@/lib/vtc-push.server');
        const { data: activities, error } = await supabaseAdmin
          .from('live_activity_update_tokens')
          .select('ride_id,user_id,device_id')
          .order('updated_at')
          .limit(200);
        if (error) return Response.json({ error: 'Lecture impossible' }, { status: 500 });
        if (!activities?.length) return Response.json({ checked: 0, closureAttempts: 0 });

        const rideIds = [...new Set(activities.map(({ ride_id }) => ride_id))];
        const { data: rides, error: rideError } = await supabaseAdmin
          .from('rides')
          .select('id,status,offer_expires_at,declined')
          .in('id', rideIds);
        if (rideError) return Response.json({ error: 'Lecture des offres impossible' }, { status: 500 });

        const ridesById = new Map((rides ?? []).map((ride) => [String(ride.id), ride]));
        const closedPairs = new Set<string>();
        for (const { ride_id, user_id, device_id } of activities) {
          const pair = `${ride_id}:${user_id}:${device_id || ''}`;
          if (closedPairs.has(pair) || !shouldCloseLiveActivityOffer(ridesById.get(ride_id), user_id)) continue;
          closedPairs.add(pair);
          await endRideOfferLiveActivities(supabaseAdmin, ride_id, user_id, device_id || undefined);
        }
        return Response.json({ checked: activities.length, closureAttempts: closedPairs.size });
      },
    },
  },
});
