import { hostname, networkInterfaces } from 'node:os';

export function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
}

export function localHostnames() {
  const name = hostname().toLowerCase();
  return new Set([
    'localhost',
    '127.0.0.1',
    '[::1]',
    '0.0.0.0',
    name,
    `${name}.local`,
    ...lanAddresses(),
  ]);
}

export function allowedHost(host, names) {
  try {
    const parsed = new URL(`http://${host}`);
    return parsed.host === host.toLowerCase() && names.has(parsed.hostname);
  } catch {
    return false;
  }
}
