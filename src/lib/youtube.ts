/**
 * Extracts the 11-character YouTube video id from any common URL shape
 * (watch?v=, youtu.be/, shorts/, embed/, live/) or a bare id. Returns null
 * when nothing that looks like a video id is present.
 */
export function extractYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
    return match ? match[1] : null;
  }
  return null;
}

export function youTubeEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
