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
test("deployment stops before writes without Zero Trust or OTP", async () => {
  const paths = [];
  await assert.rejects(
    provision(config, {
      api: async (p, o) => {
        paths.push([p, o]);
        return {};
      },
      save: async () => {},
      run: async () => {},
    }),
    /Zero Trust/,
  );
  assert.equal(paths.length, 1);
});
test("provisioning binds private Worker, D1, teacher-only Access, and executes ordered migrations/deploy", async () => {
  const calls = [],
    steps = [],
    saves = [];
  const api = async (path, options = {}) => {
    calls.push([path, options]);
    if (path.endsWith("/organizations"))
      return { auth_domain: "school.cloudflareaccess.com" };
    if (path.endsWith("/identity_providers"))
      return [{ id: "otp", type: "onetimepin" }];
    if (path.endsWith("/pages/projects/test-island")) {
      const e = Error();
      e.status = 404;
      throw e;
    }
    if (path.endsWith("/pages/projects"))
      return { subdomain: "test-island.pages.dev" };
    if (path.includes("/d1/database?")) return [];
    if (path.endsWith("/d1/database")) return { uuid: "db-id" };
    if (path.endsWith("/access/apps")) return { id: "access-id", aud: "aud" };
    if (path.endsWith("/policies")) return { id: "policy-id" };
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
  const policy = JSON.parse(
    calls.find(([p]) => p.endsWith("/policies"))[1].body,
  );
  assert.equal(policy.include[0].email.email, config.email);
  assert(!calls.some(([p]) => /billing|subscriptions/.test(p)));
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
