export function Screw({
  corner,
  rot,
}: {
  corner: "tl" | "tr" | "bl" | "br";
  rot: number;
}) {
  return (
    <svg
      className={`screw screw--${corner}`}
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      <circle cx="5" cy="5.6" r="4.3" fill="rgba(0,0,0,0.32)" />
      <circle cx="5" cy="5" r="4.3" fill="#8B846F" />
      <circle
        cx="5"
        cy="5"
        r="4.3"
        fill="none"
        stroke="#3A382F"
        strokeWidth="0.8"
      />
      <g transform={`rotate(${rot} 5 5)`}>
        <path d="M5 1.3 V8.7 M1.3 5 H8.7" stroke="#CFC7AE" strokeWidth="1.6" />
        <path d="M5 1.3 V8.7 M1.3 5 H8.7" stroke="#3A382F" strokeWidth="1.1" />
      </g>
    </svg>
  );
}
