import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "64px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "16px",
          background: "linear-gradient(135deg, #050a16, #2f6df2)",
          color: "white",
          fontSize: "28px",
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