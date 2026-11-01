import { useId } from "react";
export default function SystemLogo() {
  const id = useId();
  return (
    <svg
      className="system-logo-mark"
      width="38"
      height="38"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e8b78d" />
          <stop offset=".45" stopColor="#be5b2c" />
          <stop offset="1" stopColor="#773d25" />
        </linearGradient>
      </defs>
      <path
        d="M9 24a15 15 0 0 1 26-10l-5 2M39 24a15 15 0 0 1-26 10l5-2"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="m12 26 8-7 6 10 10-8"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m37 5 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z" fill="#d77d42" />
    </svg>
  );
}
