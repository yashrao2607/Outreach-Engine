const tracker = new Map<string, number[]>();

export function rateLimit(ip: string, limit = 10, windowMs = 60 * 1000): boolean {
  const now = Date.now();
  if (!tracker.has(ip)) {
    tracker.set(ip, [now]);
    return true;
  }

  const timestamps = tracker.get(ip)!.filter(t => now - t < windowMs);
  if (timestamps.length >= limit) {
    tracker.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  tracker.set(ip, timestamps);
  return true;
}
