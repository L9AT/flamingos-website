const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.resolve(root, "dist");

if (path.dirname(output) !== root || path.basename(output) !== "dist") {
  throw new Error("Refusing to build outside the project dist folder.");
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const rootExtensions = new Set([".html", ".css", ".js"]);
const rootFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => rootExtensions.has(path.extname(name)) || name === "traits-manifest.json");

for (const file of rootFiles) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

const assetDirectories = ["BASE", "Flamingos", "LOGO", "MAIN", "nft"];
for (const directory of assetDirectories) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(output, directory), { recursive: true });
  }
}

console.log(`Static build ready: ${rootFiles.length} files and ${assetDirectories.length} asset folders.`);
