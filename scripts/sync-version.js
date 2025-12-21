const fs = require('fs');
const path = require('path');

const nodePackagePath = path.join(__dirname, '../node/package.json');
const pythonPackagePath = path.join(__dirname, '../python/pyproject.toml');

// Read Node version
const nodePackage = JSON.parse(fs.readFileSync(nodePackagePath, 'utf8'));
const version = nodePackage.version;

console.log(`Syncing version ${version} to python/pyproject.toml...`);

// Read Python config
let pythonConfig = fs.readFileSync(pythonPackagePath, 'utf8');

// Update version in pyproject.toml
// Regex looks for: version = "X.Y.Z"
const versionRegex = /^version\s*=\s*".*"/m;

if(versionRegex.test(pythonConfig)) {
  pythonConfig = pythonConfig.replace(versionRegex, `version = "${version}"`);
  fs.writeFileSync(pythonPackagePath, pythonConfig);
  console.log('Successfully updated python/pyproject.toml');
} else {
  console.error('Error: Could not find version string in pyproject.toml');
  process.exit(1);
}
