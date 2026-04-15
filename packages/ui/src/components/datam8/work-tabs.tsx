import React, { useCallback, useEffect, useRef, useState } from "react";

export type WorkTab = { relPath: string; title: string; dirty: boolean };

export type WorkTabGroup = {
  id: string;
  label: string;
  accent?: string;
  tabs: WorkTab[];
};

export type WorkTabsProps = {
  baseGroup?: { label: string; tabs: WorkTab[]; accent?: string };
  modelGroups: WorkTabGroup[];
  activeWorkTab: string | null;
  collapsedGroups: Set<string>;
  onToggleGroup: (id: string) => void;
  onFocusTab: (kind: "base" | "entity", relPath: string) => void;
  onCloseTab: (kind: "base" | "entity", relPath: string) => void;
  onConfirmCloseTab?: (kind: "base" | "entity", relPath: string, isDirty: boolean) => Promise<boolean>;
  onTabDragStart?: (kind: "base" | "entity", relPath: string) => void;
  onTabDragEnd?: () => void;
};

const groupId = (kind: "base" | "model", name?: string) => (kind === "base" ? "base" : `model:${name || ""}`);
type TabAccentStyle = React.CSSProperties & { "--tab-accent": string };
const accentStyle = (accent?: string): TabAccentStyle | undefined => (accent ? ({ "--tab-accent": accent } as TabAccentStyle) : undefined);

export function WorkTabs({
  baseGroup,
  modelGroups,
  activeWorkTab,
  collapsedGroups,
  onToggleGroup,
  onFocusTab,
  onCloseTab,
  onConfirmCloseTab,
  onTabDragStart,
  onTabDragEnd,
}: WorkTabsProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Allow a small tolerance to avoid false positives from sub-pixel layout and decorative tab overhang.
    const tolerancePx = 10;
    const nextLeft = el.scrollLeft > tolerancePx;
    const remainingRight = el.scrollWidth - el.clientWidth - el.scrollLeft;
    const nextRight = remainingRight > tolerancePx;
    setShowLeft((prev) => (prev === nextLeft ? prev : nextLeft));
    setShowRight((prev) => (prev === nextRight ? prev : nextRight));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateScrollButtons();
    const onResize = () => updateScrollButtons();
    const onScroll = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateScrollButtons]);

  useEffect(() => {
    updateScrollButtons();
  }, [updateScrollButtons, baseGroup?.tabs.length, modelGroups.length, collapsedGroups.size, activeWorkTab]);

  useEffect(() => {
    if (!activeWorkTab) return;
    const activeEl = tabRefs.current[activeWorkTab];
    if (!activeEl) return;
    activeEl.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    updateScrollButtons();
  }, [activeWorkTab, updateScrollButtons]);

  const scrollTabs = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    const next = dir === "left" ? el.scrollLeft - amount : el.scrollLeft + amount;
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  const renderTab = useCallback((kind: "base" | "entity", tab: WorkTab) => {
    const id = `${kind}:${tab.relPath}`;
    const isActive = activeWorkTab === id;

    const closeTab = async () => {
      if (tab.dirty && onConfirmCloseTab) {
        const confirmed = await onConfirmCloseTab(kind, tab.relPath, true);
        if (!confirmed) return;
      }
      onCloseTab(kind, tab.relPath);
    };

    const handleCloseClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      await closeTab();
    };

    return (
      <button
        key={id}
        ref={(el) => {
          tabRefs.current[id] = el;
        }}
        className={`worktab ${isActive ? "worktab--active" : ""}`}
        onClick={() => onFocusTab(kind, tab.relPath)}
        title={tab.relPath}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/x-datam8-worktab", id);
          event.dataTransfer.setData("text/plain", id);
          onTabDragStart?.(kind, tab.relPath);
        }}
        onDragEnd={() => {
          onTabDragEnd?.();
        }}
      >
        <span className="worktab__title">{tab.title}</span>
        {tab.dirty ? <span className="worktab__dot" /> : null}
        <span
          className="worktab__close"
          onClick={handleCloseClick}
          role="button"
          tabIndex={0}
          aria-label={`Close ${tab.title}`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              void closeTab();
            }
          }}
        >
          {"\u00D7"}
        </span>
      </button>
    );
  }, [activeWorkTab, onCloseTab, onConfirmCloseTab, onFocusTab, onTabDragEnd, onTabDragStart]);

  const modelContent = modelGroups.map((group) => {
    const collapsed = collapsedGroups.has(groupId("model", group.label));
    return (
      <div key={group.id} className="tab-group-inline" style={accentStyle(group.accent)}>
        <button
          className={`tab-group__toggle tab-group__toggle--ghost ${collapsed ? "tab-group__toggle--collapsed" : ""}`}
          onClick={() => onToggleGroup(groupId("model", group.label))}
        >
          <span className="tab-group__dot" aria-hidden />
          <span className="tab-group__chevron">{collapsed ? "\u25B8" : "\u25BE"}</span>
          <span className="tab-group__title">{group.label}</span>
        </button>
        {!collapsed ? <div className="tab-inline-list">{group.tabs.map((tab) => renderTab("entity", tab))}</div> : null}
      </div>
    );
  });

  return (
    <div className="worktabs">
      <div className="worktabs__group">
        {showLeft ? (
          <button className="tab-scroll tab-scroll--left" onClick={() => scrollTabs("left")} aria-label="Scroll tabs left">
            {"\u2039"}
          </button>
        ) : null}
        <div className="worktabs__scroller" ref={scrollerRef}>
          {baseGroup && baseGroup.tabs.length > 0 ? (
            <div className="tab-group-inline" style={accentStyle(baseGroup.accent)}>
              <button
                className={`tab-group__toggle ${collapsedGroups.has(groupId("base")) ? "tab-group__toggle--collapsed" : ""}`}
                onClick={() => onToggleGroup(groupId("base"))}
              >
                <span className="tab-group__dot" aria-hidden />
                <span className="tab-group__chevron">{collapsedGroups.has(groupId("base")) ? "\u25B8" : "\u25BE"}</span>
                <span className="tab-group__title">{baseGroup.label}</span>
              </button>
              {!collapsedGroups.has(groupId("base")) ? (
                <div className="tab-inline-list">{baseGroup.tabs.map((tab) => renderTab("base", tab))}</div>
              ) : null}
            </div>
          ) : null}
          {modelContent}
        </div>
        {showRight ? (
          <button className="tab-scroll tab-scroll--right" onClick={() => scrollTabs("right")} aria-label="Scroll tabs right">
            {"\u203A"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
