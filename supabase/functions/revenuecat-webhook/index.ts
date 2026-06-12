import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type RevenueCatEventPayload = {
  event?: {
    aliases?: string[];
    app_user_id?: string;
    entitlement_id?: string;
    entitlement_ids?: string[];
    environment?: string;
    event_timestamp_ms?: number;
    expiration_at_ms?: number | null;
    id?: string;
    original_app_user_id?: string;
    original_transaction_id?: string;
    period_type?: string;
    product_id?: string;
    purchased_at_ms?: number;
    store?: string;
    takehome_percentage?: number;
    transaction_id?: string;
    type?: string;
  };
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const revenueCatWebhookAuthorization = Deno.env.get("REVENUECAT_WEBHOOK_AUTHORIZATION");
const revenueCatSecretApiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase Edge Function environment.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (revenueCatWebhookAuthorization) {
    const authorization = request.headers.get("authorization");

    if (authorization !== revenueCatWebhookAuthorization) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const payload = (await request.json()) as RevenueCatEventPayload;
  const event = payload.event;

  if (!event?.app_user_id || !event.type) {
    return json({ error: "Invalid RevenueCat payload" }, 400);
  }

  const userId = await resolveUserId(event.app_user_id);
  const platform = mapPlatform(event.store);
  const entitlementIds = event.entitlement_ids?.length
    ? event.entitlement_ids
    : event.entitlement_id
      ? [event.entitlement_id]
      : [];

  const { error: eventError } = await supabase.from("revenuecat_webhook_events").upsert(
    {
      app_user_id: event.app_user_id,
      entitlement_ids: entitlementIds,
      event_id: event.id,
      event_type: event.type,
      expiration_at: toIso(event.expiration_at_ms),
      payload,
      platform,
      processed_at: new Date().toISOString(),
      product_id: event.product_id,
      purchased_at: toIso(event.purchased_at_ms),
      user_id: userId
    },
    { onConflict: "event_id" }
  );

  if (eventError) {
    return json({ error: eventError.message }, 500);
  }

  if (userId) {
    await supabase.from("revenuecat_customers").upsert(
      {
        aliases: event.aliases ?? [],
        app_user_id: event.app_user_id,
        latest_payload: payload,
        last_synced_at: new Date().toISOString(),
        original_app_user_id: event.original_app_user_id,
        user_id: userId
      },
      { onConflict: "app_user_id" }
    );

    const customer = await fetchRevenueCatCustomer(event.app_user_id);

    if (customer) {
      await syncEntitlementsFromCustomerInfo(userId, event.app_user_id, customer);
    } else {
      for (const entitlementId of entitlementIds) {
        await supabase.from("subscription_entitlements").upsert(
          {
            entitlement_id: entitlementId,
            expires_at: toIso(event.expiration_at_ms),
            original_transaction_id: event.original_transaction_id,
            platform,
            product_id: event.product_id,
            provider: "revenuecat",
            raw_payload: payload,
            starts_at: toIso(event.purchased_at_ms),
            status: isActiveRevenueCatEvent(event.type) ? "active" : "inactive",
            store_transaction_id: event.transaction_id,
            subscription_status: mapSubscriptionStatus(event.type),
            user_id: userId,
            will_renew: !["CANCELLATION", "EXPIRATION", "REFUND"].includes(event.type)
          },
          { onConflict: "user_id,entitlement_id,provider" }
        );
      }
    }

    await supabase.rpc("sync_profile_subscription_from_entitlements", {
      target_user_id: userId
    });
  }

  return json({ ok: true });
});

async function fetchRevenueCatCustomer(appUserId: string) {
  if (!revenueCatSecretApiKey) {
    return null;
  }

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: revenueCatSecretApiKey.startsWith("Bearer ")
        ? revenueCatSecretApiKey
        : `Bearer ${revenueCatSecretApiKey}`
    }
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as {
    subscriber?: {
      entitlements?: Record<
        string,
        {
          expires_date?: string | null;
          grace_period_expires_date?: string | null;
          product_identifier?: string;
          purchase_date?: string | null;
        }
      >;
    };
  };
}

async function syncEntitlementsFromCustomerInfo(
  userId: string,
  appUserId: string,
  customer: {
    subscriber?: {
      entitlements?: Record<
        string,
        {
          expires_date?: string | null;
          grace_period_expires_date?: string | null;
          product_identifier?: string;
          purchase_date?: string | null;
        }
      >;
    };
  }
) {
  const entitlements = customer.subscriber?.entitlements ?? {};

  await supabase.from("revenuecat_customers").upsert(
    {
      app_user_id: appUserId,
      latest_payload: customer,
      last_synced_at: new Date().toISOString(),
      user_id: userId
    },
    { onConflict: "app_user_id" }
  );

  for (const [entitlementId, entitlement] of Object.entries(entitlements)) {
    const expiresAt = entitlement.expires_date ?? entitlement.grace_period_expires_date ?? null;
    const isActive = !expiresAt || new Date(expiresAt).getTime() > Date.now();

    await supabase.from("subscription_entitlements").upsert(
      {
        entitlement_id: entitlementId,
        expires_at: expiresAt,
        platform: "unknown",
        product_id: entitlement.product_identifier,
        provider: "revenuecat",
        raw_payload: entitlement,
        starts_at: entitlement.purchase_date,
        status: isActive ? "active" : "inactive",
        subscription_status: isActive ? "active" : "expired",
        user_id: userId,
        will_renew: isActive
      },
      { onConflict: "user_id,entitlement_id,provider" }
    );
  }
}

async function resolveUserId(appUserId: string) {
  if (isUuid(appUserId)) {
    return appUserId;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("revenuecat_app_user_id", appUserId)
    .maybeSingle();

  return profile?.id ?? null;
}

function isActiveRevenueCatEvent(eventType: string) {
  return ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE"].includes(eventType);
}

function mapSubscriptionStatus(eventType: string) {
  if (["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE"].includes(eventType)) {
    return "active";
  }

  if (eventType === "BILLING_ISSUE") {
    return "grace_period";
  }

  if (eventType === "CANCELLATION") {
    return "cancelled";
  }

  if (eventType === "EXPIRATION") {
    return "expired";
  }

  if (eventType === "REFUND") {
    return "refunded";
  }

  return "free";
}

function mapPlatform(store?: string) {
  if (store === "APP_STORE") {
    return "ios";
  }

  if (store === "PLAY_STORE") {
    return "android";
  }

  if (store === "STRIPE" || store === "RC_BILLING") {
    return "web";
  }

  return "unknown";
}

function toIso(value?: number | null) {
  return value ? new Date(value).toISOString() : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}
