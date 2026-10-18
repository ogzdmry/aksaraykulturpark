// GET /api/kareler — onaylanmış ziyaretçi karelerini herkese açık listeler
import { json, kv, tumKareler } from "../_lib.js";

export async function onRequestGet({ env }) {
  const KV = kv(env);
  if (!KV) return json({ ok: true, acik: false, kareler: [] }, 200, { "cache-control": "public, max-age=60" });
  const hepsi = await tumKareler(KV);
  const kareler = hepsi
    .filter((k) => k.d === "onay")
    .sort((a, b) => (b.o || 0) - (a.o || 0))
    .map((k) => ({ id: k.id, img: "/api/foto/" + k.id, not: k.n || "", gonderen: k.a || "", alan: k.l || "", yildiz: !!k.y }));
  const bekleyen = hepsi.filter((k) => k.d === "bekliyor").length;
  return json({ ok: true, acik: true, kareler, bekleyen }, 200, { "cache-control": "public, max-age=60" });
}
