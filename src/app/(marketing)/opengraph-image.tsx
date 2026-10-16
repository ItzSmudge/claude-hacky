import { ImageResponse } from "next/og";
import { BRAND } from "@/components/marketing/brand-colors";

// Owner: marketing (MK-05). Link preview for the landing page.
export const alt = "PaperCut — swipe right on research. Real papers, a bibliography you can trust.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Scissors({ size: px, color }: { size: number; color: string }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: "rotate(-45deg)" }}
    >
      <circle cx="6" cy="6" r="3" />
      <path d="M8.12 8.12 12 12" />
      <path d="M20 4 8.12 15.88" />
      <circle cx="6" cy="18" r="3" />
      <path d="M14.8 14.8 20 20" />
    </svg>
  );
}

/** One index card in the stack; offsets fan the three cards out. */
function Card({
  top,
  left,
  rotate,
  title,
}: {
  top: number;
  left: number;
  rotate: number;
  title?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: 360,
        height: 230,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 28,
        borderRadius: 28,
        background: BRAND.card,
        border: `2px solid ${BRAND.cream300}`,
        transform: `rotate(${rotate}deg)`,
        boxShadow: `0 24px 48px -20px ${BRAND.teal900}`,
      }}
    >
      <div
        style={{
          display: "flex",
          height: 14,
          width: 180,
          borderRadius: 7,
          background: BRAND.cream200,
        }}
      />
      {title ? (
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.2,
            color: BRAND.teal700,
          }}
        >
          {title}
        </div>
      ) : (
        <div
          style={{ display: "flex", height: 60, borderRadius: 10, background: BRAND.cream100 }}
        />
      )}
      <div style={{ display: "flex", height: 40, borderRadius: 14, background: BRAND.cream200 }} />
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: BRAND.teal700,
        color: BRAND.cream200,
        padding: 72,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 640,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}
        >
          <Scissors size={44} color={BRAND.cream200} />
          PaperCut
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -2,
            }}
          >
            Swipe right on research.
          </div>
          <div style={{ display: "flex", fontSize: 32, lineHeight: 1.35, color: BRAND.cream100 }}>
            Real papers, why each one matters for your brief, and a bibliography you can trust.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", flex: 1 }}>
        <Card top={150} left={70} rotate={8} />
        <Card top={120} left={40} rotate={-4} />
        <Card top={90} left={20} rotate={0} title="Every citation is real." />
      </div>
    </div>,
    size,
  );
}
