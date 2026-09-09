const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const cwd = __dirname;
const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");

const out = fs.openSync(path.join(cwd, "dev-3001.out.log"), "a");
const err = fs.openSync(path.join(cwd, "dev-3001.err.log"), "a");

const child = spawn(process.execPath, [nextBin, "start", "-p", "3001"], {
  cwd,
  detached: true,
  stdio: ["ignore", out, err],
  windowsHide: true
});

child.unref();
console.log(`started ${child.pid}`);
