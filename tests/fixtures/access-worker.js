// Test-only entry: uses a generated public key; never deployed by worker/wrangler.jsonc.
import { createHandler } from "../../worker/index.js";
export default {
  async fetch(req, env) {
    const key = await crypto.subtle.importKey(
      "jwk",
      JSON.parse(env.TEST_PUBLIC_KEY),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return createHandler({ resolveAccessKey: async () => key })(req, env);
  },
};
