import type { MerchProductKey } from "@/lib/merchCatalog";

// Simple product drawings in the site's colors, used as the backdrop for an
// artist's design until Printful mockups are wired in. Server-safe (no hooks).
const BODY = "#2b2436";
const SHADE = "#3a3148";
const FLAME = "#FF5A36";
const INK = "#16121A";

const LIGHT: Record<string, string> = { White: "#e8e1d3", Oyster: "#d9cfbd" };

function bodyFor(color?: string): string {
  return (color && LIGHT[color]) || BODY;
}

function Svg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

export function MerchArt({ productKey, color, logo = true }: { productKey: MerchProductKey; color?: string; logo?: boolean }) {
  const body = bodyFor(color);
  switch (productKey) {
    case "tee":
      return (
        <Svg label="T-shirt">
          <path d="M40 22 28 28 14 44l12 10 8-8v54h52V46l8 8 12-10-14-16-12-6c-4 8-36 8-40 0Z" fill={body} />
          {logo && (
            <>
              <circle cx="60" cy="58" r="13" fill={FLAME} />
              <path d="M56 52 66 58 56 64Z" fill={INK} />
            </>
          )}
        </Svg>
      );
    case "hoodie":
      return (
        <Svg label="Hoodie">
          <path d="M44 20c0-6 32-6 32 0l14 8 16 18-12 10-8-8v56H34V48l-8 8-12-10 16-18Z" fill={body} />
          <path d="M46 20c2 14 26 14 28 0" fill="none" stroke={INK} strokeWidth="3" />
          <path d="M44 78h32v14H44z" fill="none" stroke={INK} strokeWidth="2" />
          {logo && <circle cx="60" cy="58" r="9" fill={FLAME} />}
        </Svg>
      );
    case "hat":
      return (
        <Svg label="Hat">
          <path d="M22 76c0-26 16-40 38-40s38 14 38 40Z" fill={body} />
          <path d="M60 76h46c4 0 6 8-2 10H60Z" fill={SHADE} />
          <path d="M60 36v40" stroke={INK} strokeWidth="2" />
          {logo && <circle cx="44" cy="58" r="8" fill={FLAME} />}
        </Svg>
      );
    case "tote":
      return (
        <Svg label="Tote bag">
          <path d="M44 46c0-24 32-24 32 0" fill="none" stroke={SHADE} strokeWidth="5" />
          <rect x="28" y="44" width="64" height="62" rx="4" fill={body} />
          {logo && (
            <>
              <circle cx="60" cy="76" r="14" fill="none" stroke={FLAME} strokeWidth="4" />
              <circle cx="60" cy="76" r="4" fill={FLAME} />
            </>
          )}
        </Svg>
      );
    case "mug":
      return (
        <Svg label="Mug">
          <path d="M30 34h50v56a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8Z" fill={LIGHT.White} />
          <path d="M80 46h8a14 14 0 0 1 0 28h-8" fill="none" stroke={LIGHT.White} strokeWidth="6" />
          {logo && <circle cx="55" cy="66" r="11" fill={FLAME} />}
        </Svg>
      );
  }
}

// Where the design sits on each drawing, as a % box of the square tile.
const DESIGN_BOX: Record<MerchProductKey, string> = {
  tee: "left-[34%] top-[36%] w-[32%] h-[32%]",
  hoodie: "left-[36%] top-[38%] w-[28%] h-[24%]",
  hat: "left-[24%] top-[40%] w-[30%] h-[18%]",
  tote: "left-[30%] top-[46%] w-[40%] h-[36%]",
  mug: "left-[32%] top-[38%] w-[30%] h-[40%]",
};

// The product drawing with the artist's own design laid on top.
export function MerchPreview({
  productKey,
  color,
  designUrl,
}: {
  productKey: MerchProductKey;
  color: string;
  designUrl: string | null;
}) {
  return (
    <div className="relative w-full h-full">
      <MerchArt productKey={productKey} color={color} logo={!designUrl} />
      {designUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={designUrl} alt="" className={`absolute object-contain ${DESIGN_BOX[productKey]}`} />
      )}
    </div>
  );
}
