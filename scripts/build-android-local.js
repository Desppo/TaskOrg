const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const mobileRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

function firstDirectory(candidates) {
  return candidates.filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const androidSdk = firstDirectory([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  path.join(os.homedir(), 'Android', 'Sdk'),
]);

const javaHome = firstDirectory([
  isWindows ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : null,
  process.env.JAVA_HOME,
  process.platform === 'darwin' ? '/Applications/Android Studio.app/Contents/jbr/Contents/Home' : null,
]);

if (!androidSdk || !javaHome) {
  console.error('TaskOrg: instala Android Studio o configura ANDROID_HOME y JAVA_HOME (JDK 17+).');
  process.exit(1);
}

const buildEnv = {
  ...process.env,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
  JAVA_HOME: javaHome,
  NODE_ENV: 'production',
};

const expoCli = require.resolve('expo/bin/cli');
run(process.execPath, [expoCli, 'prebuild', '--platform', 'android', '--no-install'], mobileRoot, buildEnv);

const androidRoot = path.join(mobileRoot, 'android');
if (isWindows) {
  run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleRelease --no-daemon --console=plain'], androidRoot, buildEnv);
} else {
  run('./gradlew', ['assembleRelease', '--no-daemon', '--console=plain'], androidRoot, buildEnv);
}

const { version } = require(path.join(mobileRoot, 'package.json'));
const sourceApk = path.join(androidRoot, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const releaseDir = path.join(mobileRoot, 'releases');
const releaseApk = path.join(releaseDir, `TaskOrg-${version}-android-preview.apk`);

fs.mkdirSync(releaseDir, { recursive: true });
fs.copyFileSync(sourceApk, releaseApk);

const checksum = crypto.createHash('sha256').update(fs.readFileSync(releaseApk)).digest('hex').toUpperCase();
console.log(`\nAPK: ${releaseApk}`);
console.log(`SHA-256: ${checksum}`);
