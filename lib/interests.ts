// Interest tags a member can pick on /interests (beyond genres). They tell
// the Fyby Engine (lib/engine.ts) what kinds of offers are relevant once
// advertising launches: gear, lessons, events. Deliberately about music
// life only; nothing here describes who someone is.
export const INTEREST_TAGS: { key: string; label: string }[] = [
  { key: "plays_guitar", label: "I play guitar" },
  { key: "plays_bass", label: "I play bass" },
  { key: "plays_keys", label: "I play keys / piano" },
  { key: "plays_drums", label: "I play drums" },
  { key: "sings", label: "I sing" },
  { key: "produces", label: "I make beats / produce" },
  { key: "dj", label: "I DJ" },
  { key: "home_studio", label: "Home studio gear" },
  { key: "headphones_audio", label: "Headphones and speakers" },
  { key: "lessons", label: "Music lessons" },
  { key: "live_shows", label: "Concerts and live shows" },
  { key: "vinyl", label: "Vinyl collecting" },
  { key: "church_music", label: "Church and choir music" },
];
