#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["test"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "verify"]]
];

for (const [cmd,args] of commands) {
  console.log("\n==> " + cmd + " " + args.join(" "));
  const r = spawnSync(cmd,args,{stdio:"inherit",shell:process.platform==="win32"});
  if (r.status !== 0) {
    console.error("\nAI TEAM GATE FAILED: " + cmd + " " + args.join(" "));
    process.exit(r.status ?? 1);
  }
}
console.log("\nAI TEAM LOCAL QUALITY GATE: PASS");
