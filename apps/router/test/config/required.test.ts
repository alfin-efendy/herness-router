import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { migrate } from "../../src/store/db";
import { SettingsStore } from "../../src/config/store";
import { makeCatalog } from "../../src/providers/catalog";
import type { GatewayDescriptor, RuntimeDescriptor } from "../../src/providers/types";
import { missingRequiredSettings, isConfigured, csv } from "../../src/config/required";

const gw: GatewayDescriptor = { id: "g", label: "G", description: "", kind: "gateway",
  fields: [{ key: "g.tok", label: "Tok", help: "h", required: true, secret: true }], build: () => ({}) as any };
const rt: RuntimeDescriptor = { id: "r", label: "R", description: "", kind: "runtime", fields: [], detect: async () => ({ found: true }), build: () => ({}) as any };
const cat = makeCatalog([gw], [rt]);

function store() { const db = new Database(":memory:"); migrate(db); return new SettingsStore(db); }

test("csv splits and trims", () => {
  expect(csv("a, b ,,c")).toEqual(["a", "b", "c"]);
  expect(csv(undefined)).toEqual([]);
});

test("missingRequired counts only enabled providers + global", () => {
  const s = store();
  s.set("enabled_gateways", ""); s.set("enabled_runtimes", "r");
  // g not enabled -> g.tok not required; workdir_root (global required) missing
  expect(missingRequiredSettings(s, cat)).toEqual(["workdir_root"]);
  s.set("enabled_gateways", "g");
  expect(missingRequiredSettings(s, cat).sort()).toEqual(["g.tok", "workdir_root"]);
  expect(isConfigured(s, cat)).toBe(false);
  s.set("g.tok", "x"); s.set("workdir_root", "/r");
  expect(isConfigured(s, cat)).toBe(true);
});
