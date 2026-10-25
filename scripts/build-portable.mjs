import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
const output = await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  define: { "import.meta.env.VITE_CLOUD_MODE": '"false"' },
  format: "iife",
  outfile: "game.js",
  write: false,
  minify: true,
  target: ["chrome100", "edge100"],
  legalComments: "inline",
});
const js = output.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = output.outputFiles.find((f) => f.path.endsWith(".css")).text;
const templates = {};
for (const name of ["questions.json", "questions.csv"])
  templates["/templates/" + name] = await readFile(
    "public/templates/" + name,
    "utf8",
  );
const bootstrap = `const portableTemplates=${JSON.stringify(templates)};document.addEventListener('click',e=>{const a=e.target.closest('a[href]');const key=a?.getAttribute('href');if(!Object.hasOwn(portableTemplates,key))return;e.preventDefault();const url=URL.createObjectURL(new Blob([portableTemplates[key]],{type:key.endsWith('.csv')?'text/csv;charset=utf-8':'application/json'}));const link=document.createElement('a');link.href=url;link.download=key.split('/').pop();link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},true);`;
const icon = await readFile("public/favicon.svg", "utf8");
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>English Adventure Island · 英語冒險島（本機版）</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}"><style>${css.replaceAll("</style", "<\\/style")}</style></head><body><div id="app"></div><script>${(bootstrap + "\n" + js).replaceAll("</script", "<\\/script")}</script></body></html>`;
await writeFile("English-Adventure-Island.html", html);
console.log(
  `Portable game built: ${Buffer.byteLength(html)} bytes; all artwork, music and templates embedded.`,
);
