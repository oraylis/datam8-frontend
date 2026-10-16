let workspaceId: string | null = null;
export const getWorkspaceId = () => workspaceId;
export const setWorkspaceId = (id: string | null) => { workspaceId = id; };

export function guardWorkspaceResponse(response: Response, expected: string | null): Response {
  const check = () => {
    if (expected && expected !== workspaceId) throw new DOMException("Request aborted because the workspace changed", "AbortError");
  };
  const bodyMethods = new Set<PropertyKey>(["json", "text", "arrayBuffer", "blob", "formData", "bytes"]);
  return new Proxy(response, {
    get(target, property) {
      check();
      const value = Reflect.get(target, property, target);
      if (property === "clone") return () => guardWorkspaceResponse(target.clone(), expected);
      if (typeof value !== "function") return value;
      if (bodyMethods.has(property)) return async (...args: unknown[]) => {
        check();
        const body = await value.apply(target, args);
        check();
        return body;
      };
      return value.bind(target);
    },
  });
}
