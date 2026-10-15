import type React from "react";

type EditorPanelHeaderProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
};

export function EditorPanelHeader({ eyebrow, title, meta, actions }: EditorPanelHeaderProps) {
  return (
    <div className="panel__header">
      <div className="panel__meta">
        {eyebrow ? <div className="panel__eyebrow">{eyebrow}</div> : null}
        <div className="panel__title">{title}</div>
        {meta}
      </div>
      {actions ? <div className="panel__actions">{actions}</div> : null}
    </div>
  );
}

