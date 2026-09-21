#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const stateDir = ".ai-team";
if (!existsSync(stateDir)) mkdirSync(stateDir);

function run(cmd,args){
  console.log("\n[AI TEAM] $",cmd,args.join(" "));
  return execFileSync(cmd,args,{cwd:root,stdio:"inherit",encoding:"utf8"});
}

const sha = execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const branch = execFileSync("git",["branch","--show-current"],{cwd:root,encoding:"utf8"}).trim();

const state = {
  startedAt:new Date().toISOString(),
  commit:sha,
  branch,
  roles:["architect","domain","frontend","backend","database","security","qa","devops","release"],
  gates:["test","lint","build","verify"],
  status:"initialized"
};

writeFileSync(stateDir+"/run.json",JSON.stringify(state,null,2)+"\n");

run("npm",["test"]);
run("npm",["run","lint"]);
run("npm",["run","build"]);
run("npm",["run","verify"]);

state.status="quality-pass";
state.completedAt=new Date().toISOString();
writeFileSync(stateDir+"/run.json",JSON.stringify(state,null,2)+"\n");
console.log("\n[AI TEAM] QUALITY GATE PASS for",sha);
