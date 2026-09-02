import { GITHUB_LATEST_RELEASE_URL, GITHUB_LATEST_MANIFEST_URL, UPDATE_API_TIMEOUT_MS } from '../../constants/update';
import { parseGithubReleaseRaw, parseReleaseManifest } from './updateLogic';
import { UpdateCheckError, type ServerUpdateInfo } from './updateTypes';

async function readJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  // Keep the timeout active until the body has finished downloading too.
  const timer = setTimeout(() => controller.abort(), UPDATE_API_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const rateLimited = response.status === 429 || (response.status === 403 && (
        response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')
      ));
      if (rateLimited) throw new UpdateCheckError('rate_limit');
      if (response.status === 404) throw new UpdateCheckError('no_release');
      const message = response.status === 403
        ? '更新服务拒绝访问（HTTP 403），请尝试切换网络或 VPN 节点'
        : '更新服务返回 HTTP ' + response.status + '，请稍后重试';
      throw new UpdateCheckError('http', message);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof UpdateCheckError) throw error;
    if (controller.signal.aborted || (error as { name?: string })?.name === 'AbortError') {
      throw new UpdateCheckError('timeout');
    }
    throw new UpdateCheckError(error instanceof SyntaxError ? 'parse' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

async function readRelease(url: string, parse: (raw: unknown) => ServerUpdateInfo): Promise<ServerUpdateInfo> {
  const raw = await readJson(url);
  try { return parse(raw); } catch { throw new UpdateCheckError('parse'); }
}

export async function fetchVersionInfo(): Promise<ServerUpdateInfo> {
  try {
    return await readRelease(GITHUB_LATEST_RELEASE_URL, parseGithubReleaseRaw);
  } catch (primaryError) {
    try {
      return await readRelease(GITHUB_LATEST_MANIFEST_URL, parseReleaseManifest);
    } catch {
      // Older releases have no manifest; keep the useful primary diagnosis.
      throw primaryError;
    }
  }
}
