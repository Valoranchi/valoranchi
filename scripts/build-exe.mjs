import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";

async function buildExe() {
  console.log("Building dist files with tsc...");
  execSync("npm run build", { stdio: "inherit" });

  console.log("Bundling dist/bin.js into dist/bundle.cjs with esbuild...");
  await esbuild.build({
    entryPoints: ["dist/bin.js"],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: "dist/bundle.cjs",
    define: {
      "process.env.RIOTCLIENT_BUNDLED_VERSION": JSON.stringify(
        JSON.parse(fs.readFileSync("package.json", "utf-8")).version,
      ),
    },
  });

  console.log("Generating SEA preparation blob...");
  execSync("node --experimental-sea-config sea-config.json", { stdio: "inherit" });

  const releaseDir = path.resolve("release");
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  const exeName = process.platform === "win32" ? "riotclient-win-x64.exe" : "riotclient-bin";
  const targetExe = path.join(releaseDir, exeName);

  console.log(`Copying Node binary to ${targetExe}...`);
  fs.copyFileSync(process.execPath, targetExe);

  if (process.platform === "win32") {
    try {
      execSync(`signtool remove /s "${targetExe}"`, { stdio: "ignore" });
    } catch {}
  }

  console.log("Injecting SEA blob with postject...");
  const seaBlob = path.resolve("dist/sea-prep.blob");
  const postjectCmd = `npx postject "${targetExe}" NODE_SEA_BLOB "${seaBlob}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;
  execSync(postjectCmd, { stdio: "inherit" });

  console.log(`Successfully built single executable at ${targetExe}`);
}

buildExe().catch((err) => {
  console.error("Failed to build executable:", err);
  process.exit(1);
});
