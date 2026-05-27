import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { ZipFile } from "yazl";

const distDir = resolve("dist");
const packageDir = resolve(distDir, "packages");

await mkdir(packageDir, { recursive: true });

for (const browser of ["chrome", "firefox"]) {
  const sourceDir = resolve(distDir, browser);
  const packagePath = resolve(packageDir, `block-utiq-${browser}.zip`);
  await writeZip(sourceDir, packagePath);
}

console.log("Archives publiees dans dist/packages.");

async function listFiles(dir) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const info = await stat(path);

    if (info.isDirectory()) {
      files.push(...await listFiles(path));
    } else {
      files.push(path);
    }
  }

  return files.sort();
}

async function writeZip(sourceDir, packagePath) {
  const zip = new ZipFile();
  const files = await listFiles(sourceDir);

  for (const filePath of files) {
    const name = relative(sourceDir, filePath).split(sep).join("/");
    zip.addFile(filePath, name);
  }

  zip.end();

  await new Promise((resolvePromise, reject) => {
    zip.outputStream
      .pipe(createWriteStream(packagePath))
      .on("close", resolvePromise)
      .on("error", reject);
    zip.outputStream.on("error", reject);
  });
}
