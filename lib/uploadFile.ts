import type { SupabaseClient } from "@supabase/supabase-js";

// Every audio format Fyby takes. The extensions are listed alongside
// "audio/*" on purpose: some computers (and older iPhones) don't attach an
// audio MIME type to .aiff/.flac/.m4a files, and with "audio/*" alone the
// file picker greys those songs out so the artist can't select them.
export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".aif", ".aiff", ".flac", ".ogg", ".opus", ".caf"];
export const AUDIO_ACCEPT = ["audio/*", ...AUDIO_EXTENSIONS].join(",");

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  const lower = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Supabase Storage rejects object keys with characters outside plain ASCII
// ("Invalid key"). iPhones put curly apostrophes in names (Don’t Stop.mp3),
// and accents/emoji are common in song titles, so the raw file name can't go
// straight into the storage path. This keeps the name readable but safe.
export function safeFileName(name: string, fallback = "file"): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";

  const cleanBase = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: é -> e
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, "")
    .replace(/[^A-Za-z0-9 ._()'-]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-{2,}/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 100);

  const finalBase = cleanBase || fallback;
  return ext ? `${finalBase}.${ext.slice(0, 10)}` : finalBase;
}

// Uploads straight to Supabase Storage with a progress callback, so an
// artist on a phone sees the song actually moving instead of a button that
// just says "Releasing..." for a minute. Same endpoint and RLS policies that
// supabase.storage.from(bucket).upload() uses.
export async function uploadWithProgress(
  supabase: { auth: SupabaseClient["auth"] },
  bucket: string,
  path: string,
  file: Blob,
  onProgress?: (percent: number) => void
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your sign-in expired. Please sign in again, then upload.");

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      let message = xhr.responseText;
      try {
        const body = JSON.parse(xhr.responseText);
        message = body.message || body.error || message;
      } catch {
        // not JSON — keep the raw text
      }
      reject(new Error(friendlyUploadError(xhr.status, message)));
    };
    xhr.onerror = () =>
      reject(new Error("The upload lost its connection. Check your Wi-Fi or signal and try again."));
    xhr.ontimeout = () =>
      reject(new Error("The upload took too long and timed out. Try again on a stronger connection."));
    xhr.send(file);
  });
}

// Turns Supabase's technical errors into something an artist can act on.
export function friendlyUploadError(status: number, raw: string): string {
  const msg = (raw || "").toLowerCase();
  if (status === 413 || msg.includes("exceeded the maximum allowed size") || msg.includes("payload too large")) {
    return "This file is too big for Fyby. Export a smaller version (WAV at 44.1 kHz / 16-bit, or a 320 kbps MP3) and try again.";
  }
  if (msg.includes("invalid key")) {
    return "The file name has characters Fyby can't store. Rename the file using plain letters and numbers, then try again.";
  }
  if (status === 401 || status === 403 || msg.includes("jwt") || msg.includes("row-level security")) {
    return "Fyby couldn't confirm it's you. Sign out, sign back in, and try the upload again.";
  }
  if (msg.includes("already exists") || status === 409) {
    return "That file was already uploaded a moment ago. Refresh the page to check your tracks.";
  }
  if (status >= 500) {
    return "Fyby's storage had a hiccup. Wait a minute and try again.";
  }
  return `Upload failed (${status}): ${raw || "unknown error"}`;
}
