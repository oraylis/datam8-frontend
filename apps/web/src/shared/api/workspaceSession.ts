let workspaceId: string | null = null;
let requests = new AbortController();
export const getWorkspaceId = () => workspaceId;
export const getWorkspaceSignal = () => requests.signal;
export const setWorkspaceId = (id: string | null) => {
  if (id === workspaceId) return;
  requests.abort(new DOMException("Request aborted because the workspace changed", "AbortError"));
  workspaceId = id;
  requests = new AbortController();
};
