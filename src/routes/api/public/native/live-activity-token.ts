import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  validLiveActivityDeviceId,
  validLiveActivityReference,
  validLiveActivityToken,
} from '@/lib/live-activity-offers';

const bodySchema = z.object({
  id: z.string().min(1).max(128),
  activityId: z.string().min(1).max(128),
  token: z.string().min(32).max(512),
});

/** Native capacitor-live-activity callback: no WebView or user session is required. */
export const Route = createFileRoute('/api/public/native/live-activity-token')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const deviceId = validLiveActivityDeviceId(new URL(request.url).searchParams.get('device'));
          const parsed = bodySchema.safeParse(await request.json());
          const rideId = parsed.success ? validLiveActivityReference(parsed.data.id) : null;
          const activityId = parsed.success ? validLiveActivityReference(parsed.data.activityId) : null;
          const token = parsed.success ? validLiveActivityToken(parsed.data.token) : null;
          if (!deviceId || !parsed.success || !rideId || !activityId || !token) {
            return Response.json({ error: 'Jeton invalide' }, { status: 400 });
          }

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          // The random per-install device id is the capability; no account or token data is returned.
          const { data: device, error: deviceError } = await supabaseAdmin
            .from('live_activity_start_tokens')
            .select('user_id')
            .eq('device_id', deviceId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (deviceError) throw deviceError;
          if (!device?.user_id) return Response.json({ error: 'Appareil inconnu' }, { status: 404 });

          const { registerLiveActivityUpdateToken } = await import('@/lib/vtc-push.server');
          const result = await registerLiveActivityUpdateToken(supabaseAdmin, {
            userId: device.user_id,
            deviceId,
            rideId,
            activityId,
            token,
          });
          return Response.json(result);
        } catch (error) {
          console.error('Enregistrement natif Live Activity', error instanceof Error ? error.message : error);
          return Response.json({ error: 'Enregistrement impossible' }, { status: 500 });
        }
      },
    },
  },
});
