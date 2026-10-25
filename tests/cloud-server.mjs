// Local integration fixture only. Never included in Cloudflare deployment.
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
const port = 4180,
  origin = `http://127.0.0.1:${port}`;
const pair = await generateKeyPair("RS256", { extractable: true });
const jwt = await new SignJWT({ email: "g9641723@gmail.com" })
  .setProtectedHeader({ alg: "RS256" })
  .setIssuer("https://island-test.cloudflareaccess.com")
  .setAudience("test-audience")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(pair.privateKey);
const dir = await mkdtemp(join(tmpdir(), "island-cloud-"));
await build({
  entryPoints: ["tests/fixtures/access-worker.js"],
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
    ACCESS_TEAM_DOMAIN: "island-test.cloudflareaccess.com",
    ACCESS_AUD: "test-audience",
    TEACHER_EMAILS: "g9641723@gmail.com",
    TEST_PUBLIC_KEY: JSON.stringify(await exportJWK(pair.publicKey)),
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
      if (
        req.headers.cookie
          ?.split(";")
          .some((x) => x.trim() === "eai_test_teacher=allow")
      )
        headers.set("Cf-Access-Jwt-Assertion", jwt);
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
