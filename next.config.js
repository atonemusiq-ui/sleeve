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
};

module.exports = nextConfig;
