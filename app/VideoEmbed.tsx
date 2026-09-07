import { parseVideoEmbedUrl } from "@/lib/videoEmbed";

// Renders an artist's bio video (app/dashboard/VideoManager.tsx writes it,
// app/artists/[id]/page.tsx and the dashboard preview both read it) —
// either a native <video> for an uploaded file, or an embedded iframe for a
// YouTube/Vimeo link. Renders nothing for a link that no longer parses
// (lib/videoEmbed.ts) rather than a broken iframe.
export default function VideoEmbed({
  type,
  url,
  className,
}: {
  type: "link" | "upload";
  url: string;
  className?: string;
}) {
  if (type === "upload") {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video controls src={url} className={className ?? "w-full aspect-video rounded-lg bg-black"} />;
  }

  const embedSrc = parseVideoEmbedUrl(url);
  if (!embedSrc) return null;

  return (
    <iframe
      src={embedSrc}
      className={className ?? "w-full aspect-video rounded-lg"}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}
