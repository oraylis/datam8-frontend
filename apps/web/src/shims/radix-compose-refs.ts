import * as React from "react";

type PossibleRef<T> = React.Ref<T> | undefined;

function setRef<T>(ref: PossibleRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    ref.current = value;
  }
}

export function composeRefs<T>(...refs: PossibleRef<T>[]) {
  let currentNode: T | null = null;
  return (node: T | null) => {
    if (node === currentNode) return;
    currentNode = node;
    refs.forEach((ref) => setRef(ref, node));
  };
}

export function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
  const refsRef = React.useRef(refs);

  React.useLayoutEffect(() => {
    refsRef.current = refs;
  });

  const currentNodeRef = React.useRef<T | null>(null);

  return React.useCallback((node: T | null) => {
    if (node === currentNodeRef.current) return;
    currentNodeRef.current = node;
    refsRef.current.forEach((ref) => setRef(ref, node));
  }, []);
}
