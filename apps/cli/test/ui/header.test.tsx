import { test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { Header } from "../../src/cli/ui/components/header";

test("Header shows brand + tabs and omits the command label", () => {
  const f = render(<Header tabs={["Status", "Daemon", "Sessions", "Config"]} active={0} />).lastFrame()!;
  expect(f).toContain("r ryuzi");
  expect(f).toContain("Status");
  expect(f).toContain("Config");
  expect(f).not.toMatch(/ryuzi\s+ryuzi\b/);
});
