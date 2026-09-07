// Shown as a required checkbox next to both video entry methods (link and
// upload) in app/dashboard/VideoManager.tsx, same pattern as
// RIGHTS_ATTESTATION_TEXT in lib/aiDisclosure.ts. There's no automated
// content scanning behind this — enforcement is the report link on the
// public artist page (app/artists/[id]/ReportVideoButton.tsx) feeding the
// admin review queue (app/admin/videos/page.tsx), so the attestation itself
// is the artist's up-front agreement to the policy it describes.
export const VIDEO_CONTENT_POLICY_TEXT =
  "I confirm this video does not contain nudity, sexual acts, or other sexually explicit content. Videos that violate this policy may be removed without notice, and repeated violations may result in losing access to Fyby.";
