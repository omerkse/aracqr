const express = require("express");
const qr = require("qrcode");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// JSON dosyası kontrolü
try {
  if (!fs.existsSync(araclarFilePath)) {
    fs.writeFileSync(araclarFilePath, "[]", "utf8");
  }
} catch (error) {
  console.error("Dosya oluşturma hatası:", error);
}

// Verileri JSON'dan okuma
const getAraclar = () => {
  try {
    if (fs.existsSync(araclarFilePath)) {
      const data = fs.readFileSync(araclarFilePath, "utf8");
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error("Veri okuma hatası:", error);
    return [];
  }
};

// Veri kaydetme
const saveArac = (arac) => {
  try {
    let araclar = getAraclar();
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
    const arac = saveArac(req.body);
    const bilgiURL = `${req.protocol}://${req.get("host")}/bilgi/${arac.id}`;
    const qrKod = await qr.toDataURL(bilgiURL);
    res.render("qrkod", { qrKod, mesaj: "QR Kod başarıyla oluşturuldu." });
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

// Port ayarı
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server ${port} portunda çalışıyor`);
});

// Vercel için export
module.exports = app;
