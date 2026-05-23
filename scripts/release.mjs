import { execSync } from "child_process";
import { readdirSync, renameSync } from "fs";
import { join } from "path";

const nsisDir = "src-tauri/target/release/bundle/nsis";
const ico     = "src-tauri/icons/icon.ico";

const setup = readdirSync(nsisDir).find(f => f.endsWith("-setup.exe"));
if (!setup) throw new Error("Installer not found in " + nsisDir);

const src = join(nsisDir, setup);
const dst = join(nsisDir, "penciless.exe");

execSync(`npx rcedit "${src}" --set-icon "${ico}"`, { stdio: "inherit" });
renameSync(src, dst);
console.log("Installer ready: " + dst);
