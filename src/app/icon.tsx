import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
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
          background: "#0c0b09",
          color: "#d4b483",
          fontSize: 36,
          fontFamily: "Georgia, serif",
        }}
      >
        A
      </div>
    ),
    size,
  );
}
