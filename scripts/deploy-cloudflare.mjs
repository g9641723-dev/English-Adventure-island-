import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function requireDeploymentConfig(env, freeConfirmed) {
  if (!freeConfirmed)
    throw Error(
      "請先在 Cloudflare 控制台確認 Workers、D1 與 Zero Trust 都使用 Free 方案，再加 --free-plan-confirmed；程式不會升級方案。",
    );
  for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"])
    if (!env[name])
      throw Error(
        "環境設定缺少 " + name + "。請安全設定，不要在聊天中貼 Token。",
      );
  if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID))
    throw Error("CLOUDFLARE_ACCOUNT_ID 格式不正確。");
  return {
    account: env.CLOUDFLARE_ACCOUNT_ID,
    token: env.CLOUDFLARE_API_TOKEN,
    email: env.TEACHER_EMAILS || "g9641723@gmail.com",
    project:
      env.CF_PAGES_PROJECT ||
      "english-island-" + env.CLOUDFLARE_ACCOUNT_ID.slice(0, 8),
  };
}
export function apiClient(token, fetcher = fetch) {
  return async function api(path, options = {}) {
    const r = await fetcher("https://api.cloudflare.com/client/v4" + path, {
      ...options,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(30000),
    });
    let b;
    try {
      b = await r.json();
    } catch {
      throw Error("Cloudflare API 無法讀取回應，HTTP " + r.status);
    }
    if (!r.ok || b.success !== true) {
      const e = Error(
        `Cloudflare API ${r.status}: ${b.errors?.map((x) => x.message).join("; ") || "請求失敗"}`,
      );
      e.status = r.status;
      throw e;
    }
    return b.result;
  };
}
export async function provision(config, { api, run, save, receipt = {} }) {
  const base = "/accounts/" + config.account,
    project = config.project,
    worker = project + "-api";
  if (receipt.account && receipt.account !== config.account)
    throw Error("部署紀錄屬於其他帳戶，請先檢查 .cloudflare/deployment.json。");
  if (receipt.project && receipt.project !== project)
    throw Error("專案名稱與部署紀錄不同，請先檢查，避免覆蓋其他網站。");
  const org = await api(base + "/access/organizations");
  if (!org?.auth_domain || !org.auth_domain.endsWith(".cloudflareaccess.com"))
    throw Error(
      "請先建立 Cloudflare Zero Trust Free 團隊並啟用 Email One-time PIN；尚未建立任何網站或資料庫。",
    );
  const idps = await api(base + "/access/identity_providers");
  if (!idps.some((p) => p.type === "onetimepin"))
    throw Error(
      "請在 Zero Trust → Settings → Authentication 啟用 One-time PIN，毋須付費服務。",
    );
  let page;
  try {
    page = await api(base + "/pages/projects/" + project);
    if (!receipt.project)
      throw Error(
        "同名 Pages 專案已存在，為保護既有網站已停止；請設定另一個 CF_PAGES_PROJECT。",
      );
  } catch (e) {
    if (e.status !== 404) throw e;
    page = await api(base + "/pages/projects", {
      method: "POST",
      body: JSON.stringify({ name: project, production_branch: "main" }),
    });
  }
  Object.assign(receipt, {
    account: config.account,
    project,
    worker,
    studentUrl: "https://" + page.subdomain,
    teacherUrl: "https://" + page.subdomain + "/teacher.html",
  });
  await save(receipt);
  const databases = await api(base + "/d1/database?per_page=100");
  let db = databases.find((x) => x.name === project + "-results");
  if (db && receipt.databaseId !== db.uuid)
    throw Error("同名 D1 資料庫已存在且不在本次部署紀錄，已停止避免覆蓋。");
  if (!db)
    db = await api(base + "/d1/database", {
      method: "POST",
      body: JSON.stringify({ name: project + "-results" }),
    });
  receipt.databaseId = db.uuid;
  await save(receipt);
  let app;
  if (receipt.accessAppId)
    app = await api(base + "/access/apps/" + receipt.accessAppId);
  else {
    app = await api(base + "/access/apps", {
      method: "POST",
      body: JSON.stringify({
        name: project + " teachers",
        type: "self_hosted",
        domain: page.subdomain + "/teacher.html",
        self_hosted_domains: [
          page.subdomain + "/teacher.html",
          page.subdomain + "/api/admin/*",
        ],
        session_duration: "8h",
        app_launcher_visible: false,
        allowed_idps: idps
          .filter((x) => x.type === "onetimepin")
          .map((x) => x.id),
        auto_redirect_to_identity: true,
      }),
    });
    receipt.accessAppId = app.id;
    await save(receipt);
  }
  if (!receipt.accessPolicyId) {
    const policy = await api(base + "/access/apps/" + app.id + "/policies", {
      method: "POST",
      body: JSON.stringify({
        name: "Approved teachers only",
        decision: "allow",
        precedence: 1,
        include: config.email
          .split(",")
          .map((email) => ({ email: { email: email.trim() } })),
      }),
    });
    receipt.accessPolicyId = policy.id;
    await save(receipt);
  }
  if (!app.aud)
    throw Error("Access 尚未回傳 Audience，停止部署；請檢查 Access 應用。");
  const workerConfig = {
    $schema: resolve(root, "node_modules/wrangler/config-schema.json"),
    name: worker,
    account_id: config.account,
    main: resolve(root, "worker/index.js"),
    compatibility_date: "2026-08-01",
    workers_dev: false,
    preview_urls: false,
    observability: { enabled: false },
    triggers: { crons: ["17 19 * * *"] },
    d1_databases: [
      {
        binding: "DB",
        database_name: project + "-results",
        database_id: db.uuid,
        migrations_dir: resolve(root, "worker/migrations"),
      },
    ],
    vars: {
      APP_ORIGINS: receipt.studentUrl,
      ACCESS_TEAM_DOMAIN: org.auth_domain,
      ACCESS_AUD: app.aud,
      TEACHER_EMAILS: config.email,
    },
  };
  const pagesConfig = {
    name: project,
    pages_build_output_dir: resolve(root, "dist"),
    compatibility_date: "2026-08-01",
    services: [{ binding: "BACKEND", service: worker }],
  };
  await run("config", { workerConfig, pagesConfig });
  await run("migrate", {});
  await run("worker", {});
  await run("build", {});
  await run("pages", {});
  receipt.deployedAt = new Date().toISOString();
  receipt.accessTeamDomain = org.auth_domain;
  await save(receipt);
  return receipt;
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    console.log("Deployment configuration check (no remote writes):");
    console.log(
      "API token: " +
        (process.env.CLOUDFLARE_API_TOKEN ? "present" : "missing"),
    );
    console.log(
      "Account ID: " +
        (process.env.CLOUDFLARE_ACCOUNT_ID ? "present" : "missing"),
    );
    console.log(
      "Teacher allowlist: " +
        (process.env.TEACHER_EMAILS || "g9641723@gmail.com"),
    );
    console.log(
      "Requires a Free Zero Trust team with One-time PIN. No billing or plan-change API is used.",
    );
    return;
  }
  const config = requireDeploymentConfig(
    process.env,
    args.includes("--free-plan-confirmed"),
  );
  const dir = resolve(root, ".cloudflare");
  await mkdir(dir, { recursive: true });
  const receiptPath = resolve(dir, "deployment.json");
  let receipt = {};
  try {
    receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const save = (r) => writeFile(receiptPath, JSON.stringify(r, null, 2));
  await mkdir(resolve(dir, "xdg"), { recursive: true });
  const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  const execute = (file, args) => {
    const r = spawnSync(file, args, {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        CI: "true",
        XDG_CONFIG_HOME: resolve(dir, "xdg"),
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_LOG_PATH: resolve(dir, "wrangler.log"),
      },
    });
    if (r.status !== 0)
      throw Error(
        "部署命令失敗，停止於 " +
          args[0] +
          "；可依 .cloudflare/deployment.json 診斷後續跑。",
      );
  };
  const run = async (stage, data) => {
    if (stage === "config") {
      await writeFile(
        resolve(dir, "worker.json"),
        JSON.stringify(data.workerConfig, null, 2),
      );
      await writeFile(
        resolve(dir, "pages.json"),
        JSON.stringify(data.pagesConfig, null, 2),
      );
      return;
    }
    if (stage === "migrate")
      execute(process.execPath, [
        wrangler,
        "d1",
        "migrations",
        "apply",
        config.project + "-results",
        "--remote",
        "--config",
        resolve(dir, "worker.json"),
      ]);
    if (stage === "worker")
      execute(process.execPath, [
        wrangler,
        "deploy",
        "--config",
        resolve(dir, "worker.json"),
      ]);
    if (stage === "build")
      execute(process.execPath, [
        resolve(root, "node_modules/vite/bin/vite.js"),
        "build",
        "--mode",
        "cloud",
      ]);
    if (stage === "pages")
      execute(process.execPath, [
        wrangler,
        "pages",
        "deploy",
        resolve(root, "dist"),
        "--branch",
        "main",
        "--config",
        resolve(dir, "pages.json"),
      ]);
  };
  const result = await provision(config, {
    api: apiClient(config.token),
    run,
    save,
    receipt,
  });
  const status = await fetch(result.studentUrl + "/api/status", {
    signal: AbortSignal.timeout(20000),
  });
  if (!status.ok || (await status.json()).cloud !== true)
    throw Error(
      "已送出部署，但公開 API readiness 檢查未通過；不可宣稱網站已就緒。",
    );
  const teacher = await fetch(result.teacherUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  const target = teacher.headers.get("Location") || "";
  if (
    ![301, 302, 303, 307, 308, 401, 403].includes(teacher.status) ||
    (teacher.status < 400 && !target.includes(result.accessTeamDomain))
  )
    throw Error(
      "公開老師頁尚未觀察到 Access 保護，請檢查 Access 路徑；不可分發老師網址。",
    );
  result.publicReadinessVerifiedAt = new Date().toISOString();
  await save(result);
  console.log("Student URL: " + result.studentUrl);
  console.log("Teacher URL: " + result.teacherUrl);
  console.log(
    "Public API and unauthenticated Access gate verified; teacher OTP login still requires the authorized teacher.",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
