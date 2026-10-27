import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requireDeploymentConfig,
  provision,
  apiClient,
} from "../scripts/deploy-cloudflare.mjs";
const config = {
  account: "a".repeat(32),
  project: "test-island",
  email: "teacher@example.test",
  token: "not-a-real-token",
};
test("deployment requires explicit Free confirmation and injected credentials", () => {
  assert.throws(() => requireDeploymentConfig({}, false), /Free/);
  assert.throws(
    () => requireDeploymentConfig({}, true),
    /CLOUDFLARE_API_TOKEN/,
  );
  assert.throws(
    () =>
      requireDeploymentConfig(
        { CLOUDFLARE_API_TOKEN: "x", CLOUDFLARE_ACCOUNT_ID: "bad" },
        true,
      ),
    /格式/,
  );
});
test("deployment refuses an existing untracked project before altering resources", async () => {
  const calls = [];
  await assert.rejects(
    provision(config, {
      api: async (p) => {
        calls.push(p);
        return { subdomain: "existing.pages.dev" };
      },
      save: async () => {},
      run: async () => {},
    }),
    /同名 Pages/,
  );
  assert.equal(calls.length, 1);
});
test("provisioning binds private Worker and D1 without Access or billing APIs", async () => {
  const calls = [],
    steps = [],
    saves = [];
  const api = async (path, options = {}) => {
    calls.push([path, options]);
    if (path.endsWith("/pages/projects/test-island")) {
      const e = Error();
      e.status = 404;
      throw e;
    }
    if (path.endsWith("/pages/projects"))
      return { subdomain: "test-island.pages.dev" };
    if (path.includes("/d1/database?")) return [];
    if (path.endsWith("/d1/database")) return { uuid: "db-id" };
    throw Error("Unexpected API " + path);
  };
  const r = await provision(config, {
    api,
    save: async (r) => saves.push(structuredClone(r)),
    run: async (stage, data) => steps.push([stage, data]),
  });
  assert.deepEqual(
    steps.map((x) => x[0]),
    ["config", "migrate", "worker", "build", "pages"],
  );
  assert.equal(steps[0][1].workerConfig.workers_dev, false);
  assert.equal(steps[0][1].workerConfig.d1_databases[0].database_id, "db-id");
  assert.equal(
    steps[0][1].workerConfig.vars.APP_ORIGINS,
    "https://test-island.pages.dev",
  );
  assert.equal(steps[0][1].workerConfig.vars.TEACHER_EMAILS, config.email);
  assert(!calls.some(([p]) => /billing|subscriptions|access\//.test(p)));
  assert.equal(steps[0][1].workerConfig.vars.TEACHER_PASSWORD_HASH, undefined);
  assert.equal(r.teacherUrl, "https://test-island.pages.dev/teacher.html");
  assert(saves.every((s) => !JSON.stringify(s).includes(config.token)));
});
test("API failures and non-JSON responses do not report successful deploy", async () => {
  await assert.rejects(
    apiClient("x", async () => ({
      status: 403,
      ok: false,
      json: async () => ({ success: false, errors: [{ message: "denied" }] }),
    }))("/x"),
    /403/,
  );
  await assert.rejects(
    apiClient("x", async () => ({
      status: 500,
      json: async () => {
        throw Error();
      },
    }))("/x"),
    /500/,
  );
});
