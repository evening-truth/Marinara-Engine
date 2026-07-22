import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LATEST_RELEASE_URL,
  checkForLauncherUpdate,
  getVersionFromReleaseUrl,
  isNewerStableVersion,
} from "../check-launcher-update.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const releaseUrl = "https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v2.3.4";

assert.equal(getVersionFromReleaseUrl(releaseUrl), "2.3.4");
assert.equal(getVersionFromReleaseUrl(LATEST_RELEASE_URL), null);
assert.equal(getVersionFromReleaseUrl("https://example.com/releases/tag/v9.9.9"), null);
assert.equal(isNewerStableVersion("2.3.3", "2.3.4"), true);
assert.equal(isNewerStableVersion("2.3.4", "2.3.4"), false);
assert.equal(isNewerStableVersion("2.4.0", "2.3.4"), false);
assert.equal(isNewerStableVersion("development", "2.3.4"), false);

const reminder = await checkForLauncherUpdate({
  currentVersion: "2.3.3",
  fetchImpl: async (url, options) => {
    assert.equal(url, LATEST_RELEASE_URL);
    assert.equal(options.method, "HEAD");
    assert.equal(options.redirect, "follow");
    return { ok: true, url: releaseUrl };
  },
});
assert.match(reminder, /Marinara Engine v2\.3\.4 is available/);
assert.match(reminder, /installed: v2\.3\.3/);
assert.match(reminder, /Automatic updates are disabled/);
assert.match(reminder, new RegExp(releaseUrl.replaceAll(".", "\\.")));

const currentReminder = await checkForLauncherUpdate({
  currentVersion: "2.3.4",
  fetchImpl: async () => ({ ok: true, url: releaseUrl }),
});
assert.equal(currentReminder, null);

const unavailableReminder = await checkForLauncherUpdate({
  currentVersion: "2.3.3",
  fetchImpl: async () => ({ ok: false, url: LATEST_RELEASE_URL }),
});
assert.equal(unavailableReminder, null);

for (const launcherName of ["start.sh", "start-termux.sh", "start.bat"]) {
  const launcherSource = readFileSync(join(repositoryRoot, launcherName), "utf8");
  assert.match(launcherSource, /check-launcher-update\.mjs/u);
}

console.log("Launcher update reminder regressions passed.");
