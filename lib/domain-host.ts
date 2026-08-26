export function splitHostAndPort(host: string | null) {
  if (!host) {
    return { hostname: null, port: null };
  }

  const [hostname, port] = host.split(':');
  return {
    hostname: hostname || null,
    port: port || null,
  };
}

export function getLocalDevelopmentSubdomain(hostname: string | null) {
  if (!hostname?.endsWith('.localhost')) return null;

  const candidate = hostname.slice(0, -'.localhost'.length);
  return candidate && !candidate.includes('.') ? candidate : null;
}
