export default function PointCloudIllustration() {
  return (
    <div className="hero-cloud">
      <span>
        ● 工件点云　 — 焊缝 S-001 <small>示意图</small>
      </span>
      <svg viewBox="0 0 710 342" role="img" aria-label="点云与焊缝轨迹示意图">
        <g stroke="#d3e2ee" strokeWidth=".8">
          {Array.from({ length: 15 }, (_, i) => (
            <line
              key={"h" + i}
              x1="0"
              y1={150 + i * 17}
              x2="580"
              y2={150 + i * 17}
            />
          ))}
          {Array.from({ length: 17 }, (_, i) => (
            <line key={"v" + i} x1="295" y1="95" x2={-200 + i * 65} y2="370" />
          ))}
        </g>
        <g fill="#3688ae">
          {Array.from({ length: 24 }, (_, row) =>
            Array.from({ length: 24 }, (_, col) => {
              const x = 145 + col * 11 + (row - 12) * 4,
                y = 110 + row * 5 + col * 3 + Math.sin(col * 0.35) * row * 1.7;
              return (
                <circle
                  key={`${row}-${col}`}
                  cx={x}
                  cy={y}
                  r={0.7 + ((row + col) % 3) * 0.2}
                  opacity={0.45 + (row % 4) * 0.14}
                />
              );
            }),
          )}
        </g>
        <path
          d="M145 205 L410 290"
          stroke="#008d81"
          strokeWidth="3"
          fill="none"
        />
      </svg>
      <small>左键旋转 · 滚轮缩放 · 右键平移（功能页支持）</small>
    </div>
  );
}
