import { useId } from "react";
export default function FeatureIllustration({ kind }: { kind: string }) {
  const id = useId();
  return (
    <svg
      className="feature-illustration"
      viewBox="0 0 280 130"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#30a9f1" />
          <stop offset=".5" stopColor="#5573de" />
          <stop offset="1" stopColor="#6f52bd" />
        </linearGradient>
      </defs>
      <g transform="translate(30 20)">
        <path d="m0 70 155-52 70 43-156 52Z" fill="#9774d2" opacity=".5" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${i * 14} ${i * 20})`}>
            <path d="m10 37 158-47 14 19-158 48Z" fill={`url(#${id})`} />
            <ellipse cx="17" cy="47" rx="10" ry="12" fill="#5267c4" />
            <path d="m25 62 151-48" stroke="#57c789" strokeWidth="5" />
          </g>
        ))}
        <path
          d="m18 76 165-50"
          stroke="#ffbd45"
          strokeWidth="3"
          strokeDasharray="4 3"
        />
      </g>
      {kind === "CALIBRATE" && (
        <g transform="translate(190 58)" strokeWidth="3">
          <path d="M0 36V-26" stroke="#4387e1" />
          <path d="m0 36 38 14" stroke="#e86549" />
          <path d="m0 36-30 20" stroke="#44a873" />
        </g>
      )}
      {kind === "SIMULATE" && (
        <path
          d="m200 109-8-47-37-23 9-20 46 30 18 56m-72-85 16-12 32 20-15 17"
          fill="none"
          stroke="#859399"
          strokeWidth="13"
          strokeLinejoin="round"
        />
      )}
      {kind === "TRANSFER" && (
        <g fill="none" stroke="#dc8a47" strokeWidth="3">
          <path d="M190 41q25 16 0 34m10-44q36 23 0 54" />
          <rect x="207" y="85" width="50" height="29" rx="5" />
        </g>
      )}
    </svg>
  );
}
