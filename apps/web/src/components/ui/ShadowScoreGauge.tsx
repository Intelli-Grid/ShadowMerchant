"use client";

/**
 * ShadowScoreGauge — semi-circle SVG gauge component.
 * Colors:
 *   score < 50  → Red  (#EF4444)
 *   score 50–79 → Yellow (#F59E0B)
 *   score ≥ 80  → Green (#22C55E)
 */

import { useMemo } from "react";

interface ShadowScoreGaugeProps {
  score: number;          // 0–100
  size?: number;          // diameter in px, default 96
  strokeWidth?: number;   // arc thickness, default 8
  showLabel?: boolean;    // show "SHADOW SCORE" label
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#22C55E"; // Green — great deal
  if (score >= 50) return "#F59E0B"; // Yellow — fair deal
  return "#EF4444";                   // Red — weak deal
}

export function ShadowScoreGauge({
  score,
  size = 96,
  strokeWidth = 8,
  showLabel = true,
}: ShadowScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = getScoreColor(clamped);

  // Semi-circle arc math
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // The arc spans 180° (a semi-circle), from 180° to 360° (left to right, bottom half removed)
  const startAngle = -180; // degrees
  const endAngle = 0;      // degrees

  // Convert polar to cartesian
  const toXY = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const start = toXY(startAngle);
  const end = toXY(endAngle);

  // Background track arc (full 180°)
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

  // Fill arc (proportional to score)
  const fillAngle = startAngle + (clamped / 100) * 180;
  const fill = toXY(fillAngle);
  const largeArcFlag = clamped > 50 ? 1 : 0;
  const fillPath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${fill.x} ${fill.y}`;

  // Viewbox: only top half + a small bottom margin for the label
  const viewBoxHeight = size / 2 + strokeWidth / 2 + (showLabel ? 22 : 4);
  const viewBox = `0 0 ${size} ${viewBoxHeight}`;

  const fontSize = useMemo(() => {
    if (size >= 120) return 22;
    if (size >= 96)  return 18;
    return 14;
  }, [size]);

  return (
    <div
      className="flex flex-col items-center"
      aria-label={`Shadow Score: ${clamped} out of 100`}
      role="img"
    >
      <svg
        width={size}
        height={viewBoxHeight}
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        {/* Background track */}
        <path
          d={trackPath}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />

        {/* Score fill arc */}
        {clamped > 0 && (
          <path
            d={fillPath}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            style={{
              filter: `drop-shadow(0 0 6px ${color}88)`,
              transition: "stroke 0.4s ease",
            }}
          />
        )}

        {/* Score number in center */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={fontSize}
          fontWeight="800"
          fontFamily="var(--font-display, 'Syne', sans-serif)"
          style={{ transition: "fill 0.4s ease" }}
        >
          {clamped}
        </text>
      </svg>

      {showLabel && (
        <p
          className="text-[9px] font-bold tracking-[0.14em] uppercase mt-[-6px]"
          style={{ color: "var(--text-muted, #4A4A55)" }}
        >
          Shadow Score
        </p>
      )}
    </div>
  );
}

export default ShadowScoreGauge;
