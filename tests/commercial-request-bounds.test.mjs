import { readFileSync } from "node:fs";
const s=readFileSync("app/api/commercial/route.ts","utf8");
const ok=(n,c)=>{if(!c)throw new Error(n)};
ok("bounded request import",s.includes('readBoundedRequestJson'));
ok("bounded write payload",s.includes('readBoundedRequestJson<Record<string,unknown>>(request,128 * 1024)'));
ok("same origin",s.includes("isSameOriginRequest"));
ok("stage2 permission",s.includes('requireStage2Permission("erp.write",["business"])'));
console.log("commercial-request-bounds: 4 checks passed");
