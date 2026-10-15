import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";

type WindowsTitleBarProps = {
  title: string;
  menuLabels: string[];
  onOpenMenu: (label: string, anchor: DOMRect) => void;
};

export function WindowsTitleBar({ title, menuLabels, onOpenMenu }: WindowsTitleBarProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuWidth, setMenuWidth] = useState(0);

  const handleMenuClick = (label: string, event: MouseEvent<HTMLButtonElement>) => {
    onOpenMenu(label, event.currentTarget.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;

    const updateWidth = () => {
      setMenuWidth(Math.ceil(node.getBoundingClientRect().width));
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [menuLabels]);

  return (
    <div className="windows-titlebar" role="presentation" style={{ "--windows-titlebar-menu-width": `${menuWidth}px` } as CSSProperties}>
      <div className="windows-titlebar__menu" ref={menuRef}>
        {menuLabels.map((label) => (
          <button
            key={label}
            type="button"
            className="windows-titlebar__menu-btn"
            onClick={(event) => handleMenuClick(label, event)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="windows-titlebar__title" title={title}>
        {title}
      </div>
    </div>
  );
}
