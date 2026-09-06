/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Server Actions (the <form action={...}> calls this app uses for
      // login/signup/checkout/Stripe Connect/etc.) are blocked by Next's
      // built-in same-origin check unless the requesting origin is listed
      // here. Needed because the app is reached through an ngrok tunnel,
      // whose domain differs from localhost. If your ngrok URL ever
      // changes, add the new one here too.
      allowedOrigins: ["localhost:3000", "underpaid-unreached-liberty.ngrok-free.dev"],
    },
  },
  // Fyby had no frame protections at all before the embeddable buy widget
  // (Phase 6, app/embed/[trackId]/page.tsx). Adding them now: every route
  // EXCEPT /embed/* refuses to render inside anyone else's iframe (blocks
  // clickjacking of login, checkout, dashboard, etc.), while /embed/* is left
  // unrestricted so the widget can actually be dropped into a third-party
  // page. The negative-lookahead `source` pattern is Next's documented way
  // to match "everything except this prefix" for a headers() rule.
  async headers() {
    return [
      {
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
