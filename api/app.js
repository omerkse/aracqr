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
    return plaka ? plaka.trim().toUpperCase().replace(/\s+/g, " ") : "";
  }

  // Güvenli trim fonksiyonu
  static safeTrim(value) {
    return value ? value.trim() : "";
  }

  // Plaka ile araç arama
  static async findAracByPlaka(plaka) {
    try {
      const formattedPlaka = this.formatPlaka(plaka);
      if (!formattedPlaka) return null;

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
          marka: this.safeTrim(aracBilgileri.marka),
          model: this.safeTrim(aracBilgileri.model),
          yil: parseInt(aracBilgileri.yil) || 0,
          sahipAdi: this.safeTrim(aracBilgileri.sahipAdi),
          telefon: this.safeTrim(aracBilgileri.telefon),
          kanGrubu: this.safeTrim(aracBilgileri.kanGrubu),
          acilNumara: this.safeTrim(aracBilgileri.acilNumara),
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
      if (!aracBilgileri) throw new Error("Araç bilgileri eksik");

      const updateData = {
        plaka: this.formatPlaka(aracBilgileri.plaka),
        marka: this.safeTrim(aracBilgileri.marka),
        model: this.safeTrim(aracBilgileri.model),
        yil: parseInt(aracBilgileri.yil) || 0,
        sahipAdi: this.safeTrim(aracBilgileri.sahipAdi),
        telefon: this.safeTrim(aracBilgileri.telefon),
        kanGrubu: this.safeTrim(aracBilgileri.kanGrubu),
        acilNumara: this.safeTrim(aracBilgileri.acilNumara),
      };

      const { data, error } = await supabase
        .from("araclar")
        .update(updateData)
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

// Marka ismini logo dosya adına dönüştüren yardımcı sınıf
class BrandFormatter {
  static formatBrandName(brand) {
    if (!brand) return "default";

    // Marka ismini küçük harfe çevir ve temizle
    let formattedBrand = brand
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/-/g, "")
      .replace(/[ıİ]/g, "i")
      .replace(/[ğĞ]/g, "g")
      .replace(/[üÜ]/g, "u")
      .replace(/[şŞ]/g, "s")
      .replace(/[öÖ]/g, "o")
      .replace(/[çÇ]/g, "c")
      .replace(/[âÂ]/g, "a")
      .replace(/[îİ]/g, "i")
      .replace(/[ûÛ]/g, "u");

    // Yaygın marka isimleri için eşleştirmeler
    const brandMappings = {
      // Ekstra eşleştirmeler
      bmw: "bmw",
      bmw: "bmw",
      mercedes: "mercedes",
      mercedesbenz: "mercedes",
      benz: "mercedes",
      vw: "volkswagen",
      volkswagen: "volkswagen",
      citroen: "citroen",
      peugeot: "peugeot",
      renault: "renault",
      audi: "audi",
      opel: "opel",
      toyota: "toyota",
      honda: "honda",
      nissan: "nissan",
      fiat: "fiat",
      hyundai: "hyundai",
      kia: "kia",
      ford: "ford",
      skoda: "skoda",
      citroen: "citroen",
      chery: "chery",
      peugeot: "peugeot",
      fiat: "fiat",
      honda: "honda",
      seat: "seat",
      dacia: "dacia",

      // Diğer markalar eklenebilir
    };

    // Eşleştirme sonucunu al
    const mappedBrand = brandMappings[formattedBrand];

    return mappedBrand || "default";
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
    res.redirect("/");
  }
});

app.get("/bilgi/:id", async (req, res) => {
  try {
    const arac = await DatabaseService.getAracById(req.params.id);
    const markaFormatted = BrandFormatter.formatBrandName(arac.marka);

    const bilgiler = {
      ...arac,
      markaFormatted,
      kanGrubu: arac.kanGrubu.replace("pozitif", "+").replace("negatif", "-"),
    };
    res.render("bilgi", { bilgiler });
  } catch (error) {
    console.error("Bilgi sayfası hatası:", error);
    res.redirect("/");
  }
});

app.get("/guncelle/:id", async (req, res) => {
  try {
    const arac = await DatabaseService.getAracById(req.params.id);
    res.render("guncelle", { arac });
  } catch (error) {
    res.redirect("/");
  }
});

app.post("/guncelle/:id", async (req, res) => {
  try {
    const updatedArac = await DatabaseService.updateArac(
      req.params.id,
      req.body
    );
    res.redirect(`/bilgi/${updatedArac.id}`);
  } catch (error) {
    console.error("Güncelleme hatası:", error);
    res.redirect("/");
  }
});

// Hata yakalama middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.redirect("/");
});

// Server başlatma
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} adresinde çalışıyor`);
});

module.exports = app;
