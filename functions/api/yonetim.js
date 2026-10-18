// POST /api/yonetim — "Onay bekleyenler" ekranının işlemleri (şifreli)
import { json, hata, kv, ip, hizSiniri, rastgele, sifreOzeti, esitMi, yoneticiMi, tumKareler, kareYaz, temizMetin } from "../_lib.js";

const OTURUM_SURE = 12 * 3600;

async function oturumAc(KV) {
  const jeton = rastgele(24);
  await KV.put("oturum:" + jeton, "1", { expirationTtl: OTURUM_SURE });
  return jeton;
}

export async function onRequestPost({ request, env }) {
  const KV = kv(env);
  if (!KV) return hata("Depolama bağlantısı (KARELER) henüz kurulmamış.", 503);
  let g;
  try { g = await request.json(); } catch { return hata("İstek okunamadı."); }
  const islem = String(g.islem || "");
  const kayitliSifre = await KV.get("ayar:sifre", { type: "json" });

  if (islem === "durum") return json({ ok: true, kurulu: !!kayitliSifre });

  if (islem === "kur") {
    if (kayitliSifre) return hata("Şifre zaten belirlenmiş.", 409);
    const sifre = String(g.sifre || "");
    if (sifre.length < 8) return hata("Şifre en az 8 karakter olmalı.");
    const tuz = rastgele(16);
    await KV.put("ayar:sifre", JSON.stringify({ tuz, ozet: await sifreOzeti(sifre, tuz) }));
    return json({ ok: true, jeton: await oturumAc(KV) });
  }

  if (islem === "giris") {
    if (!kayitliSifre) return hata("Önce şifre belirlenmeli.", 409);
    if (!(await hizSiniri(KV, "giris:" + ip(request), 10, 3600))) return hata("Çok fazla deneme. Bir saat sonra tekrar deneyin.", 429);
    const ozet = await sifreOzeti(String(g.sifre || ""), kayitliSifre.tuz);
    if (!esitMi(ozet, kayitliSifre.ozet)) return hata("Şifre hatalı.", 401);
    return json({ ok: true, jeton: await oturumAc(KV) });
  }

  if (!(await yoneticiMi(request, KV))) return hata("Oturum süresi doldu, lütfen tekrar giriş yapın.", 401);

  if (islem === "cikis") {
    const m = (request.headers.get("authorization") || "").match(/^Bearer (\w+)$/);
    if (m) await KV.delete("oturum:" + m[1]);
    return json({ ok: true });
  }

  if (islem === "sifre-degistir") {
    const sifre = String(g.sifre || "");
    if (sifre.length < 8) return hata("Şifre en az 8 karakter olmalı.");
    const tuz = rastgele(16);
    await KV.put("ayar:sifre", JSON.stringify({ tuz, ozet: await sifreOzeti(sifre, tuz) }));
    return json({ ok: true });
  }

  const hepsi = await tumKareler(KV);

  if (islem === "liste") {
    const bekleyen = hepsi.filter((k) => k.d === "bekliyor").length;
    await KV.put("sayac:bekleyen", String(bekleyen));
    return json({ ok: true, kareler: hepsi.sort((a, b) => (b.t || 0) - (a.t || 0)) });
  }

  const id = String(g.id || "");
  const kayit = hepsi.find((k) => k.id === id);
  if (!kayit) return hata("Kayıt bulunamadı (başka bir sekmede işlenmiş olabilir).", 404);

  if (islem === "onayla") {
    if (g.not != null) kayit.n = temizMetin(g.not, 90);
    if (g.gonderen != null) kayit.a = temizMetin(g.gonderen, 40);
    const yeni = kayit.d !== "onay";
    kayit.d = "onay";
    if (yeni) kayit.o = Date.now();
    await kareYaz(KV, kayit);
    if (yeni) await azalt(KV);
    return json({ ok: true, kare: kayit });
  }

  if (islem === "reddet" || islem === "kaldir") {
    await KV.delete("kare:" + id);
    await KV.delete("foto:" + id);
    if (kayit.d === "bekliyor") await azalt(KV);
    return json({ ok: true });
  }

  if (islem === "yildiz") {
    const ac = !kayit.y;
    for (const k of hepsi) {
      const olmali = k.id === id ? ac : false;
      if (!!k.y !== olmali) { k.y = olmali; await kareYaz(KV, k); }
    }
    return json({ ok: true, yildiz: ac });
  }

  return hata("Bilinmeyen işlem.");
}

async function azalt(KV) {
  const n = parseInt((await KV.get("sayac:bekleyen")) || "0", 10);
  await KV.put("sayac:bekleyen", String(Math.max(0, n - 1)));
}
