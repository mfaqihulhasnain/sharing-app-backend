import { env } from "../../config/index.js";

const SHARE_CREATED_EVENT = "share_created";

const getSupabaseUrl = () => env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const getSupabaseApiKey = () =>
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_ANON_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const isRealtimePublishConfigured = () => Boolean(getSupabaseUrl() && getSupabaseApiKey());

const publishRealtimeBroadcast = async ({ topic, event, payload }) => {
  if (!isRealtimePublishConfigured()) {
    return false;
  }

  const endpoint = `${getSupabaseUrl().replace(/\/$/, "")}/realtime/v1/api/broadcast`;
  const apiKey = getSupabaseApiKey();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      messages: [
        {
          topic,
          event,
          payload,
          private: false,
        },
      ],
    }),
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) {
    throw new Error(`Realtime broadcast failed with status ${response.status}`);
  }

  return true;
};

const shareRealtime = {
  SHARE_CREATED_EVENT,
  isRealtimePublishConfigured,
  async publishShareCreated({ topic, share }) {
    if (!topic || typeof topic !== "string") {
      return false;
    }

    return publishRealtimeBroadcast({
      topic,
      event: SHARE_CREATED_EVENT,
      payload: share,
    });
  },
};

export { SHARE_CREATED_EVENT, isRealtimePublishConfigured };
export default shareRealtime;
