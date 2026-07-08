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
          color: "#ffffff",
          background:
            "linear-gradient(135deg, #050a16 0%, #08152e 55%, #040814 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: "36px",
              fontWeight: 900,
              letterSpacing: "-0.06em",
            }}
          >
            VENTIQ
          </div>

          <div
            style={{
              display: "flex",
              border: "1px solid rgba(168, 197, 255, 0.42)",
              borderRadius: "999px",
              padding: "12px 20px",
              color: "#bcd0ff",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            Private Capital Operating Layer
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: "960px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginBottom: "28px",
              padding: "12px 18px",
              borderRadius: "999px",
              background: "rgba(47, 109, 242, 0.24)",
              color: "#bcd0ff",
              fontSize: "18px",
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          >
            AI OPERATING SYSTEM
          </div>

          <div
            style={{
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
              marginTop: "30px",
              color: "#c9d8f5",
              fontSize: "28px",
              lineHeight: "1.35",
              maxWidth: "930px",
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
            fontSize: "22px",
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