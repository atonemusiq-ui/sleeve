// English: the source text. Every other language mirrors these keys
// (es.ts is type-checked against this file); anything a language leaves out
// shows in English. {name}-style placeholders are filled in at runtime.
const en = {
  language: {
    menu: "Language",
  },
  nav: {
    home: "Home",
    radio: "Radio",
    tv: "TV",
    merch: "Merch",
    connect: "Connect",
    discover: "Discover",
    advertise: "Advertise",
    aiMusic: "AI Music",
    myMusic: "My Music",
    artists: "Artists",
    dashboard: "Dashboard",
    logIn: "Log in",
    signUp: "Sign up",
    homeLabel: "Fyby home",
  },
  hero: {
    welcome: "Welcome to Fyby",
    title1: "Sell your music.",
    title2: "Keep the money.",
    body:
      "Fyby lets you sell tracks and albums directly to fans — no label, no fraction of a cent per stream. You set the price, fans buy it once, and you keep the large majority of every sale. Whether it's your first upload or your fiftieth, you're always in the driver's seat here.",
    cta: "Start Selling",
  },
  how: {
    heading: "How it works",
    step1Title: "1. Upload your music",
    step1Body: "Add your tracks, set a price, and release — takes minutes, no label required.",
    step2Title: "2. Fans buy directly",
    step2Body:
      "Fans find your music and buy it outright, at the price you set — not a fraction of a cent per stream.",
    step3Title: "3. Get paid fast",
    step3Body:
      "You keep 85% or more of every sale (more on paid plans), paid out to your bank account through Stripe in days, not months.",
  },
  founder: {
    heading: "Why I Built This",
    p1:
      "I grew up in Compton, and before I ever built an app, I built songs — writing and producing for artists like Diana Ross, Babyface, Toni Braxton, After 7, and Tevin Campbell. I know what it feels like to pour your life into a record and watch it move people. I also know what it feels like to watch the business side of music quietly take more than its share from the people who actually made it.",
    p2:
      "Streaming changed the way the world listens to music — but it didn't change who gets paid fairly for it. An artist can rack up a thousand plays and still owe more in coffee money than they earned from the stream. That gap between the work and the reward is what Fyby exists to close.",
    p3:
      "I built Fyby so independent artists can sell directly to the people who actually want to support them — no label taking a cut, no algorithm deciding who gets heard, no waiting months for pennies to trickle in. Just an artist, a fan, and a fair deal.",
    p4:
      "This isn't a side project for me. It's built by someone who's lived on both sides of the music business — the studio and the deal — and wants something better for the next generation of artists coming up.",
    signoff: "— Anthony \"A-Tone\" Bryant, Founder",
  },
  trust: {
    body:
      "Artists keep 85% or more of every sale. Payments are processed securely through Stripe — Fyby never sees or stores your card details.",
    cta: "Start Selling",
    terms: "Terms",
    privacy: "Privacy",
    artistAgreement: "Artist Agreement",
  },
  featured: {
    heading: "Hear it for yourself",
    sub: "Real tracks, on sale right now — no sample loops, no mockups.",
  },
  home: {
    aiNote:
      "Artists disclose it themselves when a track involves AI-generated vocals, instrumentation, or production — look for the \"AI-Assisted\"/\"Fully AI-Generated\" label on those tracks",
    aiNoteMarketLead: ", browse the AI Music row below, or visit the ",
    aiNoteMarketLink: "dedicated AI Music marketplace",
    aiNoteMarketTail: " for tracks that are 100% AI-generated.",
    discoverLead: " Want more ways to browse — trending tracks, or a feed picked for you? Head to ",
    discoverLink: "Discover",
    loadError: "Couldn't load tracks: {message}",
  },
  store: {
    search: "Search tracks or artists...",
    noMatch: "No tracks match \"{query}\".",
    noTracks: "No tracks released yet.",
    newReleases: "New Releases",
    aiMusic: "AI Music",
    all: "All",
    unknownArtist: "Unknown artist",
    preorderOut: "Pre-order · Out {date}",
    partOfAlbumOne: "Part of the album {title} ({count} track)",
    partOfAlbumOther: "Part of the album {title} ({count} tracks)",
    coverPending: "This cover is pending the original songwriter/producer credit — check back soon.",
    albumPending: "Full album pending a songwriter/producer credit on one of its covers.",
    buySong: "Buy this song",
    buy: "Buy",
    logInToBuy: "Log in to buy",
    preorder: "Pre-order",
    logInToPreorder: "Log in to pre-order",
    album: "Album {price}",
    buyAlbum: "Buy full album",
  },
  badges: {
    ai_assisted: "AI-Assisted",
    ai_generated: "Fully AI-Generated",
    verified: "Verified Human+AI",
    explicit: "Explicit",
  },
  login: {
    title: "Welcome back",
    sub: "Log in to keep selling — or keep supporting the artists you love.",
    email: "Email",
    password: "Password",
    submit: "Log in",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
    forgot: "Forgot your password?",
    quote:
      "\"I built Fyby so independent artists can sell directly to the people who actually want to support them — no label taking a cut, no algorithm deciding who gets heard.\"",
    quoteBy: "— Anthony \"A-Tone\" Bryant, Founder",
    readStory: "Read the full story",
  },
  signup: {
    title: "Create your account",
    sub: "Join Fyby to start selling your music, or supporting the artists you love.",
    foundingLeft: "{left} of {total} Founding Artist spots left",
    foundingBody: "Sign up as an artist now and lock in Pro at {price}/mo for as long as you're on Fyby.",
    displayName: "Display name",
    email: "Email",
    password: "Password",
    iAmA: "I am a...",
    artist: "Artist",
    fan: "Fan",
    twoStepLabel: "Two-step signup:",
    twoStepBody: "artists confirm their email with a 6-digit code before their account opens.",
    fanVerify: "Fans: verify my email with a code too",
    radioTitle: "📻 Fyby Radio comes with every account",
    radioFansLabel: "Fans:",
    radioFans: "listen free, nonstop, by genre or mood, and buy any song you hear with one tap.",
    radioArtistsLabel: "Artists:",
    radioArtists:
      "check \"Play on Fyby Radio\" when you upload. Every new artist gets extra plays free for their first month, and you can premiere a new song for heavy rotation.",
    submit: "Sign up",
    agreeLead: "By signing up, you agree to Fyby's",
    terms: "Terms",
    and: "and",
    privacy: "Privacy Policy",
    artistsAlso: "— Artists also agree to the",
    artistAgreement: "Artist Agreement",
    haveAccount: "Already have an account?",
    logIn: "Log in",
  },
  artist: {
    back: "← Back to Fyby",
    myMusic: "My Music",
    logIn: "Log in",
    hidden:
      "Your page is hidden — this is a preview only. Fans can't see this page or buy your music right now.",
    reactivate: "Reactivate it from your dashboard",
    superfanThanks:
      "You're a Super Fan of {name} — thank you. Your first month is paid, and {name} has been notified.",
    giftThanks: "Your gift is on its way to {name} — thank you.",
    yourPage: "This is your page:",
    editPhotos: "📷 Edit photos",
    manageSongs: "🎵 Manage songs",
    editBio: "✏️ Edit bio & links",
    editPhotoTitle: "Replace or remove this photo",
    edit: "✏️ Edit",
    photoAlt: "{name} photo {n}",
    tourDates: "Tour dates",
    mailingList: "Mailing list",
    noTracks: "No tracks released yet.",
    coverPending: "Pending original songwriter/producer credit — check back soon.",
    buyingOff: "Buying is off while your page is hidden.",
    license: "💼 License this song · from ${price}",
    vinyl: "💿 Get it on Vinyl →",
    merch: "👕 Merch",
    availableFor: "🤝 Available for",
    workWith: "Work with {name} on Fyby Connect →",
    bookTitle: "Book or collaborate with this artist",
    bookDescription:
      "Send a booking or collaboration inquiry straight to the artist — they'll reach out at the email you give below.",
  },
  buy: {
    gift: "This is a gift",
    sendGift: "Send as a gift",
  },
  lyrics: {
    button: "Lyrics & Credits",
    lyrics: "Lyrics",
    credits: "Credits",
    close: "Close",
  },
  follow: {
    follow: "Follow",
    following: "Following",
  },
  mailing: {
    join: "Join mailing list",
    joining: "Joining…",
    joined: "You're on the list — {name} will reach out at the email you gave.",
  },
};

export default en;

// The shape every other language's file must match.
type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };
export type Messages = DeepStrings<typeof en>;
