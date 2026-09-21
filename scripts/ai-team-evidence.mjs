#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const dir = ".ai-team";
if (!existsSync(dir)) mkdirSync(dir);
const run = (cmd,args) => execFileSync(cmd,args,{encoding:"utf8"}).trim();
const evidence = {
  generatedAt:new Date().toISOString(),
  commit:run("git",["rev-parse","HEAD"]),
  branch:run("git",["branch","--show-current"]),
  worktree:run("git",["status","--porcelain"]),
  node:process.version, platform:process.platform, arch:process.arch,
  gates:{test:"required",lint:"required",build:"required",verify:"required",policy:"required",deployment_commit_match:"required",runtime_health:"required",browser_e2e:"required when available"}
};
writeFileSync(dir+"/evidence.json",JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence,null,2));
