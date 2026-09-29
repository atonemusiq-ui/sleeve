"use client";

import { useState, useTransition } from "react";
import { toggleFollow } from "@/app/actions/follows";

// Follow/Following toggle on the artist page (app/artists/[id]/page.tsx).
// Optimistic locally — flips immediately on click rather than waiting on
// the server action round-trip — since toggleFollow's own revalidatePath
// call (app/actions/follows.ts) will correct this if the mutation actually
// fails, and the failure mode (briefly showing the wrong follow state) is
// low-stakes compared to a laggy button.
export default function FollowButton({
  artistId,
  isFollowing,
}: {
  artistId: string;
  isFollowing: boolean;
}) {
  const [following, setFollowing] = useState(isFollowing);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const wasFollowing = following;
    setFollowing(!wasFollowing);

    const formData = new FormData();
    formData.set("artistId", artistId);
    formData.set("isFollowing", String(wasFollowing));

    startTransition(async () => {
      try {
        await toggleFollow(formData);
      } catch {
        // Revert the optimistic flip if the server action threw (e.g. not
        // logged in anymore, or a transient error) -- FollowButton is only
        // rendered for a logged-in user to begin with, so this is a rare
        // path, but the button shouldn't silently lie about follow state.
        setFollowing(wasFollowing);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        following
          ? "font-mono text-xs px-3 py-1.5 rounded border border-paper/20 text-paper/70 hover:border-rust/40 hover:text-rust disabled:opacity-50"
          : "font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
      }
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
