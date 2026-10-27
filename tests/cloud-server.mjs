// Local integration fixture only. Never included in Cloudflare deployment.
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { createPasswordHash } from "../src/password.js";
const port = 4180,
  origin = `http://127.0.0.1:${port}`;
const passwordHash = await createPasswordHash("Local test password only 2026!");
const dir = await mkdtemp(join(tmpdir(), "island-cloud-"));
await build({
  entryPoints: ["worker/index.js"],
  bundle: true,
  format: "esm",
  outfile: join(dir, "worker.mjs"),
  target: "es2022",
});
const mf = new Miniflare({
  modules: true,
  modulesRoot: dir,
  scriptPath: join(dir, "worker.mjs"),
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
  bindings: {
    APP_ORIGINS: origin,
    TEACHER_PASSWORD_HASH: passwordHash,
    TEACHER_EMAILS: "g9641723@gmail.com",
    STUDENT_LOGIN_MODE: "class-seat",
  },
});
const db = await mf.getD1Database("DB");
await db.exec(await readFile("worker/migrations/0001_schema.sql", "utf8"));
await db.exec(await readFile("worker/migrations/0002_demo.sql", "utf8"));
const root = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (
          v &&
          ![
            "host",
            "connection",
            "content-length",
            "cf-access-jwt-assertion",
          ].includes(k)
        )
          headers.set(k, String(v));
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const r = await mf.dispatchFetch(origin + req.url, {
        method: req.method,
        headers,
        ...(body.length ? { body } : {}),
      });
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    const file = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + "/")) throw Error("path");
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      file.endsWith(".html")
        ? "text/html; charset=utf-8"
        : file.endsWith(".js")
          ? "application/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log("Local Pages/Worker/D1 integration fixture ready."),
);
async function close() {
  server.close();
  await mf.dispose();
  process.exit();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
