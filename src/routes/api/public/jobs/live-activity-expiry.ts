import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

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
          .select('ride_id,user_id,updated_at')
          .lt('updated_at', new Date(Date.now() - 60_000).toISOString())
          .order('updated_at')
          .limit(100);

        if (error) return Response.json({ error: 'Lecture impossible' }, { status: 500 });

        const rideIds = [...new Set(activities.map(({ ride_id }) => ride_id))];
        if (!rideIds.length) return Response.json({ checked: 0 });

        const { data: rides, error: rideError } = await supabaseAdmin
          .from('rides')
          .select('id,status,offer_expires_at,declined')
          .in('id', rideIds);

        if (rideError) return Response.json({ error: 'Lecture des offres impossible' }, { status: 500 });

        const ridesById = new Map(rides.map((ride) => [String(ride.id), ride]));
        const closedPairs = new Set<string>();

        for (const { ride_id, user_id } of activities) {
          const ride = ridesById.get(ride_id);
          const deadline = Date.parse(ride?.offer_expires_at ?? '');
          const declined = Array.isArray(ride?.declined) && ride.declined.includes(user_id);
          if (ride?.status === 'searching' && deadline > Date.now() && !declined) continue;

          const pair = ride_id + ':' + user_id;
          if (closedPairs.has(pair)) continue;
          closedPairs.add(pair);
          await endRideOfferLiveActivities(supabaseAdmin, ride_id, user_id);
        }

        return Response.json({ checked: activities.length, closureAttempts: closedPairs.size });
      },
    },
  },
});
