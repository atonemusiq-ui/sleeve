"use client";

import { useState } from "react";
import Link from "next/link";
import { markAllNotificationsRead } from "@/app/actions/notifications";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

// Shown in the Artist Studio header (app/dashboard/page.tsx) next to the
// account links. No realtime/polling infrastructure exists in this app yet,
// so this shows whatever the server had at page load — a fresh sale,
// booking, or refund shows up the next time the artist loads or refreshes
// the dashboard, same as every other piece of dashboard data here.
export default function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative font-mono text-sm hover:text-gold"
        aria-label="Notifications"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-3 bg-rust text-paper text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-outside catcher — a plain fixed overlay under the panel
              rather than a document listener, consistent with this app not
              reaching for extra client-side event wiring where a simpler DOM
              trick does the job. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[calc(100vw-3rem)] max-w-80 max-h-96 overflow-y-auto bg-ink border border-paper/20 rounded-lg shadow-lg z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-paper/10">
              <span className="font-display text-sm">Notifications</span>
              {unreadCount > 0 && (
                <form action={markAllNotificationsRead}>
                  <button type="submit" className="font-mono text-xs text-gold hover:underline">
                    Mark all read
                  </button>
                </form>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center font-mono text-xs text-paper/50">Nothing yet.</p>
            ) : (
              notifications.map((n) => {
                const body = (
                  <div className={`px-4 py-3 border-b border-paper/10 ${n.read ? "" : "bg-gold/5"}`}>
                    <p className="text-sm">{n.title}</p>
                    {n.body && <p className="font-mono text-xs text-paper/60 mt-1">{n.body}</p>}
                    <p className="font-mono text-[10px] text-paper/40 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)} className="block hover:bg-paper/5">
                    {body}
                  </Link>
                ) : (
                  <div key={n.id}>{body}</div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
