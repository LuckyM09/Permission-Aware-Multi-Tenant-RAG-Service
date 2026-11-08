"use client";

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  memo,
} from "react";
import { cn } from "@/lib/utils";

interface PerspectiveGridProps {
  rows?: number;
  cols?: number;
  cellSize?: number;
  className?: string;
  children?: React.ReactNode;
}

const TRAIL_COLORS = [
  "#00D2FF", // Signature Cyan
  "#10B981", // Emerald Green
  "#3B82F6", // Electric Blue
  "#F59E0B", // Vibrant Amber
  "#EC4899", // Neon Pink
  "#8B5CF6", // Violet
  "#06B6D4", // Sky Blue
  "#14B8A6", // Bright Teal
  "#F43F5E", // Rose Red
];

interface CellProps {
  id: string;
  size: number;
  color: string | null;
  onActivate: (id: string) => void;
}

const Cell = memo(({ id, size, color, onActivate }: CellProps) => {
  return (
    <div
      onPointerEnter={() => onActivate(id)}
      className="relative border border-[#E2E8F0]/65 select-none pointer-events-auto"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color || "transparent",
        boxShadow: color
          ? `0 0 20px ${color}, inset 0 0 10px ${color}99`
          : "none",
        transition: color
          ? "background-color 0s, box-shadow 0s"
          : "background-color 1.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: color ? 10 : 1,
      }}
    />
  );
});
Cell.displayName = "PerspectiveGridCell";

export function PerspectiveGrid({
  rows = 24,
  cols = 32,
  cellSize = 52,
  className,
  children,
}: PerspectiveGridProps) {
  const [activeCells, setActiveCells] = useState<Record<string, string>>({});
  const cellTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const colorIndex = useRef(0);

  const activateCell = useCallback((cellKey: string) => {
    const nextColor = TRAIL_COLORS[colorIndex.current % TRAIL_COLORS.length];
    colorIndex.current += 1;

    setActiveCells((prev) => {
      if (prev[cellKey] === nextColor) return prev;
      return { ...prev, [cellKey]: nextColor };
    });

    if (cellTimers.current[cellKey]) {
      clearTimeout(cellTimers.current[cellKey]);
    }

    cellTimers.current[cellKey] = setTimeout(() => {
      setActiveCells((prev) => {
        if (!prev[cellKey]) return prev;
        const copy = { ...prev };
        delete copy[cellKey];
        return copy;
      });
      delete cellTimers.current[cellKey];
    }, 450);
  }, []);

  useEffect(() => {
    const timers = cellTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden select-none",
        className
      )}
    >
      {/* 3D Perspective Grid Background Container */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{
          perspective: "1100px",
          perspectiveOrigin: "50% 25%",
        }}
      >
        <div
          className="relative pointer-events-auto"
          style={{
            width: `${cols * cellSize}px`,
            height: `${rows * cellSize}px`,
            transform: "rotateX(42deg) translateY(-2%) scale(1.15)",
            transformOrigin: "center top",
            transformStyle: "preserve-3d",
            maskImage:
              "radial-gradient(ellipse 95% 85% at 50% 45%, black 40%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 95% 85% at 50% 45%, black 40%, transparent 90%)",
          }}
        >
          {/* Matrix of Individual Cells with Direct Pointer Interaction */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
              width: `${cols * cellSize}px`,
              height: `${rows * cellSize}px`,
            }}
          >
            {Array.from({ length: rows * cols }).map((_, idx) => {
              const r = Math.floor(idx / cols);
              const c = idx % cols;
              const key = `${r}-${c}`;
              return (
                <Cell
                  key={key}
                  id={key}
                  size={cellSize}
                  color={activeCells[key] || null}
                  onActivate={activateCell}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Atmospheric Horizon Gradient Blends */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#FAF9F6] via-[#FAF9F6]/70 to-transparent z-1" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#FAF9F6] via-[#FAF9F6]/80 to-transparent z-1" />

      {/* Optional Children Overlay */}
      {children && (
        <div className="relative z-2 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_textarea]:pointer-events-auto">
          {children}
        </div>
      )}
    </div>
  );
}

export default PerspectiveGrid;
