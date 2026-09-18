import { spawn } from "node:child_process";
try { process.loadEnvFile(".env"); } catch (e) { if (e.code !== "ENOENT") throw e; }
const child=spawn(process.env.PRODUCTION_PYTHON||"python3",["-m","workers.production.worker",...process.argv.slice(2)],{stdio:"inherit",env:process.env});
child.on("error",()=>{console.error("Python worker could not start. Install workers/production/requirements.txt.");process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code??1;});
for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>child.kill(signal));
