// POST /api/gonder — ziyaretçi fotoğraf gönderir; kayıt "bekliyor" durumunda saklanır
import { json, hata, kv, ip, hizSiniri, yeniId, temizMetin, kareYaz } from "../_lib.js";

const MAKS_BAYT = 3 * 1024 * 1024; // tarayıcıda küçültülmüş JPEG için üst sınır
const MAKS_BEKLEYEN = 300;

export async function onRequestPost({ request, env }) {
  const KV = kv(env);
  if (!KV) return hata("Fotoğraf gönderimi şu anda kapalı.", 503);

  let form;
  try { form = await request.formData(); } catch { return hata("Form okunamadı."); }

  // Bot tuzağı: gizli alan doluysa sessizce kabul edilmiş gibi davran
  if (temizMetin(form.get("web"), 100)) return json({ ok: true });

  const ad = temizMetin(form.get("ad"), 40);
  const alan = temizMetin(form.get("alan"), 40);
  const not = temizMetin(form.get("aciklama"), 90);
  const izin = form.get("izin");
  const foto = form.get("foto");

  if (!ad) return hata("Lütfen adınızı yazın.");
  if (!alan) return hata("Lütfen fotoğrafın çekildiği alanı seçin.");
  if (izin !== "evet") return hata("Yayın izni kutusunu işaretlemelisiniz.");
  if (!foto || typeof foto === "string") return hata("Lütfen bir fotoğraf seçin.");
  if (foto.size > MAKS_BAYT) return hata("Fotoğraf çok büyük.");

  const veri = await foto.arrayBuffer();
  const b = new Uint8Array(veri.slice(0, 3));
  if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) return hata("Fotoğraf biçimi desteklenmiyor.");

  if (!(await hizSiniri(KV, "gonder:" + ip(request), 6, 3600)))
    return hata("Kısa sürede çok fazla fotoğraf gönderdiniz. Lütfen biraz sonra tekrar deneyin.", 429);

  const bekleyen = parseInt((await KV.get("sayac:bekleyen")) || "0", 10);
  if (bekleyen >= MAKS_BEKLEYEN) return hata("Şu anda çok fazla fotoğraf onay bekliyor. Lütfen daha sonra tekrar deneyin.", 503);

  const id = yeniId();
  await KV.put("foto:" + id, veri);
  await kareYaz(KV, { id, d: "bekliyor", n: not, a: ad, l: alan, t: Date.now() });
  await KV.put("sayac:bekleyen", String(bekleyen + 1));
  return json({ ok: true });
}
