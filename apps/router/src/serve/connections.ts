// apps/router/src/serve/connections.ts
import type { ServerFrame, ApprovalRequest, ApprovalDecision } from "@harness/protocol";

interface Pending {
  resolve: (d: ApprovalDecision) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ConnectionHub {
  private conns = new Map<string, (f: ServerFrame) => void>();
  private pending = new Map<string, Pending>();

  add(connId: string, send: (f: ServerFrame) => void): void {
    this.conns.set(connId, send);
  }

  remove(connId: string): void {
    this.conns.delete(connId);
  }

  has(connId: string): boolean {
    return this.conns.has(connId);
  }

  requestApproval(connId: string, req: ApprovalRequest): Promise<ApprovalDecision> {
    const send = this.conns.get(connId);
    if (!send) return Promise.resolve({ decision: "deny", actor: "offline" });
    return new Promise<ApprovalDecision>((resolve) => {
      const timeoutMs = req.timeoutMs ?? 300000;
      const timer = setTimeout(() => {
        this.pending.delete(req.requestId);
        resolve({ decision: "deny", actor: "timeout" });
      }, timeoutMs);
      this.pending.set(req.requestId, { resolve, timer });
      send({ t: "approval.request", requestId: req.requestId, sessionPk: "", tool: req.tool, summary: req.summary, timeoutMs });
    });
  }

  resolveApproval(requestId: string, decision: "allow" | "deny"): void {
    const p = this.pending.get(requestId);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(requestId);
    p.resolve({ decision, actor: "ide" });
  }
}
