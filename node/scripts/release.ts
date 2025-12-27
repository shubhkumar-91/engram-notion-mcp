import { $ } from "bun";
import { join } from "path";

// 1. Load configuration: Env > package.json > Defaults
const pkgPath = join(import.meta.dir, "../package.json");
const pyPath = join(import.meta.dir, "../../python/pyproject.toml");

const pkg = await Bun.file(pkgPath).json();

const npmrcPath = join(import.meta.dir, "../.npmrc");
const npmrc = await (async () => {
  try {
    const content = await Bun.file(npmrcPath).text();
    const config: Record<string, string> = {};
    content.split('\n').filter(Boolean).forEach(line => {
      const [key, value] = line.split('=');
      if(key && value) config[key.trim()] = value.trim();
    });
    return config;
  } catch {
    return {};
  }
})();

// Helper to get config value with fallback: Env -> .npmrc -> package.json -> Default
const getConfig = (key: string, envKey: string, defaultVal: string) => {
  return process.env[envKey] || npmrc[key] || pkg.config?.[key] || defaultVal;
};

const release = getConfig("release", "npm_config_release", "prerelease");
const preid = getConfig("preid", "npm_config_preid", "");
const tagPrefix = getConfig("tagVersionPrefix", "npm_config_tag_version_prefix", "v");

console.log(`🚀 Starting ${release} release (ID: ${preid || 'none'}) with prefix "${tagPrefix}"`);

try {
  // 2. Bump version in package.json (no git tag yet)
  // We use --no-git-tag-version so we can sync python first, then commit all together
  const preidFlag = preid ? `--preid=${preid}` : "";
  await $`bun pm version ${release} ${preidFlag} --no-git-tag-version`;

  // 3. Read the NEW version from updated package.json
  const newPkg = await Bun.file(pkgPath).json();
  const newVersion = newPkg.version;
  console.log(`📦 New Version: ${newVersion}`);

  // 4. Sync to Python (pyproject.toml)
  console.log(`Syncing version to ${pyPath}...`);
  let pyConfig = await Bun.file(pyPath).text();
  const versionRegex = /^version\s*=\s*".*"/m;

  if(versionRegex.test(pyConfig)) {
    pyConfig = pyConfig.replace(versionRegex, `version = "${newVersion}"`);
    await Bun.write(pyPath, pyConfig);
    console.log("✅ Updated python/pyproject.toml");
  } else {
    throw new Error("Could not find version string in pyproject.toml");
  }

  // 5. Commit and Tag
  const tagName = `${tagPrefix}${newVersion}`;
  const message = `[skip ci] [npm-auto-versioning] new released version v${newVersion}`;

  console.log("📝 Committing and Tagging...");
  await $`git add ${pkgPath} ${pyPath}`;
  await $`git commit -m ${message}`;
  await $`git tag -a ${tagName} -m ${message}`;

  // 6. Push (Optional, or leave to workflow)
  // The workflow handles pushing, but for local runs:
  console.log(`✅ Release ${tagName} ready! Don't forget to push: git push --follow-tags`);

} catch(err: any) {
  console.error("❌ Release failed:", err.message);
  process.exit(1);
}
