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
          background: "#0e6b4f",
          display: "flex",
          alignItems: "flex-end",
          padding: 6,
        }}
      >
        <div style={{ width: 7, height: 8, background: "#f4fbf7", marginRight: 3 }} />
        <div style={{ width: 7, height: 14, background: "#f4fbf7" }} />
      </div>
    ),
    { ...size },
  );
}
