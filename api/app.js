require("dotenv").config();
const express = require("express");
const qr = require("qrcode");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// Supabase yapılandırması
const supabaseConfig = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_KEY,
};

const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

// Middleware ayarları
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosya yolları
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/images", express.static(path.join(__dirname, "..", "public/images")));
app.use(
  "/car-logos",
  express.static(path.join(__dirname, "..", "public/images/car-logos"))
);
app.use("/css", express.static(path.join(__dirname, "..", "public/css")));
app.use("/js", express.static(path.join(__dirname, "..", "public/js")));

// View engine ayarları
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

// Veritabanı işlemleri için yardımcı sınıf
class DatabaseService {
  // Plaka formatı için yardımcı fonksiyon
  static formatPlaka(plaka) {
    return plaka.trim().toUpperCase().replace(/\s+/g, " ");
  }

  // Plaka ile araç arama
  static async findAracByPlaka(plaka) {
    try {
      const formattedPlaka = this.formatPlaka(plaka);

      const { data, error } = await supabase
        .from("araclar")
        .select("*")
        .eq("plaka", formattedPlaka);

      if (error) {
        console.error("Plaka arama hatası:", error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error("Plaka arama hatası:", err);
      return null;
    }
  }

  // Yeni araç kaydetme
  static async saveArac(aracBilgileri) {
    try {
      const gerekliAlanlar = [
        "plaka",
        "marka",
        "model",
        "yil",
        "sahipAdi",
        "telefon",
        "kanGrubu",
        "acilNumara",
      ];
      for (const alan of gerekliAlanlar) {
        if (!aracBilgileri[alan]) {
          throw new Error(`${alan} alanı gereklidir`);
        }
      }

      const { data, error } = await supabase
        .from("araclar")
        .insert({
          plaka: this.formatPlaka(aracBilgileri.plaka),
          marka: aracBilgileri.marka.trim(),
          model: aracBilgileri.model.trim(),
          yil: parseInt(aracBilgileri.yil),
          sahipAdi: aracBilgileri.sahipAdi.trim(),
          telefon: aracBilgileri.telefon.trim(),
          kanGrubu: aracBilgileri.kanGrubu.trim(),
          acilNumara: aracBilgileri.acilNumara.trim(),
        })
        .select()
        .single();

      if (error) throw new Error(`Kayıt hatası: ${error.message}`);
      return data;
    } catch (error) {
      console.error("Araç kaydetme hatası:", error);
      throw error;
    }
  }

  // ID ile araç getirme
  static async getAracById(id) {
    try {
      const { data, error } = await supabase
        .from("araclar")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) throw new Error("Araç bulunamadı");
      return data;
    } catch (error) {
      console.error("Araç getirme hatası:", error);
      throw error;
    }
  }

  // Araç güncelleme
  static async updateArac(id, aracBilgileri) {
    try {
      const { data, error } = await supabase
        .from("araclar")
        .update({
          plaka: this.formatPlaka(aracBilgileri.plaka),
          marka: aracBilgileri.marka.trim(),
          model: aracBilgileri.model.trim(),
          yil: parseInt(aracBilgileri.yil),
          sahipAdi: aracBilgileri.sahipAdi.trim(),
          telefon: aracBilgileri.telefon.trim(),
          kanGrubu: aracBilgileri.kanGrubu.trim(),
          acilNumara: aracBilgileri.acilNumara.trim(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(`Güncelleme hatası: ${error.message}`);
      return data;
    } catch (error) {
      console.error("Araç güncelleme hatası:", error);
      throw error;
    }
  }
}

// QR Kod işlemleri için yardımcı sınıf
class QRService {
  static async createQRCode(url) {
    try {
      return await qr.toDataURL(url);
    } catch (error) {
      console.error("QR kod oluşturma hatası:", error);
      throw error;
    }
  }
}

// Route handlers
app.get("/", (req, res) => {
  res.render("index");
});

app.post("/qrolustur", async (req, res) => {
  try {
    const mevcutArac = await DatabaseService.findAracByPlaka(req.body.plaka);
    let arac, mesaj;

    if (mevcutArac) {
      arac = mevcutArac;
      mesaj = "Bu plaka zaten kayıtlı!";
    } else {
      arac = await DatabaseService.saveArac(req.body);
      mesaj = "QR kod başarıyla oluşturuldu.";
    }

    const bilgiURL = `${req.protocol}://${req.get("host")}/bilgi/${arac.id}`;
    const qrKod = await QRService.createQRCode(bilgiURL);

    res.render("qrkod", {
      qrKod,
      mesaj,
      hata: false,
    });
  } catch (error) {
    console.error("QR kod oluşturma hatası:", error);
    res.render("qrkod", {
      qrKod: null,
      mesaj: error.message,
      hata: true,
    });
  }
});

app.get("/bilgi/:id", async (req, res) => {
  try {
    const arac = await DatabaseService.getAracById(req.params.id);

    const bilgiler = {
      ...arac,
      kanGrubu: arac.kanGrubu.replace("pozitif", "+").replace("negatif", "-"),
    };

    res.render("bilgi", { bilgiler });
  } catch (error) {
    res.status(404).render("error", {
      mesaj: "Araç bilgileri bulunamadı",
    });
  }
});

// Araç güncelleme sayfası
app.get("/guncelle/:id", async (req, res) => {
  try {
    const arac = await DatabaseService.getAracById(req.params.id);
    res.render("guncelle", { arac });
  } catch (error) {
    res.status(404).render("error", {
      mesaj: "Araç bulunamadı",
    });
  }
});

// Araç güncelleme işlemi
app.post("/guncelle/:id", async (req, res) => {
  try {
    const updatedArac = await DatabaseService.updateArac(
      req.params.id,
      req.body
    );
    res.redirect(`/bilgi/${updatedArac.id}`);
  } catch (error) {
    res.status(500).render("error", {
      mesaj: "Güncelleme sırasında bir hata oluştu: " + error.message,
    });
  }
});

// Hata yakalama middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    mesaj: "Bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
  });
});

// Server başlatma
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} adresinde çalışıyor`);
});

module.exports = app;
