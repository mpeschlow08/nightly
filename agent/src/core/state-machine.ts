import type { AgentState } from "./types";

const transitions: Record<AgentState, readonly AgentState[]> = {
  STARTING: ["UNPROVISIONED", "AUTHENTICATING", "CONNECTING", "ERROR", "STOPPED"],
  UNPROVISIONED: ["BOOTSTRAPPING", "RECOVERY_REQUIRED", "STOPPED", "ERROR"],
  BOOTSTRAPPING: ["UNPROVISIONED", "AUTHENTICATING", "OFFLINE", "RECOVERY_REQUIRED", "ERROR", "STOPPED"],
  AUTHENTICATING: ["CONNECTING", "RECOVERY_ONLY", "SUSPENDED", "OFFLINE", "RECOVERY_REQUIRED", "ERROR", "STOPPED"],
  CONNECTING: ["ONLINE", "DEGRADED", "OFFLINE", "SUSPENDED", "RECOVERY_ONLY", "ERROR", "STOPPED"],
  ONLINE: ["CONNECTING", "DEGRADED", "OFFLINE", "SUSPENDED", "RECOVERY_ONLY", "RECOVERY_REQUIRED", "UPDATING", "ERROR", "STOPPED"],
  DEGRADED: ["CONNECTING", "ONLINE", "OFFLINE", "SUSPENDED", "RECOVERY_ONLY", "RECOVERY_REQUIRED", "UPDATING", "ERROR", "STOPPED"],
  OFFLINE: ["CONNECTING", "DEGRADED", "RECOVERY_REQUIRED", "ERROR", "STOPPED"],
  SUSPENDED: ["RECOVERY_ONLY", "CONNECTING", "RECOVERY_REQUIRED", "ERROR", "STOPPED"],
  RECOVERY_ONLY: ["CONNECTING", "SUSPENDED", "RECOVERY_REQUIRED", "ERROR", "STOPPED"],
  UPDATING: ["ONLINE", "DEGRADED", "OFFLINE", "ERROR", "STOPPED"],
  RECOVERY_REQUIRED: ["BOOTSTRAPPING", "AUTHENTICATING", "OFFLINE", "ERROR", "STOPPED"],
  ERROR: ["STARTING", "RECOVERY_REQUIRED", "STOPPED"],
  STOPPED: ["STARTING"],
};

export class AgentStateMachine {
  #state: AgentState;

  constructor(initial: AgentState = "STARTING") {
    this.#state = initial;
  }

  get state() {
    return this.#state;
  }

  canTransition(next: AgentState) {
    return transitions[this.#state].includes(next);
  }

  transition(next: AgentState) {
    if (!this.canTransition(next)) throw new Error(`Invalid Agent state transition: ${this.#state} -> ${next}`);
    this.#state = next;
    return this.#state;
  }
}