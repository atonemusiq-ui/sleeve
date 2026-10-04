// Fyby Connect: the roles people can offer, shown as checkboxes on a Connect
// profile (app/connect/me) and as the "I'm looking for a…" choices on the
// search page (app/connect). Stored on connect_profiles.roles by key, so a
// label can be reworded later without touching anyone's saved profile.
//
// One list for everyone: artists, session players, engineers, and creatives
// who don't sell music on Fyby (managers, designers, photographers…).

export type ConnectRoleGroup = "music" | "sound" | "business";

export type ConnectRole = { key: string; label: string; group: ConnectRoleGroup };

export const CONNECT_ROLES: ConnectRole[] = [
  // Make the music
  { key: "producer", label: "Producer", group: "music" },
  { key: "beatmaker", label: "Beatmaker", group: "music" },
  { key: "songwriter", label: "Songwriter", group: "music" },
  { key: "lyricist", label: "Lyricist", group: "music" },
  { key: "lead_vocalist", label: "Lead vocalist", group: "music" },
  { key: "background_vocalist", label: "Background vocalist", group: "music" },
  { key: "rapper", label: "Rapper", group: "music" },
  { key: "electric_guitar", label: "Electric guitarist", group: "music" },
  { key: "acoustic_guitar", label: "Acoustic guitarist", group: "music" },
  { key: "bass", label: "Bass player", group: "music" },
  { key: "keys", label: "Keyboard / piano", group: "music" },
  { key: "drums", label: "Drummer", group: "music" },
  { key: "violin", label: "Violinist", group: "music" },
  { key: "cello", label: "Cellist", group: "music" },
  { key: "horns", label: "Horns (sax, trumpet, trombone)", group: "music" },
  // Make it sound right
  { key: "mixing", label: "Mixing engineer", group: "sound" },
  { key: "mastering", label: "Mastering engineer", group: "sound" },
  { key: "studio", label: "Recording studio / engineer", group: "sound" },
  // Business and visuals
  { key: "manager", label: "Manager", group: "business" },
  { key: "booking_agent", label: "Booking agent", group: "business" },
  { key: "cover_designer", label: "Album cover / graphic designer", group: "business" },
  { key: "photographer", label: "Photographer", group: "business" },
  { key: "video_director", label: "Music video director", group: "business" },
  { key: "web_designer", label: "Website designer", group: "business" },
  { key: "publicist", label: "Publicist / social media", group: "business" },
];

export const CONNECT_ROLE_GROUPS: { key: ConnectRoleGroup; label: string }[] = [
  { key: "music", label: "Make the music" },
  { key: "sound", label: "Make it sound right" },
  { key: "business", label: "Business and visuals" },
];

export const MAX_CONNECT_ROLES = 5;

const BY_KEY = new Map(CONNECT_ROLES.map((r) => [r.key, r]));

export function isConnectRole(value: unknown): value is string {
  return typeof value === "string" && BY_KEY.has(value);
}

export function connectRoleLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

export const CONNECT_REQUEST_STATUSES = ["new", "accepted", "declined", "done"] as const;
export type ConnectRequestStatus = (typeof CONNECT_REQUEST_STATUSES)[number];
