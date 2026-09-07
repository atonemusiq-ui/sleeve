// Converts a YouTube or Vimeo watch/share link into an embeddable iframe
// src, for the "link" video tier (see lib/videoTiers.ts). Returns null for
// anything else — an unrecognized host, a malformed URL, or a recognized
// host without an extractable video id — so callers (app/actions/video.ts
// at save time, and anywhere the video actually renders) can reject or
// fall back cleanly instead of embedding a broken iframe.
export function parseVideoEmbedUrl(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtube.com") {
    const id = u.searchParams.get("v");
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    const shortsMatch = u.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shortsMatch) return `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}`;
    return null;
  }

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  if (host === "vimeo.com") {
    const match = u.pathname.match(/^\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }

  return null;
}
