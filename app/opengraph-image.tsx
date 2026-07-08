import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "VENTIQ — AI Operating System for Private Capital";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "white",
          background:
            "radial-gradient(circle at 80% 10%, rgba(57, 112, 255, 0.42), transparent 34%), linear-gradient(135deg, #050a16 0%, #08152e 52%, #040814 100%)",
          fontFamily: "Arial",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "30px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
          }}
        >
          <div>VENTIQ</div>
          <div
            style={{
              fontSize: "18px",
              color: "#a8c5ff",
              border: "1px solid rgba(168, 197, 255, 0.38)",
              borderRadius: "999px",
              padding: "12px 20px",
            }}
          >
            Private Capital Operating Layer
          </div>
        </div>

        <div>
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              marginBottom: "26px",
              padding: "12px 18px",
              borderRadius: "999px",
              background: "rgba(47, 109, 242, 0.22)",
              color: "#bcd0ff",
              fontSize: "18px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            AI Operating System
          </div>

          <div
            style={{
              maxWidth: "930px",
              fontSize: "82px",
              lineHeight: "0.95",
              fontWeight: 900,
              letterSpacing: "-0.07em",
            }}
          >
            Run fund operations from one connected layer.
          </div>

          <div
            style={{
              maxWidth: "900px",
              marginTop: "30px",
              color: "#c9d8f5",
              fontSize: "28px",
              lineHeight: "1.35",
            }}
          >
            Capital calls, distributions, repayment notices, compliance,
            portfolio intelligence and investor reporting for private capital teams.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "18px",
            color: "#dbe8ff",
            fontSize: "20px",
            fontWeight: 700,
          }}
        >
          <span>VC</span>
          <span>•</span>
          <span>PE</span>
          <span>•</span>
          <span>Private Credit</span>
          <span>•</span>
          <span>AIF</span>
          <span>•</span>
          <span>GIFT City</span>
        </div>
      </div>
    ),
    size
  );
}