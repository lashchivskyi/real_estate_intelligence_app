import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon: the Vidomo mark (focus frame, house, lit window) on graphite. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#12151b" }}>
        <svg width="150" height="150" viewBox="0 0 32 32">
          <g fill="none" stroke="#eef0f4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 10V5h5" />
            <path d="M22 5h5v5" />
            <path d="M27 22v5h-5" />
            <path d="M10 27H5v-5" />
          </g>
          <path d="M9.8 23.2V15.4L16 10l6.2 5.4v7.8Z" fill="none" stroke="#8b9bff" strokeWidth="2.3" strokeLinejoin="round" />
          <rect x="14.2" y="16.8" width="3.6" height="3.6" rx="0.7" fill="#f2b550" />
        </svg>
      </div>
    ),
    size,
  );
}
