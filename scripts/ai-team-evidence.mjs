#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dir = ".ai-team";
if (!existsSync(dir)) mkdirSync(dir);
const run = (cmd,args) => execFileSync(cmd,args,{encoding:"utf8"}).trim();
const result = (status, detail="") => ({status, detail});

const evidence = {
  generatedAt:new Date().toISOString(),
  commit:run("git",["rev-parse","HEAD"]),
  branch:run("git",["branch","--show-current"]),
  worktree:run("git",["status","--porcelain"]),
  node:process.version,
  platform:process.platform,
  arch:process.arch,
  results:{
    policy:result(process.env.AI_TEAM_POLICY_PASS==="1"?"pass":"unknown","set AI_TEAM_POLICY_PASS=1 after policy gate"),
    test:result(process.env.AI_TEAM_TEST_PASS==="1"?"pass":"unknown","set AI_TEAM_TEST_PASS=1 after tests"),
    lint:result(process.env.AI_TEAM_LINT_PASS==="1"?"pass":"unknown","set AI_TEAM_LINT_PASS=1 after lint"),
    build:result(process.env.AI_TEAM_BUILD_PASS==="1"?"pass":"unknown","set AI_TEAM_BUILD_PASS=1 after build"),
    verify:result(process.env.AI_TEAM_VERIFY_PASS==="1"?"pass":"unknown","set AI_TEAM_VERIFY_PASS=1 after verification")
  },
  deployment:{status:process.env.AI_TEAM_DEPLOYMENT_PASS==="1"?"pass":"unknown",detail:"requires deployment of this exact commit"},
  runtime:{status:process.env.AI_TEAM_RUNTIME_PASS==="1"?"pass":"unknown",detail:"requires live health verification of this exact deployment"},
  browserE2E:{status:process.env.AI_TEAM_BROWSER_E2E_PASS==="1"?"pass":"unknown",detail:"requires browser journey verification"},
  gates:["policy","test","lint","build","verify","deployment_commit_match","runtime_health","browser_e2e"]
};
writeFileSync(dir+"/evidence.json",JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence,null,2));
