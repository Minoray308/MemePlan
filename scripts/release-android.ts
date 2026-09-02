/**
 * Release helper for the Cloudflare update system.
 *
 * Publishes a MemePlan Android APK to Cloudflare R2 and updates the Worker's
 * version metadata (KV + the bundled cloudflare/worker/src/version.json).
 *
 * It does NOT build the APK itself — build with EAS or a local Gradle build,
 * then point this script at the resulting .apk file. GitHub is only used to
 * run a build; Cloudflare is the store + download + version-check channel.
 *
 * Prerequisite: a wrangler login / CLOUDFLARE_API_TOKEN + account id.
 *
 * Usage (Node 24+):
 *   node --experimental-strip-types scripts/release-android.ts \
 *     --apk dist/memeplan-2.0.0.apk \
 *     --version 2.0.0 \
 *     --minimum 1.5.0 \
 *     --notes "新增功能A" --notes "修复B"
 *
 * Env (or .env):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL          e.g. https://download.example.com
 *   CLOUDFLARE_KV_NAMESPACE_ID   (Worker's VERSION_KV namespace id)
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Args {
  apk: string;
  version: string;
  minimum: string;
  notes: string[];
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apk: '',
    version: '',
    minimum: '',
    notes: [],
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apk') args.apk = argv[++i] ?? '';
    else if (a === '--version') args.version = argv[++i] ?? '';
    else if (a === '--minimum') args.minimum = argv[++i] ?? '';
    else if (a === '--notes') args.notes.push(argv[++i] ?? '');
    else if (a === '--dry-run') args.dryRun = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!args.apk) {
    console.error('Missing --apk <path>. Build the APK first, then point here.');
    process.exit(2);
  }
  if (!args.version) {
    // Fall back to the version in app.json.
    const cfg = JSON.parse(readFileSync(resolve('app.json'), 'utf8'));
    args.version = cfg?.expo?.version;
  }
  if (!args.version) {
    console.error('Missing --version and no version in app.json.');
    process.exit(2);
  }
  if (!args.minimum) args.minimum = args.version;
  return args;
}

function sha256(file: string): string {
  const data = readFileSync(file);
  return createHash('sha256').update(data).digest('hex');
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var ${name}`);
    process.exit(2);
  }
  return value;
}

function run(cmd: string, args: string[]): void {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
  console.log(out);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const apkPath = resolve(args.apk);
  if (!existsSync(apkPath)) {
    console.error(`APK not found: ${apkPath}`);
    process.exit(2);
  }

  const apkName = `memeplan-${args.version}.apk`;
  const shasum = sha256(apkPath);
  requireEnv('CLOUDFLARE_ACCOUNT_ID');
  requireEnv('CLOUDFLARE_API_TOKEN');
  const bucket = requireEnv('R2_BUCKET_NAME');
  const publicUrl = requireEnv('R2_PUBLIC_URL').replace(/\/$/, '');
  const kvNamespace = requireEnv('CLOUDFLARE_KV_NAMESPACE_ID');

  const r2Object = `${bucket}/android/${apkName}`;
  const apkUrl = `${publicUrl}/android/${apkName}`;

  const versionJson = {
    platform: 'android',
    latestVersion: args.version,
    minimumVersion: args.minimum,
    forceUpdate: false,
    apkUrl,
    apkName,
    sha256: shasum,
    releaseNotes: args.notes.length ? args.notes : [`MemePlan ${args.version}`],
    publishedAt: new Date().toISOString(),
    ota: { enabled: true, runtimeVersion: args.version },
  };

  console.log('--- Release summary ---');
  console.log(`version=${args.version} minimum=${args.minimum}`);
  console.log(`apk=${apkName}`);
  console.log(`sha256=${shasum}`);
  console.log(`apkUrl=${apkUrl}`);
  console.log(`r2=${r2Object}`);
  console.log('-----------------------');

  // 1. Upload the APK to R2.
  run('npx', [
    'wrangler',
    'r2',
    'object',
    'put',
    r2Object,
    '--file',
    apkPath,
    '--content-type',
    'application/vnd.android.package-archive',
    '--cache-control',
    'public, max-age=31536000, immutable',
  ]);

  // 2. Write the canonical version metadata into the repo (fallback for the Worker).
  writeFileSync(
    resolve('cloudflare/worker/src/version.json'),
    `${JSON.stringify(versionJson, null, 2)}\n`,
    'utf8',
  );
  console.log('wrote cloudflare/worker/src/version.json');

  // 3. Push the metadata to the Worker's KV namespace.
  const kvJson = JSON.stringify(versionJson);
  const tmp = resolve(`tmp-version-${args.version}.json`);
  writeFileSync(tmp, kvJson, 'utf8');
  run('npx', [
    'wrangler',
    'kv',
    'key',
    'put',
    'android-version',
    '--namespace-id',
    kvNamespace,
    '--path',
    tmp,
    '--remote',
  ]);

  console.log('Published. Users will see v' + args.version + ' on next check.');
}

main();