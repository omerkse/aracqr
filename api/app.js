const express = require("express");
const qr = require("qrcode");
const path = require("path"); // path modülünü kullanacağız
const app = express();

// Middleware ayarları
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosyalar için doğru yolu belirtme
app.use(express.static(path.join(__dirname, "public")));

// View engine olarak ejs ayarla ve views dizinini belirt
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views")); // views dizini, api'nin bir üst seviyesinde

// Vercel için in-memory storage (geçici çözüm)
let araclar = [];

// Plaka kontrolü
const findAracByPlaka = (plaka) => {
  return araclar.find(
    (arac) =>
      arac.plaka.toLowerCase().replace(/\s/g, "") ===
      plaka.toLowerCase().replace(/\s/g, "")
  );
};

// Veri kaydetme
const saveArac = (arac) => {
  try {
    const yeniArac = {
      id: Date.now().toString(),
      ...arac,
    };
    araclar.push(yeniArac);
    return yeniArac;
  } catch (error) {
    console.error("Veri kaydetme hatası:", error);
    throw error;
  }
};

// Ana sayfa
app.get("/", (req, res) => {
  res.render("index");
});

// QR kod oluşturma
app.post("/qrolustur", async (req, res) => {
  try {
    // Plaka kontrolü
    const mevcutArac = findAracByPlaka(req.body.plaka);

    if (mevcutArac) {
      const bilgiURL = `${req.protocol}://${req.get("host")}/bilgi/${
        mevcutArac.id
      }`;
      const qrKod = await qr.toDataURL(bilgiURL);
      res.render("qrkod", { qrKod, mesaj: "Bu plaka zaten kayıtlı!" });
    } else {
      const arac = saveArac(req.body);
      const bilgiURL = `${req.protocol}://${req.get("host")}/bilgi/${arac.id}`;
      const qrKod = await qr.toDataURL(bilgiURL);
      res.render("qrkod", { qrKod, mesaj: "QR kod başarıyla oluşturuldu." });
    }
  } catch (err) {
    console.error("QR kod oluşturma hatası:", err);
    res.status(500).send(`Bir hata oluştu: ${err.message}`);
  }
});

// Bilgi görüntüleme
app.get("/bilgi/:id", (req, res) => {
  try {
    const arac = araclar.find((a) => a.id === req.params.id);

    if (!arac) {
      return res.status(404).send("Araç bulunamadı");
    }

    res.render("bilgi", { bilgiler: arac });
  } catch (error) {
    console.error("Bilgi görüntüleme hatası:", error);
    res.status(500).send("Bilgiler görüntülenirken bir hata oluştu");
  }
});

// Güncelleme işlemleri
const updateArac = (id, yeniBilgiler) => {
  try {
    const index = araclar.findIndex((a) => a.id === id);

    if (index !== -1) {
      araclar[index] = { ...araclar[index], ...yeniBilgiler };
      return araclar[index];
    }
    return null;
  } catch (error) {
    console.error("Güncelleme hatası:", error);
    throw error;
  }
};

// Güncelleme formu sayfası
app.get("/guncelle/:id", (req, res) => {
  try {
    const arac = araclar.find((a) => a.id === req.params.id);

    if (!arac) {
      return res.status(404).send("Araç bulunamadı");
    }

    res.render("guncelle", { arac });
  } catch (error) {
    res.status(500).send("Bir hata oluştu");
  }
});

// Güncelleme işlemi
app.post("/guncelle/:id", async (req, res) => {
  try {
    const guncelArac = updateArac(req.params.id, req.body);

    if (!guncelArac) {
      return res.status(404).send("Araç bulunamadı");
    }

    const bilgiURL = `${req.protocol}://${req.get("host")}/bilgi/${
      guncelArac.id
    }`;
    const qrKod = await qr.toDataURL(bilgiURL);
    res.render("qrkod", { qrKod, mesaj: "Bilgiler başarıyla güncellendi." });
  } catch (error) {
    res.status(500).send("Güncelleme sırasında bir hata oluştu");
  }
});

// Vercel için module.exports
module.exports = app;

// Eğer doğrudan çalıştırılıyorsa (development)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} adresinde çalışıyor`);
  });
}
