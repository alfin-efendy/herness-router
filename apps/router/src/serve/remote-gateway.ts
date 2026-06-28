// apps/router/src/serve/remote-gateway.ts
import type { Gateway, MessageRef } from "../gateways/types";
import type { Surface, ApprovalRequest, ApprovalDecision } from "@harness/protocol";
import type { ConnectionHub } from "./connections";

// Gateway whose only meaningful job is the approval round-trip to a connected IDE.
// Session transcript flows via ControlPlane.events (EventBus), not these posts,
// so postStatus/postResult/etc. are inert no-ops.
export class RemoteGateway implements Gateway {
  readonly id = "ide";
  constructor(private hub: ConnectionHub) {}

  async start(): Promise<void> {}

  async createWorkspace(name: string): Promise<string> {
    return name;
  }
  async createConversation(_workspaceId: string, title: string): Promise<string> {
    return title;
  }
  async postStatus(target: Surface, _text: string): Promise<MessageRef> {
    return { surface: target, messageId: "" };
  }
  async editStatus(_ref: MessageRef, _text: string): Promise<void> {}
  async postResult(_target: Surface, _chunks: string[]): Promise<void> {}
  async postError(_target: Surface, _text: string): Promise<void> {}

  requestApproval(target: Surface, req: ApprovalRequest): Promise<ApprovalDecision> {
    return this.hub.requestApproval(target.conversationId, req);
  }
}
