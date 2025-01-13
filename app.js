const express = require("express");
const qr = require("qrcode");
const fs = require("fs");
const path = require("path");
const app = express();

// Middleware ayarları
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// JSON dosyasının yolu
const araclarFilePath = path.join(__dirname, "araclar.json");

// JSON dosyası kontrolü
if (!fs.existsSync(araclarFilePath)) {
  fs.writeFileSync(araclarFilePath, "[]", "utf8");
}

// Verileri JSON'dan okuma
const getAraclar = () => {
  try {
    const data = fs.readFileSync(araclarFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Veri okuma hatası:", error);
    return [];
  }
};

// Plaka kontrolü
const findAracByPlaka = (plaka) => {
  const araclar = getAraclar();
  return araclar.find(
    (arac) =>
      arac.plaka.toLowerCase().replace(/\s/g, "") ===
      plaka.toLowerCase().replace(/\s/g, "")
  );
};

// Veri kaydetme
const saveArac = (arac) => {
  try {
    const araclar = getAraclar();
    const yeniArac = {
      id: Date.now().toString(),
      ...arac,
    };
    araclar.push(yeniArac);
    fs.writeFileSync(araclarFilePath, JSON.stringify(araclar, null, 2), "utf8");
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
      // Araç zaten varsa, mevcut QR kodu göster
      const bilgiURL = `${req.protocol}://${req.get("host")}/bilgi/${
        mevcutArac.id
      }`;
      const qrKod = await qr.toDataURL(bilgiURL);
      res.render("qrkod", { qrKod, mesaj: "Bu plaka zaten kayıtlı!" });
    } else {
      // Yeni araç kaydı
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
    const araclar = getAraclar();
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
const updateArac = (id, yeniBilgiler) => {
  try {
    const araclar = getAraclar();
    const index = araclar.findIndex((a) => a.id === id);

    if (index !== -1) {
      araclar[index] = { ...araclar[index], ...yeniBilgiler };
      fs.writeFileSync(
        araclarFilePath,
        JSON.stringify(araclar, null, 2),
        "utf8"
      );
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
    const araclar = getAraclar();
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

    // Güncel bilgilerle QR kod sayfasına yönlendir
    const bilgiURL = `${req.protocol}://${req.get("host")}/bilgi/${
      guncelArac.id
    }`;
    const qrKod = await qr.toDataURL(bilgiURL);
    res.render("qrkod", { qrKod, mesaj: "Bilgiler başarıyla güncellendi." });
  } catch (error) {
    res.status(500).send("Güncelleme sırasında bir hata oluştu");
  }
});

app.listen(3000, () => {
  console.log("Server http://localhost:3000 adresinde çalışıyor");
});
