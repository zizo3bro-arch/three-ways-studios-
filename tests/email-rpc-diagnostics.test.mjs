/**
 * Diagnostics regression tests — the `503 rate-limit-unavailable` blind spot.
 *
 * Production symptom (2026-11-22): both endpoints returned
 * `503 rate-limit-unavailable`, and the database proved the RPC never ran
 * (0 rows in `rate_limit_buckets`, no PostgREST statement mentioning any email
 * function in `pg_stat_statements`). The failure was therefore between the
 * function and PostgREST — a rejected route, a rejected credential or an
 * unresolvable function — and the code threw that evidence away: `rpc()` mapped
 * every error to `null`, which became a bare 503 with no log line.
 *
 * These tests pin the two things that must now hold:
 *   1. a failing RPC is reported (`rpc-error`) with the PostgREST code and a
 *      sanitized message, plus a one-per-cold-start `config` event describing
 *      the Supabase host and the credential SHAPE;
 *   2. nothing changes behaviourally: the endpoints still fail closed with 503
 *      `rate-limit-unavailable`, no claim is taken, no email is sent, and no
 *      secret, address or order detail appears in the logs.
 *
 * The Supabase client is exercised for real; only `globalThis.fetch` is stubbed,
 * so the request the client actually builds (URL, headers, method) is asserted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const ORDER_ID = '1234abcd-1234-4abc-8def-1234567890ab';
const SERVICE_JWT_ROLE = 'service_role';

let vite;
test.before(async () => {
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
    ssr: { external: ['@supabase/supabase-js', 'resend'] },
  });
});
test.after(() => vite?.close());

const load = (path) => vite.ssrLoadModule(path);

/** A legacy-format Supabase key built locally: real JWT shape, no real secret. */
function legacyKey(role, ref = 'nujowlxvfpklylhglzse') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iss: 'supabase', ref, role, iat: 1794844422, exp: 2110420422 })
  ).toString('base64url');
  return `${header}.${payload}.localsignaturelocalsignature`;
}

const SUPABASE_URL = 'https://nujowlxvfpklylhglzse.supabase.co';
const SERVICE_KEY = legacyKey(SERVICE_JWT_ROLE);
const OTHER_PROJECT_KEY = legacyKey(SERVICE_JWT_ROLE, 'aaaaaaaaaaaaaaaaaaaa');
const ANON_KEY = legacyKey('anon');
const RESEND_KEY = 're_test_key_value_that_must_never_be_logged';

/**
 * Captures every JSON log line `logEvent` emits while `fn` runs. The live array
 * is handed to `fn` so assertions can read lines as they are emitted.
 */
async function captureLogs(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => {
    const text = args.map(String).join(' ');
    try {
      const entry = JSON.parse(text);
      if (entry && entry.scope === 'tws-email-api') lines.push(entry);
    } catch {
      /* not a structured log line */
    }
  };
  try {
    await fn(lines);
  } finally {
    console.log = original;
  }
  return lines;
}

/** Runs `fn` with a specific process.env, restoring it afterwards. */
async function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const COMPLETE_ENV = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  RESEND_API_KEY: RESEND_KEY,
  RESEND_FROM_EMAIL: 'Three Ways Studios <orders@example.test>',
  ADMIN_NOTIFICATION_EMAIL: 'orders@example.test',
  VITE_SUPABASE_URL: undefined,
  VITE_SUPABASE_ANON_KEY: undefined,
};

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    body: null,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    writeHead(statusCode, extra = {}) {
      this.statusCode = statusCode;
      Object.assign(headers, extra);
    },
    end(body) {
      this.body = body ?? null;
    },
    json() {
      return JSON.parse(this.body ?? 'null');
    },
  };
}

function fakePostReq(body) {
  const text = JSON.stringify(body);
  return {
    method: 'POST',
    url: '/api/order-confirmation',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(text);
    },
  };
}

/**
 * Stubs `globalThis.fetch` before the Supabase client is constructed (the
 * client captures the global when `createClient` runs) and records requests.
 */
async function withFetch(handler, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    calls.push({ url, method: init?.method ?? 'GET', headers: init?.headers });
    return handler({ url, init });
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const jsonResponse = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/* ————————————————————————— credential description ————————————————————————— */

test('describeKey reports the JWT role/project without returning the key', async () => {
  const { describeKey } = await load('/api/_lib/log.ts');

  const service = describeKey(SERVICE_KEY);
  assert.equal(service.format, 'jwt');
  assert.equal(service.role, 'service_role');
  assert.equal(service.projectRef, 'nujowlxvfpklylhglzse');

  assert.equal(describeKey(ANON_KEY).role, 'anon');
  assert.equal(describeKey(OTHER_PROJECT_KEY).projectRef, 'aaaaaaaaaaaaaaaaaaaa');
  assert.equal(describeKey('sb_secret_abc123').format, 'sb_secret');
  assert.equal(describeKey('sb_publishable_abc123').format, 'sb_publishable');
  assert.equal(describeKey('').format, 'empty');
  assert.equal(describeKey(undefined).format, 'empty');
  assert.equal(describeKey('not-a-key-at-all').format, 'unknown');
  assert.equal(describeKey('eyJhbGciOiJIUzI1NiJ9.not-base64-json.sig').role, null);

  // The description must never contain the credential itself.
  for (const key of [SERVICE_KEY, ANON_KEY, 'sb_secret_abc123']) {
    const serialised = JSON.stringify(describeKey(key));
    assert.ok(!serialised.includes(key), 'describeKey leaked the key');
    assert.ok(!serialised.includes(key.split('.')[2] ?? '§'), 'describeKey leaked the signature');
  }
});

test('sanitizeDiagnostic redacts key-shaped text and caps length', async () => {
  const { sanitizeDiagnostic } = await load('/api/_lib/log.ts');

  const withJwt = sanitizeDiagnostic(`Invalid API key: ${SERVICE_KEY}`);
  assert.ok(withJwt.includes('[redacted-jwt]'));
  assert.ok(!withJwt.includes(SERVICE_KEY));

  const withSb = sanitizeDiagnostic('key sb_secret_7kLLdabcdefg rejected');
  assert.ok(withSb.includes('[redacted-key]'));
  assert.ok(!withSb.includes('7kLLdabcdefg'));

  assert.equal(sanitizeDiagnostic('line\nbreak'), 'line break');
  assert.ok(sanitizeDiagnostic('x'.repeat(1000)).length <= 300);
  assert.equal(sanitizeDiagnostic(undefined), '');
  assert.equal(sanitizeDiagnostic(42), '');
});

test('hostOf never invents a host', async () => {
  const { hostOf } = await load('/api/_lib/log.ts');
  assert.equal(hostOf(SUPABASE_URL), 'nujowlxvfpklylhglzse.supabase.co');
  assert.equal(hostOf('not a url'), null);
  assert.equal(hostOf(undefined), null);
});

/* ————————————————————————— the failure the report saw ————————————————————————— */

test('a rejected RPC is logged with its PostgREST code and still fails closed', async () => {
  // What PostgREST returns when the credential is not this project's service
  // key, or when the function is absent from its schema cache. Either way the
  // old code produced only `null` → 503 with no explanation.
  const postgrestError = {
    code: 'PGRST202',
    message:
      'Could not find the function public.rate_limit_check(p_key, p_limit, p_window_seconds) in the schema cache',
    hint: 'Perhaps you meant to call the function public.rate_limit_check',
    details: null,
  };

  await withEnv(COMPLETE_ENV, async () => {
    await withFetch(
      () => jsonResponse(404, postgrestError),
      async (calls) => {
        const logs = await captureLogs(async (lines) => {
          const logs = lines;
          const { createProductionDeps } = await load('/api/_lib/production.ts');
          const deps = createProductionDeps('order-confirmation');

          // The one-per-cold-start configuration event.
          const envResult = await deps.loadEnv();
          assert.equal(envResult.ok, true);

          // The rate limiter is the stage that failed in production.
          const verdict = await deps.rateLimit('ip:203.0.113.9', 20, 600);
          assert.equal(verdict, null, 'a failing limiter must not allow the request');

          const config = logs.find((line) => line.event === 'config');
          assert.ok(config, 'missing config event');
          assert.equal(config.supabase_host, 'nujowlxvfpklylhglzse.supabase.co');
          assert.equal(config.supabase_url_source, 'SUPABASE_URL');
          assert.equal(config.key_format, 'jwt');
          assert.equal(config.key_role, 'service_role');
          assert.equal(config.key_project_matches_url, true);
          assert.equal(config.admin_inbox_configured, true);

          const error = logs.find((line) => line.event === 'rpc-error');
          assert.ok(error, 'missing rpc-error event');
          assert.equal(error.fn, 'rate_limit_check');
          assert.equal(error.code, 'PGRST202');
          assert.match(error.message, /Could not find the function/);
          assert.match(error.hint, /Perhaps you meant/);

          // The request the client built is the one the code documents.
          const rpcCall = calls.find((call) => call.url.includes('/rest/v1/rpc/rate_limit_check'));
          assert.ok(rpcCall, 'RPC request was not issued');
          assert.equal(rpcCall.method, 'POST');

          // No secret, no customer data, no order id in any log line.
          const serialised = JSON.stringify(logs);
          for (const forbidden of [SERVICE_KEY, RESEND_KEY, 'orders@example.test', ORDER_ID]) {
            assert.ok(!serialised.includes(forbidden), `log leaked ${forbidden.slice(0, 12)}…`);
          }
        });
      }
    );
  });
});

test('the handler still answers 503 rate-limit-unavailable and sends no email', async () => {
  const resendCalls = [];
  await withEnv(COMPLETE_ENV, async () => {
    await withFetch(
      ({ url }) => {
        if (url.includes('/rest/v1/rpc/rate_limit_check')) {
          return jsonResponse(401, {
            code: 'PGRST301',
            message: 'JWT verification failed',
            hint: null,
            details: null,
          });
        }
        resendCalls.push(url);
        return jsonResponse(200, { id: 'should-not-happen' });
      },
      async () => {
        const logs = await captureLogs(async (lines) => {
          const logs = lines;
          const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');
          const { createProductionDeps } = await load('/api/_lib/production.ts');
          const res = fakeRes();
          await handleOrderNotificationRequest(
            createProductionDeps('order-confirmation'),
            fakePostReq({ order_id: ORDER_ID }),
            res
          );

          assert.equal(res.statusCode, 503);
          assert.equal(res.json().error, 'rate-limit-unavailable');

          const error = logs.find((line) => line.event === 'rpc-error');
          assert.ok(error, 'the 503 must now carry a reason in the log');
          assert.equal(error.code, 'PGRST301');
          assert.match(error.message, /JWT verification failed/);

          const complete = logs.find((line) => line.event === 'request-complete');
          assert.equal(complete.status, 503);
          assert.equal(complete.outcome, 'rate-limit-unavailable');
        });
      }
    );
  });
  assert.deepEqual(resendCalls, [], 'fail-closed must never reach the email transport');
});

test('a transport failure is logged instead of vanishing in claims.ts', async () => {
  await withEnv(COMPLETE_ENV, async () => {
    await withFetch(
      () => {
        throw new TypeError('fetch failed');
      },
      async () => {
        const logs = await captureLogs(async (lines) => {
          const logs = lines;
          const { createProductionDeps } = await load('/api/_lib/production.ts');
          const deps = createProductionDeps('admin-new-order');
          await deps.loadEnv();
          const verdict = await deps.rateLimit('order:abc', 5, 3600);
          assert.equal(verdict, null, 'a transport failure must not allow the request');
        });
        const error = logs.find((line) => line.event === 'rpc-error');
        assert.ok(error, 'missing rpc-error for a transport failure');
        // postgrest-js turns a rejected fetch into `{ code: '', status: 0,
        // message: 'TypeError: fetch failed' }` instead of throwing, so the
        // evidence now arrives as a logged message with no HTTP status.
        assert.equal(error.http_status, null);
        assert.match(error.message, /fetch failed/);
        assert.equal(logs.find((line) => line.event === 'config').endpoint, 'admin-new-order');
      }
    );
  });
});

test('a key from another project is visible as key_project_matches_url=false', async () => {
  await withEnv(
    { ...COMPLETE_ENV, SUPABASE_SERVICE_ROLE_KEY: OTHER_PROJECT_KEY },
    async () => {
      await withFetch(
        () =>
          jsonResponse(401, {
            code: 'PGRST301',
            message: 'No suitable key or wrong key type',
            hint: null,
            details: null,
          }),
        async () => {
          const logs = await captureLogs(async (lines) => {
            const logs = lines;
            const { createProductionDeps } = await load('/api/_lib/production.ts');
            const deps = createProductionDeps('order-confirmation');
            await deps.loadEnv();
            await deps.rateLimit('ip:198.51.100.4', 20, 600);
          });
          const config = logs.find((line) => line.event === 'config');
          assert.equal(config.key_project_matches_url, false);
          assert.equal(config.key_role, 'service_role');
          assert.ok(!JSON.stringify(logs).includes(OTHER_PROJECT_KEY));
        }
      );
    }
  );
});

test('the anon key used as a service key is identifiable from the log', async () => {
  await withEnv({ ...COMPLETE_ENV, SUPABASE_SERVICE_ROLE_KEY: ANON_KEY }, async () => {
    await withFetch(
      () =>
        jsonResponse(403, {
          code: '42501',
          message: 'permission denied for function rate_limit_check',
          hint: 'Grant the required privileges to the current role.',
          details: null,
        }),
      async () => {
        const logs = await captureLogs(async (lines) => {
          const logs = lines;
          const { createProductionDeps } = await load('/api/_lib/production.ts');
          const deps = createProductionDeps('order-confirmation');
          await deps.loadEnv();
          await deps.rateLimit('ip:198.51.100.5', 20, 600);
        });
        assert.equal(logs.find((line) => line.event === 'config').key_role, 'anon');
        assert.equal(logs.find((line) => line.event === 'rpc-error').code, '42501');
      }
    );
  });
});

test('the VITE_ fallback is reported when SUPABASE_URL is absent', async () => {
  await withEnv(
    { ...COMPLETE_ENV, SUPABASE_URL: undefined, VITE_SUPABASE_URL: SUPABASE_URL },
    async () => {
      await withFetch(
        () => jsonResponse(200, []),
        async () => {
          const logs = await captureLogs(async (lines) => {
            const logs = lines;
            const { createProductionDeps } = await load('/api/_lib/production.ts');
            const deps = createProductionDeps('order-confirmation');
            await deps.loadEnv();
          });
          const config = logs.find((line) => line.event === 'config');
          assert.equal(config.supabase_url_source, 'VITE_SUPABASE_URL');
          assert.equal(config.supabase_host, 'nujowlxvfpklylhglzse.supabase.co');
        }
      );
    }
  );
});

/* —————————————————————— /api/email-health?probe=1 —————————————————————— */

test('email-health stays read-only and only probes when asked', async () => {
  await withEnv(COMPLETE_ENV, async () => {
    await withFetch(
      () => new Response('', { status: 200, headers: { 'content-range': '0-0/0' } }),
      async (calls) => {
        const { default: handler } = await load('/api/email-health.ts');

        // Default: no database request at all.
        const plain = fakeRes();
        await captureLogs(() =>
          handler({ method: 'GET', url: '/api/email-health', headers: {} }, plain)
        );
        assert.equal(plain.statusCode, 200);
        const plainBody = plain.json();
        assert.equal(plainBody.routed_to_function, true);
        assert.equal(plainBody.env.configured, true);
        assert.equal(plainBody.env.supabase_host, 'nujowlxvfpklylhglzse.supabase.co');
        assert.equal(plainBody.env.key.role, 'service_role');
        assert.match(String(plainBody.supabase_probe), /not-requested/);
        assert.equal(calls.length, 0, 'the default health check must not touch the database');
        assert.ok(!JSON.stringify(plainBody).includes(SERVICE_KEY));

        // ?probe=1: exactly one read-only request through the service client.
        const probed = fakeRes();
        await captureLogs(() =>
          handler({ method: 'GET', url: '/api/email-health?probe=1', headers: {} }, probed)
        );
        assert.equal(probed.statusCode, 200);
        assert.equal(probed.json().supabase_probe.ok, true);
        assert.equal(calls.length, 1);
        assert.match(calls[0].url, /\/rest\/v1\/products/);
        assert.equal(calls[0].method, 'HEAD');
        assert.ok(!JSON.stringify(probed.json()).includes(SERVICE_KEY));
      }
    );
  });
});

test('email-health?probe=1 reports the credential failure without leaking it', async () => {
  await withEnv(COMPLETE_ENV, async () => {
    await withFetch(
      () =>
        jsonResponse(401, {
          code: 'PGRST301',
          message: `Invalid API key ${SERVICE_KEY}`,
          hint: null,
          details: null,
        }),
      async () => {
        const { default: handler } = await load('/api/email-health.ts');
        const res = fakeRes();
        const logs = await captureLogs(() =>
          handler({ method: 'GET', url: '/api/email-health?probe=1', headers: {} }, res)
        );
        const body = res.json();
        assert.equal(res.statusCode, 200);
        assert.equal(body.supabase_probe.ok, false);
        assert.equal(body.supabase_probe.code, 'PGRST301');
        assert.match(body.supabase_probe.message, /Invalid API key/);
        assert.ok(!JSON.stringify(body).includes(SERVICE_KEY), 'probe response leaked the key');
        assert.ok(logs.some((line) => line.event === 'probe-error'));
      }
    );
  });
});

test('email-health probes Supabase even when an unrelated Resend variable is missing', async () => {
  await withEnv({ ...COMPLETE_ENV, RESEND_FROM_EMAIL: undefined }, async () => {
    await withFetch(
      () => new Response('', { status: 200, headers: { 'content-range': '0-0/0' } }),
      async (calls) => {
        const { default: handler } = await load('/api/email-health.ts');
        const res = fakeRes();
        await captureLogs(() =>
          handler({ method: 'GET', url: '/api/email-health?probe=1', headers: {} }, res)
        );
        const body = res.json();
        assert.equal(body.env.configured, false);
        assert.equal(body.env.reason, 'missing-resend-from-email');
        assert.equal(body.supabase_probe.ok, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'HEAD');
        assert.ok(!JSON.stringify(body).includes(SERVICE_KEY));
      }
    );
  });
});

test('email-health without configuration reports the reason and never probes', async () => {
  const blank = {
    SUPABASE_URL: undefined,
    VITE_SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    RESEND_API_KEY: undefined,
    RESEND_FROM_EMAIL: undefined,
    ADMIN_NOTIFICATION_EMAIL: undefined,
  };
  await withEnv(blank, async () => {
    await withFetch(
      () => jsonResponse(200, []),
      async (calls) => {
        const { default: handler } = await load('/api/email-health.ts');
        const res = fakeRes();
        await captureLogs(() =>
          handler({ method: 'GET', url: '/api/email-health?probe=1', headers: {} }, res)
        );
        assert.equal(res.statusCode, 200);
        assert.equal(res.json().env.configured, false);
        assert.equal(calls.length, 0);
      }
    );
  });
});
