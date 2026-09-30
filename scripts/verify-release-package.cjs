'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const archive = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(archive)) {
    throw new Error('Usage: node scripts/verify-release-package.cjs <absolute-package.tgz>');
}

function tar(args) {
    return execFileSync(process.platform === 'win32' ? 'tar.exe' : 'tar', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

const entries = tar(['-tzf', archive])
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
const files = entries.filter((entry) => !entry.endsWith('/'));
assert.ok(entries.length > 0, 'package archive must not be empty');
for (const entry of entries) {
    const normalized = path.posix.normalize(entry.replace(/\\/g, '/'));
    assert.ok(!normalized.startsWith('/') && normalized !== '..' && !normalized.startsWith('../'));
    assert.equal(normalized, entry.replace(/\\/g, '/'), `unexpected or unsafe archive entry: ${entry}`);
}

const rootPackage = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const packagedPackage = JSON.parse(tar(['-xOzf', archive, 'package/package.json']));
const packagedIoPackage = JSON.parse(tar(['-xOzf', archive, 'package/io-package.json']));
assert.equal(packagedPackage.name, 'iobroker.heiko');
assert.equal(packagedPackage.version, rootPackage.version);
assert.equal(packagedIoPackage.common.name, 'heiko');
assert.equal(packagedIoPackage.common.version, rootPackage.version);
assert.ok(files.includes('package/build/main.js'), 'compiled adapter entry point is missing');
assert.ok(files.some((entry) => entry.startsWith('package/build/lib/')));

const buildFiles = files.filter((entry) => entry.startsWith('package/build/'));
assert.ok(buildFiles.length > 0, 'compiled build files are missing');
for (const entry of buildFiles) {
    assert.match(entry, /^package\/build\/.+\.js$/);
    assert.doesNotMatch(entry, /\.map$/i, `source map must not be packaged: ${entry}`);
}

for (const forbiddenPrefix of ['package/src/', 'package/test/', 'package/tests/', 'package/scripts/']) {
    assert.ok(!files.some((entry) => entry.startsWith(forbiddenPrefix)), `${forbiddenPrefix} must not be packaged`);
}
for (const required of [
    'package/README.md',
    'package/README.de.md',
    'package/MAPPING.md',
    'package/CHANGELOG.md',
    'package/LICENSE',
    'package/THIRD_PARTY_NOTICES.md',
]) {
    assert.ok(files.includes(required), `required release document is missing: ${required}`);
}
assert.ok(
    files.some((entry) => entry.startsWith('package/docs/')),
    'release docs directory is missing',
);

const privateFixturePatterns = [
    /\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/i,
    /\b[0-9a-f]{12}\b/i,
    /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3})\b/,
    /\b(?:[A-Z]:\\(?:Users|Documents and Settings)\\[^\s"<>]+|\/home\/[^/\s]+\/[^\s"<>]*)/i,
];
const textFiles = files.filter((entry) => /\.(?:json|js|md|html|txt|yaml|yml)$/i.test(entry));
for (const entry of textFiles) {
    const content = tar(['-xOzf', archive, entry]);
    for (const pattern of privateFixturePatterns) {
        assert.ok(!pattern.test(content), `private fixture marker ${pattern} found in ${entry}`);
    }
}

console.log(
    `Verified ${path.basename(archive)}: ${packagedPackage.name}@${packagedPackage.version}, ` +
        `${buildFiles.length} compiled JavaScript files, no maps/tests/source/scripts, release docs present.`,
);
