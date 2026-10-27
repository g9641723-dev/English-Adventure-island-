// Shared browser/Worker Web Crypto only; never stores or transmits a password.
const encoder = new TextEncoder();
const hex = (bytes) =>
  [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s) => new Uint8Array(s.match(/../g).map((x) => parseInt(x, 16)));
export function validPasswordHash(value) {
  return (
    typeof value === "string" &&
    /^pbkdf2-sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value)
  );
}
function validPassword(password) {
  return (
    typeof password === "string" &&
    [...password].length >= 14 &&
    encoder.encode(password).length <= 128
  );
}
async function derive(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      key,
      256,
    ),
  );
}
export async function createPasswordHash(password) {
  if (!validPassword(password))
    throw Error(
      "密碼至少 14 個字元，UTF-8 長度不可超過 128 bytes；建議使用長且不重複的密碼。",
    );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$100000$${hex(salt)}$${hex(await derive(password, salt))}`;
}
export async function verifyPassword(password, value) {
  if (!validPasswordHash(value) || !validPassword(password)) return false;
  const [, , salt, hash] = value.split("$");
  const actual = await derive(password, unhex(salt)),
    expected = unhex(hash);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}
