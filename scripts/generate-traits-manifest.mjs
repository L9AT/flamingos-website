import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const categoryFolders = ['Background', 'Body', 'clothes', 'Top of head', 'Eyes', 'Mouth'];
const manifest = {};

for (const category of categoryFolders) {
  const files = await readdir(path.join(root, 'Flamingos', category));
  manifest[category] = files
    .filter((file) => /\.png$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

await writeFile(
  path.join(root, 'traits-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Generated traits-manifest.json with ${Object.values(manifest).flat().length} traits.`);
