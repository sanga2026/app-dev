// modules/session/session-utils.ts (or inside SessionService)

export function simplifyUserAgent(ua: string): string {
  if (!ua) return 'Unknown Device';

  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const platform = isMobile ? 'Mobile' : 'Desktop';
  
  let browser = 'Unknown Browser';
  if (/chrome|crios/i.test(ua) && !/edge|opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opr/i.test(ua)) browser = 'Opera';

  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  return `${browser} on ${os} (${platform})`;
}