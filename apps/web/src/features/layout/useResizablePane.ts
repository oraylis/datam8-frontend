import { useCallback, useState } from "react";

type Options = {
  initialWidth?: number;
  min?: number;
  max?: number;
  onChange?: (width: number) => void;
};

export function useResizablePane({ initialWidth = 320, min = 240, max = 520, onChange }: Options = {}) {
  const [width, setWidth] = useState(initialWidth);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      const clamp = (val: number) => Math.min(max, Math.max(min, val));
      const onMove = (ev: MouseEvent) => {
        const next = clamp(startWidth + (ev.clientX - startX));
        setWidth(next);
        onChange?.(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [max, min, onChange, width],
  );

  return { width, setWidth, startResize };
}
