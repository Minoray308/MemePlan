/**
 * Cloudflare Worker — version-check API for the MemePlan Android app.
 *
 *   GET /api/version?platform=android
 *
 * Serves JSON metadata only (latest/minimum version, force flag, R2 APK URL,
 * OTA flags). It never proxies APK bytes and never reads Cloudflare secrets.
 * APK files are downloaded directly from R2 / the Cloudflare CDN.
 *
 * Version metadata is read from the VERSION_KV binding (key "android-version")
 * and falls back to the bundled version.json when the KV is empty/unset.
 */
import version from './version.json';

export interface Env {
  VERSION_KV?: KVNamespace;
}

const KV_KEY = 'android-version';
const PLATFORM = 'android';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200, cacheControl = 'public, max-age=300'): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      ...CORS_HEADERS,
    },
  });
}

function jsonError(status: number, code: string, message?: string): Response {
  return json({ error: { code, message: message ?? code } }, status, 'no-store');
}

function notFound(): Response {
  return jsonError(404, 'not_found', '接口不存在');
}

function invalidPlatform(): Response {
  return jsonError(400, 'invalid_platform', 'platform 仅支持 android');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return jsonError(405, 'method_not_allowed', '仅支持 GET');
    }

    if (url.pathname !== '/api/version') {
      return notFound();
    }

    if (url.searchParams.get('platform') !== PLATFORM) {
      return invalidPlatform();
    }

    let data: unknown = version;
    try {
      const raw = env.VERSION_KV ? await env.VERSION_KV.get(KV_KEY) : null;
      if (raw) data = JSON.parse(raw);
    } catch {
      // Invalid KV contents — fall back to the bundled version.
      data = version;
    }

    return json(data);
  },
};