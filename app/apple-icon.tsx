import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "180px",
          height: "180px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "42px",
          background: "linear-gradient(135deg, #050a16, #2f6df2)",
          color: "white",
          fontSize: "86px",
          fontWeight: 900,
          fontFamily: "Arial",
        }}
      >
        V
      </div>
    ),
    size
  );
}