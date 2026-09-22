import React, { useMemo, useState } from "react";
import { ModelTree, type ModelTreeNode } from "../src";

export default {
  title: "Datam8/ModelTree",
};

const sampleTree: ModelTreeNode[] = [
  {
    label: "DataProducts",
    type: "folder",
    path: "DataProducts",
    children: [
      {
        label: "Sales",
        type: "folder",
        path: "DataProducts/Sales",
        children: [
          { label: "Transactions", relPath: "Model/DataProducts/Sales/Transactions.json", type: "entity", path: "DataProducts/Sales/Transactions" },
          { label: "Customers", relPath: "Model/DataProducts/Sales/Customers.json", type: "entity", path: "DataProducts/Sales/Customers" },
        ],
      },
    ],
  },
];

export const Default = () => {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["DataProducts", "DataProducts/Sales"]));
  const [selected, setSelected] = useState<string | null>(null);
  const tree = useMemo(() => sampleTree, []);

  return (
    <div className="w-80 rounded-xl border border-border bg-card p-3">
      <ModelTree
        tree={tree}
        filter={filter}
        onFilterChange={setFilter}
        selectedRelPath={selected}
        expanded={expanded}
        onToggle={(path) =>
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
          })
        }
        onSelectEntity={setSelected}
        onMoveEntity={() => {}}
        ensureExpanded={(path) =>
          setExpanded((prev) => {
            const next = new Set(prev);
            next.add(path);
            return next;
          })
        }
      />
    </div>
  );
};
