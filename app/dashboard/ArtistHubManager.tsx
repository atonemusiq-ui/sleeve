"use client";

import { useState, useTransition } from "react";
import {
  updateCustomLinks,
  updateTourDates,
  updateMailingListEnabled,
  type CustomLink,
} from "@/app/actions/artistHub";

const MAX_LINKS = 8;

// Three independent pieces (custom links, tour dates, mailing-list toggle)
// in one card, each saved by its own server action -- so fixing a typo in
// one link doesn't require re-saving the tour dates block too, and vice
// versa. All three land on artists (custom_links, tour_dates,
// mailing_list_enabled -- supabase/schema.sql) and render together on the
// public artist page (app/artists/[id]/page.tsx).
export default function ArtistHubManager({
  customLinks,
  tourDates,
  mailingListEnabled,
  fanEmails,
}: {
  customLinks: CustomLink[];
  tourDates: string | null;
  mailingListEnabled: boolean;
  fanEmails: string[];
}) {
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<CustomLink[]>(customLinks.length > 0 ? customLinks : [{ label: "", url: "" }]);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [linksSaved, setLinksSaved] = useState(false);
  const [linksPending, startLinksTransition] = useTransition();

  const [dates, setDates] = useState(tourDates ?? "");
  const [datesError, setDatesError] = useState<string | null>(null);
  const [datesSaved, setDatesSaved] = useState(false);
  const [datesPending, startDatesTransition] = useTransition();

  const [enabled, setEnabled] = useState(mailingListEnabled);
  const [enabledPending, startEnabledTransition] = useTransition();

  function updateLink(index: number, field: "label" | "url", value: string) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLink() {
    setLinks((prev) => (prev.length >= MAX_LINKS ? prev : [...prev, { label: "", url: "" }]));
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function saveLinks() {
    setLinksError(null);
    setLinksSaved(false);
    const formData = new FormData();
    links.forEach((l) => {
      formData.append("label", l.label);
      formData.append("url", l.url);
    });
    startLinksTransition(async () => {
      const result = await updateCustomLinks(formData);
      if (result.error) setLinksError(result.error);
      else setLinksSaved(true);
    });
  }

  function saveDates() {
    setDatesError(null);
    setDatesSaved(false);
    const formData = new FormData();
    formData.set("tourDates", dates);
    startDatesTransition(async () => {
      const result = await updateTourDates(formData);
      if (result.error) setDatesError(result.error);
      else setDatesSaved(true);
    });
  }

  function toggleMailingList(next: boolean) {
    setEnabled(next);
    const formData = new FormData();
    formData.set("enabled", String(next));
    startEnabledTransition(async () => {
      const result = await updateMailingListEnabled(formData);
      if (result.error) setEnabled(!next);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-xs text-paper/60 mb-3">
          Up to {MAX_LINKS} links shown on your public page — Instagram, TikTok, a website,
          anywhere else fans should find you.
        </p>
        <div className="flex flex-col gap-2">
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={link.label}
                onChange={(e) => updateLink(i, "label", e.target.value)}
                placeholder="Label (e.g. Instagram)"
                className="w-1/3 bg-paper/5 border border-paper/20 rounded px-3 py-1.5 text-paper font-mono text-xs"
              />
              <input
                type="text"
                value={link.url}
                onChange={(e) => updateLink(i, "url", e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-paper/5 border border-paper/20 rounded px-3 py-1.5 text-paper font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="font-mono text-xs px-2 text-paper/50 hover:text-rust"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          {links.length < MAX_LINKS && (
            <button
              type="button"
              onClick={addLink}
              className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10"
            >
              + Add link
            </button>
          )}
          <button
            type="button"
            onClick={saveLinks}
            disabled={linksPending}
            className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-50"
          >
            {linksPending ? "Saving…" : "Save links"}
          </button>
          {linksSaved && <span className="font-mono text-xs text-forest">Saved.</span>}
        </div>
        {linksError && <p className="font-mono text-xs text-rust mt-2">{linksError}</p>}
      </div>

      <div className="ticket-divider" />

      <div>
        <p className="font-mono text-xs text-paper/60 mb-3">
          A plain-text block for upcoming shows — one per line, however you want to format it.
          Shown on your public page under your links.
        </p>
        <textarea
          value={dates}
          onChange={(e) => setDates(e.target.value)}
          rows={5}
          placeholder={"Oct 4 — The Hi Hat, Los Angeles\nNov 12 — House of Blues, San Diego"}
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono text-xs"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={saveDates}
            disabled={datesPending}
            className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-50"
          >
            {datesPending ? "Saving…" : "Save tour dates"}
          </button>
          {datesSaved && <span className="font-mono text-xs text-forest">Saved.</span>}
        </div>
        {datesError && <p className="font-mono text-xs text-rust mt-2">{datesError}</p>}
      </div>

      <div className="ticket-divider" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-paper">Mailing list signup</p>
          <p className="font-mono text-xs text-paper/60 mt-1">
            When on, your public page shows an email signup box. Addresses go straight to you —
            there&apos;s no bulk-send tool here, just the list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleMailingList(!enabled)}
          disabled={enabledPending}
          className={`flex-shrink-0 font-mono text-xs px-3 py-1.5 rounded border disabled:opacity-50 ${
            enabled
              ? "border-forest/40 text-forest hover:bg-forest/10"
              : "border-paper/20 text-paper/50 hover:bg-paper/10"
          }`}
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>

      {fanEmails.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs text-paper/60">
              {fanEmails.length} signup{fanEmails.length === 1 ? "" : "s"} so far
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(fanEmails.join("\n"));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="font-mono text-xs px-2 py-1 rounded border border-paper/20 hover:bg-paper/10"
            >
              {copied ? "Copied!" : "Copy emails"}
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto border border-paper/15 rounded p-2">
            {fanEmails.map((email) => (
              <p key={email} className="font-mono text-xs text-paper/70">
                {email}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
