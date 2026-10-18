// GET /api/foto/<id> — fotoğrafı döndürür. Onay bekleyenler yalnızca yöneticiye görünür.
import { kv, yoneticiMi } from "../../_lib.js";

export async function onRequestGet({ request, env, params }) {
  const KV = kv(env);
  const id = String(params.id || "");
  if (!KV || !/^[a-z0-9]{9,30}$/.test(id)) return new Response("Bulunamadı", { status: 404 });
  const { metadata } = await KV.getWithMetadata("kare:" + id);
  if (!metadata) return new Response("Bulunamadı", { status: 404 });
  const onayli = metadata.d === "onay";
  if (!onayli && !(await yoneticiMi(request, KV))) return new Response("Bulunamadı", { status: 404 });
  const veri = await KV.get("foto:" + id, { type: "arrayBuffer" });
  if (!veri) return new Response("Bulunamadı", { status: 404 });
  return new Response(veri, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": onayli ? "public, max-age=86400" : "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
