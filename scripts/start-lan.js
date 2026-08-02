const os = require('node:os');
const { spawn } = require('node:child_process');

function score(address) {
  if (address.startsWith('192.168.')) return 30;
  if (address.startsWith('10.')) return 20;
  const match = /^172\.(\d+)\./.exec(address);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return 10;
  return 0;
}

const candidates = Object.values(os.networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'))
  .sort((left, right) => score(right.address) - score(left.address));

const address = candidates[0]?.address;
if (!address) {
  console.error('TaskOrg: no se encontró una dirección IPv4 local activa.');
  process.exit(1);
}

console.log(`TaskOrg: Expo usará la dirección local ${address}.`);
const expoCli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, [expoCli, 'start', '--lan', '--clear'], {
  env: {
    ...process.env,
    EXPO_OFFLINE: '1',
    REACT_NATIVE_PACKAGER_HOSTNAME: address,
  },
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
