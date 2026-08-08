export type AgentEventHandler<T> = (payload: T) => void;

class AgentEventBus {
  private listeners: Map<string, Set<AgentEventHandler<any>>> = new Map();

  on<T>(event: string, handler: AgentEventHandler<T>): () => void {
    const existing = this.listeners.get(event) || new Set();
    existing.add(handler as AgentEventHandler<any>);
    this.listeners.set(event, existing);

    return () => {
      const current = this.listeners.get(event);
      if (!current) return;
      current.delete(handler as AgentEventHandler<any>);
      if (current.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<T>(event: string, payload: T) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => handler(payload));
  }
}

export const agentEventBus = new AgentEventBus();

export type AdvisorAnalysisEvent = {
  advice: unknown;
  timestamp: number;
};

export type AgentEventMap = {
  "advisor:analysis": AdvisorAnalysisEvent;
};
