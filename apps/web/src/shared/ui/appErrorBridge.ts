type AppErrorEvent = {
  id: number;
  title: string;
  description?: string | null;
};

const listeners = new Set<(event: AppErrorEvent) => void>();
let latestEvent: AppErrorEvent | null = null;
let nextId = 0;

export function publishAppError(title: string, description?: string | null) {
  latestEvent = {
    id: (nextId += 1),
    title,
    description,
  };
  listeners.forEach((listener) => listener(latestEvent as AppErrorEvent));
}

export function subscribeAppErrors(listener: (event: AppErrorEvent) => void) {
  listeners.add(listener);
  if (latestEvent) {
    listener(latestEvent);
  }
  return () => {
    listeners.delete(listener);
  };
}
