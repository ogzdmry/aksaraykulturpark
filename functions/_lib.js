// Ortak yardımcılar — Kültürpark "Sizin Kareleriniz" (Cloudflare Pages Functions)
// Gerekli bağlama: KV namespace, değişken adı KARELER

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export const hata = (mesaj, status = 400) => json({ ok: false, hata: mesaj }, status);

export function kv(env) {
  return env && env.KARELER ? env.KARELER : null;
}

export function ip(request) {
  return request.headers.get("cf-connecting-ip") || "yerel";
}

// Basit hız sınırı: anahtar başına pencere içinde en fazla `max` istek
export async function hizSiniri(KV, anahtar, max, saniye) {
  const k = "rl:" + anahtar;
  const n = parseInt((await KV.get(k)) || "0", 10);
  if (n >= max) return false;
  await KV.put(k, String(n + 1), { expirationTtl: Math.max(60, saniye) });
  return true;
}

export function rastgele(bayt = 16) {
  const a = new Uint8Array(bayt);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function yeniId() {
  // Zaman sıralı kimlik: yeni kayıtlar sona gelir
  return Date.now().toString(36).padStart(9, "0") + rastgele(4);
}

export function temizMetin(s, max) {
  return String(s || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// ---- Şifre (PBKDF2-SHA256) ----
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sifreOzeti(sifre, tuz) {
  const anahtar = await crypto.subtle.importKey("raw", enc.encode(sifre), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(tuz), iterations: 100000 },
    anahtar,
    256
  );
  return hex(bits);
}

export function esitMi(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}

// Yönetici oturumu kontrolü (Authorization: Bearer <jeton>)
export async function yoneticiMi(request, KV) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer ([a-f0-9]{48})$/);
  if (!m) return false;
  return (await KV.get("oturum:" + m[1])) === "1";
}

// Tüm kare kayıtlarını (anahtar metadatasıyla) listeler
export async function tumKareler(KV) {
  const out = [];
  let cursor;
  do {
    const r = await KV.list({ prefix: "kare:", cursor });
    for (const k of r.keys) if (k.metadata) out.push({ id: k.name.slice(5), ...k.metadata });
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return out;
}

export async function kareYaz(KV, kayit) {
  const { id, ...meta } = kayit;
  await KV.put("kare:" + id, "1", { metadata: meta });
}
