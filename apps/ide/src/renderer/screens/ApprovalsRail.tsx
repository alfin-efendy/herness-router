// apps/ide/src/renderer/screens/ApprovalsRail.tsx
import React, { useEffect, useState } from "react";
import type { ApprovalRequestFrame } from "@harness/protocol";
import { useStore } from "../store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function ApprovalCard({ req }: { req: ApprovalRequestFrame }) {
  const removeApproval = useStore((s) => s.removeApproval);
  const [remaining, setRemaining] = useState(Math.ceil(req.timeoutMs / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          removeApproval(req.requestId); // server already denies on timeout
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [req.requestId, removeApproval]);

  function decide(decision: "allow" | "deny") {
    window.harness.resolveApproval(req.requestId, decision);
    removeApproval(req.requestId);
  }

  return (
    <Card className="m-2">
      <CardHeader className="p-3">
        <CardTitle className="text-sm">{req.tool}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <p className="break-words font-mono text-xs text-muted-foreground">{req.summary}</p>
        <p className="text-xs text-muted-foreground">expires in {remaining}s</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => decide("allow")}>
            Allow
          </Button>
          <Button size="sm" variant="destructive" onClick={() => decide("deny")}>
            Deny
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApprovalsRail() {
  const pending = useStore((s) => s.pendingApprovals);
  return (
    <div data-testid="approvals-rail">
      <div className="border-b p-2 text-xs uppercase tracking-wide text-muted-foreground">Approvals</div>
      {pending.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">No pending approvals.</p>
      ) : (
        pending.map((req) => <ApprovalCard key={req.requestId} req={req} />)
      )}
    </div>
  );
}
