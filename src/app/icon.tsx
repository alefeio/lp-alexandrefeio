import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#1E5EFF",
          display: "flex",
          alignItems: "flex-end",
          padding: 6,
        }}
      >
        <div style={{ width: 7, height: 8, background: "#ffffff", marginRight: 3 }} />
        <div style={{ width: 7, height: 14, background: "#ffffff" }} />
      </div>
    ),
    { ...size },
  );
}
