import type { Messages } from "./en";

// Spanish (neutral Latin American, for US and Latin American fans and
// artists). Mirrors en.ts key for key; brand and feature names (Fyby,
// Fyby Radio, Fyby Connect, Pro) stay in English.
const es: Messages = {
  language: {
    menu: "Idioma",
  },
  nav: {
    home: "Inicio",
    radio: "Radio",
    tv: "TV",
    merch: "Mercancía",
    connect: "Connect",
    discover: "Descubrir",
    advertise: "Anúnciate",
    aiMusic: "Música con IA",
    myMusic: "Mi música",
    artists: "Artistas",
    dashboard: "Panel",
    logIn: "Iniciar sesión",
    signUp: "Regístrate",
    homeLabel: "Inicio de Fyby",
  },
  hero: {
    welcome: "Bienvenido a Fyby",
    title1: "Vende tu música.",
    title2: "Quédate con el dinero.",
    body:
      "Fyby te permite vender canciones y álbumes directamente a tus fans: sin disquera y sin fracciones de centavo por reproducción. Tú pones el precio, tus fans la compran una vez y tú te quedas con la gran mayoría de cada venta. Ya sea tu primera canción o la número cincuenta, aquí siempre tienes el control.",
    cta: "Empieza a vender",
  },
  how: {
    heading: "Cómo funciona",
    step1Title: "1. Sube tu música",
    step1Body: "Agrega tus canciones, ponles precio y lánzalas. Toma minutos y no necesitas disquera.",
    step2Title: "2. Tus fans compran directo",
    step2Body:
      "Tus fans encuentran tu música y la compran al precio que tú pones, no por una fracción de centavo por reproducción.",
    step3Title: "3. Cobra rápido",
    step3Body:
      "Te quedas con el 85% o más de cada venta (más en los planes de pago), depositado en tu cuenta bancaria a través de Stripe en días, no en meses.",
  },
  founder: {
    heading: "Por qué creé Fyby",
    p1:
      "Crecí en Compton y, antes de crear una app, creé canciones: escribí y produje para artistas como Diana Ross, Babyface, Toni Braxton, After 7 y Tevin Campbell. Sé lo que se siente poner tu vida en una grabación y ver cómo conmueve a la gente. También sé lo que se siente ver cómo el lado comercial de la música se lleva, en silencio, más de lo que le corresponde de quienes realmente la hicieron.",
    p2:
      "El streaming cambió la forma en que el mundo escucha música, pero no cambió quién recibe un pago justo por ella. Un artista puede acumular mil reproducciones y aun así ganar menos de lo que cuesta un café. Fyby existe para cerrar esa brecha entre el trabajo y la recompensa.",
    p3:
      "Creé Fyby para que los artistas independientes puedan vender directamente a las personas que de verdad quieren apoyarlos: sin una disquera que se quede con una parte, sin un algoritmo que decida a quién se escucha y sin esperar meses a que lleguen unos centavos. Solo un artista, un fan y un trato justo.",
    p4:
      "Esto no es un proyecto secundario para mí. Lo creó alguien que ha vivido los dos lados del negocio de la música, el estudio y el contrato, y que quiere algo mejor para la próxima generación de artistas.",
    signoff: "— Anthony \"A-Tone\" Bryant, fundador",
  },
  trust: {
    body:
      "Los artistas se quedan con el 85% o más de cada venta. Los pagos se procesan de forma segura con Stripe: Fyby nunca ve ni guarda los datos de tu tarjeta.",
    cta: "Empieza a vender",
    terms: "Términos",
    privacy: "Privacidad",
    artistAgreement: "Acuerdo para artistas",
  },
  featured: {
    heading: "Escúchalo tú mismo",
    sub: "Canciones reales, a la venta ahora mismo: sin loops de muestra ni maquetas.",
  },
  home: {
    aiNote:
      "Los propios artistas indican cuando una canción tiene voces, instrumentos o producción generados con IA: busca la etiqueta \"Asistida por IA\"/\"Generada por IA\" en esas canciones",
    aiNoteMarketLead: ", explora la fila de Música con IA más abajo o visita el ",
    aiNoteMarketLink: "mercado de Música con IA",
    aiNoteMarketTail: " para canciones 100% generadas con IA.",
    discoverLead: " ¿Quieres más formas de explorar, como canciones en tendencia o una selección hecha para ti? Ve a ",
    discoverLink: "Descubrir",
    loadError: "No se pudieron cargar las canciones: {message}",
  },
  store: {
    search: "Busca canciones o artistas...",
    noMatch: "Ninguna canción coincide con \"{query}\".",
    noTracks: "Todavía no hay canciones publicadas.",
    newReleases: "Nuevos lanzamientos",
    aiMusic: "Música con IA",
    all: "Todo",
    unknownArtist: "Artista desconocido",
    preorderOut: "Preventa · Sale el {date}",
    partOfAlbumOne: "Parte del álbum {title} ({count} canción)",
    partOfAlbumOther: "Parte del álbum {title} ({count} canciones)",
    coverPending:
      "Este cover está pendiente del crédito al compositor o productor original. Vuelve pronto.",
    albumPending: "El álbum completo está pendiente del crédito a un compositor o productor en uno de sus covers.",
    buySong: "Comprar esta canción",
    buy: "Comprar",
    logInToBuy: "Inicia sesión para comprar",
    preorder: "Preordenar",
    logInToPreorder: "Inicia sesión para preordenar",
    album: "Álbum {price}",
    buyAlbum: "Comprar álbum completo",
  },
  badges: {
    ai_assisted: "Asistida por IA",
    ai_generated: "Generada por IA",
    verified: "Verificado Humano+IA",
    explicit: "Explícito",
  },
  login: {
    title: "Bienvenido de nuevo",
    sub: "Inicia sesión para seguir vendiendo o para seguir apoyando a los artistas que te gustan.",
    email: "Correo electrónico",
    password: "Contraseña",
    submit: "Iniciar sesión",
    noAccount: "¿No tienes cuenta?",
    signUp: "Regístrate",
    forgot: "¿Olvidaste tu contraseña?",
    quote:
      "\"Creé Fyby para que los artistas independientes puedan vender directamente a las personas que de verdad quieren apoyarlos: sin una disquera que se quede con una parte, sin un algoritmo que decida a quién se escucha.\"",
    quoteBy: "— Anthony \"A-Tone\" Bryant, fundador",
    readStory: "Lee la historia completa",
  },
  signup: {
    title: "Crea tu cuenta",
    sub: "Únete a Fyby para empezar a vender tu música o para apoyar a los artistas que te gustan.",
    foundingLeft: "Quedan {left} de {total} lugares de Artista Fundador",
    foundingBody:
      "Regístrate como artista ahora y asegura el plan Pro a {price}/mes mientras sigas en Fyby.",
    displayName: "Nombre artístico o de usuario",
    email: "Correo electrónico",
    password: "Contraseña",
    iAmA: "Soy...",
    artist: "Artista",
    fan: "Fan",
    twoStepLabel: "Registro en dos pasos:",
    twoStepBody: "los artistas confirman su correo con un código de 6 dígitos antes de abrir su cuenta.",
    fanVerify: "Fans: verificar mi correo con un código también",
    radioTitle: "📻 Fyby Radio viene con todas las cuentas",
    radioFansLabel: "Fans:",
    radioFans:
      "escucha gratis y sin parar, por género o estado de ánimo, y compra cualquier canción que oigas con un toque.",
    radioArtistsLabel: "Artistas:",
    radioArtists:
      "marca \"Tocar en Fyby Radio\" al subir tu música. Cada artista nuevo recibe reproducciones extra gratis su primer mes, y puedes estrenar una canción nueva en rotación frecuente.",
    submit: "Regístrate",
    agreeLead: "Al registrarte, aceptas los",
    terms: "Términos",
    and: "y la",
    privacy: "Política de privacidad",
    artistsAlso: "de Fyby. Los artistas también aceptan el",
    artistAgreement: "Acuerdo para artistas",
    haveAccount: "¿Ya tienes cuenta?",
    logIn: "Inicia sesión",
  },
  artist: {
    back: "← Volver a Fyby",
    myMusic: "Mi música",
    logIn: "Iniciar sesión",
    hidden:
      "Tu página está oculta; esto es solo una vista previa. Tus fans no pueden ver esta página ni comprar tu música por ahora.",
    reactivate: "Reactívala desde tu panel",
    superfanThanks:
      "Ya eres Super Fan de {name}. ¡Gracias! Tu primer mes está pagado y {name} ya recibió el aviso.",
    giftThanks: "Tu regalo va en camino a {name}. ¡Gracias!",
    yourPage: "Esta es tu página:",
    editPhotos: "📷 Editar fotos",
    manageSongs: "🎵 Administrar canciones",
    editBio: "✏️ Editar nombre y perfil",
    editPhotoTitle: "Cambiar o quitar esta foto",
    editNameTitle: "Cambiar tu nombre artístico",
    edit: "✏️ Editar",
    photoAlt: "Foto {n} de {name}",
    tourDates: "Fechas de gira",
    mailingList: "Lista de correo",
    noTracks: "Todavía no hay canciones publicadas.",
    coverPending: "Pendiente del crédito al compositor o productor original. Vuelve pronto.",
    buyingOff: "Las compras están desactivadas mientras tu página esté oculta.",
    license: "💼 Licenciar esta canción · desde ${price}",
    vinyl: "💿 Consíguelo en vinilo →",
    merch: "👕 Mercancía",
    availableFor: "🤝 Disponible para",
    workWith: "Trabaja con {name} en Fyby Connect →",
    bookTitle: "Contrata o colabora con este artista",
    bookDescription:
      "Envía una solicitud de contratación o colaboración directamente al artista; te contactará al correo que escribas abajo.",
  },
  buy: {
    gift: "Es un regalo",
    sendGift: "Enviar como regalo",
  },
  lyrics: {
    button: "Letra y créditos",
    lyrics: "Letra",
    credits: "Créditos",
    close: "Cerrar",
  },
  follow: {
    follow: "Seguir",
    following: "Siguiendo",
  },
  mailing: {
    join: "Unirme a la lista",
    joining: "Uniéndote…",
    joined: "Ya estás en la lista. {name} te escribirá al correo que diste.",
  },
};

export default es;
