import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import {
  adminNewOrderEmail,
  customerConfirmationEmail,
  type EmailAssets,
  type EmailOrder,
} from '../src/lib/emails';

/* ========================================================================
   THREE WAYS STUDIOS — transactional order emails (server-side only)
   
   Triggered by the storefront after an order is saved in Supabase
   (`create_cod_order` receipt). Sends exactly two emails per order:
     1. Customer order confirmation
     2. Studio new-order notification (zizo3bro@gmail.com)
   
   Resend is the transactional provider. RESEND_API_KEY is read from the
   server environment only — never bundled into the storefront.
   Idempotency: public.email_notifications stores one row per
   (order_id, notification_type) with status pending / sent / failed. A
   `sent` row means the email was delivered; page refreshes, order
   re-opens, status changes and endpoint retries never send a duplicate.
   Failed rows are retried by calling this same endpoint again. The order
   itself is never marked failed because the email provider is temporarily
   unavailable.
   ======================================================================== */

type Json = Record<string, unknown>;

type NotifyRequest = {
  orderReference: string;
  customerEmail: string;
};

type NotificationResult = {
  type: 'customer_confirmation' | 'admin_new_order';
  status: 'sent' | 'skipped' | 'failed';
  resendId?: string;
  error?: string;
};

const ADMIN_DISPLAY_NAME = 'Three Ways Studios — New Order Notification';
const DEFAULT_FROM_EMAIL = 'onboarding@resend.dev';
const DEFAULT_ADMIN_EMAIL = 'zizo3bro@gmail.com';
const DEFAULT_SITE_URL = 'https://three-ways-studios.vercel.app';
const LOGO_PATH = '/assets/three-ways-studios-logo.png';

type Env = {
  resendApiKey: string | undefined;
  fromEmail: string;
  siteUrl: string;
  adminEmail: string;
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
};

function readEnv(): Env {
  return {
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL ?? DEFAULT_FROM_EMAIL,
    siteUrl: process.env.PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? DEFAULT_ADMIN_EMAIL,
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function json(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function parseRequest(req: Request): Promise<NotifyRequest | null> {
  if (req.method !== 'POST') return null;
  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return null;
  }
  const orderReference =
    typeof body.orderReference === 'string' ? body.orderReference.trim() : '';
  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
  if (!orderReference || !customerEmail) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail)) return null;
  return { orderReference, customerEmail };
}

function makeSupabaseClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type StudioClient = ReturnType<typeof makeSupabaseClient>;

/** Loads the saved order receipt server-side. The email match guarantees
 *  the notifier only touches orders belonging to the supplied address. */
async function fetchOrder(
  supabase: StudioClient,
  orderReference: string,
  customerEmail: string
): Promise<{ order: EmailOrder | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_order_confirmation', {
    p_order_reference: orderReference,
    p_customer_email: customerEmail,
  } as Json);
  if (error) return { order: null, error: error.message };
  if (!data) return { order: null, error: 'No order matched that reference and email address.' };
  return { order: data as unknown as EmailOrder, error: null };
}

async function claimRow(
  supabase: StudioClient,
  orderId: string,
  orderReference: string,
  notificationType: NotificationResult['type'],
  recipient: string
): Promise<{ id: string | null; alreadySent: boolean }> {
  const { data: existing } = await supabase
    .from('email_notifications')
    .select('id, status, attempt_count')
    .eq('order_id', orderId)
    .eq('notification_type', notificationType)
    .maybeSingle();

  if (existing && existing.status === 'sent') return { id: existing.id, alreadySent: true };

  if (existing) {
    const { error } = await supabase
      .from('email_notifications')
      .update({
        status: 'pending',
        error_message: null,
        attempt_count: (existing.attempt_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) return { id: null, alreadySent: false };
    return { id: existing.id, alreadySent: false };
  }

  const { data: inserted, error } = await supabase
    .from('email_notifications')
    .insert({
      order_id: orderId,
      order_reference: orderReference,
      notification_type: notificationType,
      recipient,
      status: 'pending',
    } as Json)
    .select('id')
    .single();
  if (error) {
    // A concurrent retry may have inserted the row first; re-check once.
    const { data: raced } = await supabase
      .from('email_notifications')
      .select('id, status')
      .eq('order_id', orderId)
      .eq('notification_type', notificationType)
      .maybeSingle();
    if (raced && raced.status === 'sent') return { id: raced.id, alreadySent: true };
    return { id: null, alreadySent: false };
  }
  return { id: inserted.id, alreadySent: false };
}

async function recordOutcome(
  supabase: StudioClient,
  notificationId: string | null,
  outcome: 'sent' | 'failed',
  resendId: string | undefined,
  error: string | undefined
): Promise<void> {
  if (!notificationId) return;
  const update: Json = {
    status: outcome,
    updated_at: new Date().toISOString(),
  };
  if (outcome === 'sent') {
    update.sent_at = new Date().toISOString();
    update.resend_id = resendId ?? null;
  } else {
    update.error_message = error ?? 'Email provider did not accept the message.';
  }
  await supabase.from('email_notifications').update(update).eq('id', notificationId);
}

export default async function handler(req: Request): Promise<Response> {
  const env = readEnv();

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405);
  }

  const request = await parseRequest(req);
  if (!request) {
    return json({ ok: false, error: 'Invalid request: orderReference and customerEmail are required.' }, 400);
  }

  if (!env.resendApiKey) {
    // Provider not configured yet. The order itself is complete and safe;
    // emails are a best-effort notification layer.
    return json(
      {
        ok: false,
        configured: false,
        error: 'Resend is not configured on this deployment yet.',
      },
      503
    );
  }

  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return json(
      { ok: false, configured: false, error: 'Supabase server credentials are not configured.' },
      503
    );
  }

  const supabase = makeSupabaseClient(env.supabaseUrl, env.serviceRoleKey);

  const { order, error: orderError } = await fetchOrder(
    supabase,
    request.orderReference,
    request.customerEmail
  );
  if (!order || orderError) {
    return json({ ok: false, error: orderError ?? 'Order not found.' }, 404);
  }

  const assets: EmailAssets = {
    siteUrl: env.siteUrl,
    logoUrl: `${env.siteUrl}${LOGO_PATH}`,
  };

  const resend = new Resend(env.resendApiKey);
  const results: NotificationResult[] = [];

  for (const notificationType of [
    'customer_confirmation',
    'admin_new_order',
  ] as const) {
    const content =
      notificationType === 'customer_confirmation'
        ? customerConfirmationEmail(order, assets)
        : adminNewOrderEmail(order, assets);

    const claim = await claimRow(
      supabase,
      order.order_id,
      order.order_reference,
      notificationType,
      notificationType === 'customer_confirmation'
        ? order.customer_email
        : env.adminEmail
    );

    if (claim.alreadySent) {
      results.push({ type: notificationType, status: 'skipped' });
      continue;
    }

    let resendError: string | undefined;
    let resendId: string | undefined;
    try {
      const { data, error } = await resend.emails.send({
        from:
          notificationType === 'customer_confirmation'
            ? `Three Ways Studios <${env.fromEmail}>`
            : `${ADMIN_DISPLAY_NAME} <${env.fromEmail}>`,
        to:
          notificationType === 'customer_confirmation'
            ? [order.customer_email]
            : [env.adminEmail],
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      if (error) throw new Error(error.message ?? 'Resend rejected the message.');
      resendId = (data as { id?: string })?.id;
    } catch (e) {
      resendError = e instanceof Error ? e.message : 'Resend send failed.';
    }

    await recordOutcome(
      supabase,
      claim.id,
      resendError ? 'failed' : 'sent',
      resendId,
      resendError
    );
    results.push(resendError
      ? { type: notificationType, status: 'failed', error: resendError }
      : { type: notificationType, status: 'sent', resendId });
  }

  return json(
    { ok: true, configured: true, results, orderReference: order.order_reference },
    200
  );
}
