const express = require("express");
const qr = require("qrcode");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(
  "/car-logos",
  express.static(path.join(__dirname, "..", "public/images/car-logos"))
);

// Geçici dosya dizini ve dosya yolu
const tmpDirPath = path.join(__dirname, "tmp");
const tmpFilePath = path.join(tmpDirPath, "araclar.json");

// Geçici dosya dizini yoksa oluştur
if (!fs.existsSync(tmpDirPath)) {
  fs.mkdirSync(tmpDirPath);
}

// JSON dosyasından araçları yükle
const loadAraclar = () => {
  if (fs.existsSync(tmpFilePath)) {
    const data = fs.readFileSync(tmpFilePath, "utf8");
    return JSON.parse(data);
  }
  return []; // Dosya yoksa boş array döndür
};

// JSON dosyasına araçları kaydet
const saveAraclar = (data) => {
  fs.writeFileSync(tmpFilePath, JSON.stringify(data, null, 4), "utf8");
};

// Araç listesi
let araclar = loadAraclar();

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
  const yeniArac = {
    id: Date.now().toString(),
    ...arac,
    kanGrubu: arac.kanGrubu.replace("+", "pozitif").replace("-", "negatif"),
  };
  araclar.push(yeniArac);
  saveAraclar(araclar);
  return yeniArac;
};

// Ana sayfa
app.get("/", (req, res) => {
  res.render("index");
});

// QR kod oluşturma
app.post("/qrolustur", async (req, res) => {
  try {
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

    const bilgiler = {
      ...arac,
      kanGrubu: arac.kanGrubu.replace("pozitif", "+").replace("negatif", "-"),
    };

    res.render("bilgi", { bilgiler });
  } catch (error) {
    console.error("Bilgi görüntüleme hatası:", error);
    res.status(500).send("Bilgiler görüntülenirken bir hata oluştu");
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} adresinde çalışıyor`);
  });
}
