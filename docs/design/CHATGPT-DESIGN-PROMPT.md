# ChatGPT için tasarım istemi (moodboard + logo)

Aşağıdaki çizginin altındaki metnin tamamını ChatGPT'ye yapıştır. `[FİKRİM]` kısmına ChatGPT'nin
bulduğu tasarım fikrini ya da kendi notlarını yaz.

ChatGPT cevap verdiğinde:
1. Görselleri (moodboard, ekran taslakları, logo önizlemesi) indir ve bana gönder.
2. En sondaki **HANDOFF** kod bloğunu olduğu gibi kopyalayıp bana yapıştır.

Ben de bunları uygulamaya işlerim.

---

Sen deneyimli bir ürün tasarımcısı ve marka tasarımcısısın. Açık kaynak bir web uygulaması için
moodboard destekli bir görsel kimlik ve arayüz yönü hazırlamanı istiyorum. Sonuç bir geliştiriciye
(bir yapay zekâ kodlama asistanına) devredilecek. Bu yüzden kesin değerler ver (hex, px, font
ağırlığı); "sıcak bir turuncu" gibi muğlak tarifler yetmez.

## Ürün

- **Ad:** PageHut
- **Ne yapar:** Oyun geliştirme ekipleri için ücretsiz, blok tabanlı bir oyun tasarım dokümanı
  (GDD) çalışma alanı. Blok tabanlı editör, sayfa ağacı, `/` komut menüsü, GDD şablonları, tasarım
  ilkeleri (design pillars) şeridi ve sayfa bağlantıları var.
- **Verinin yeri:** Belgeler GitHub deposunda Markdown dosyası olarak saklanıyor; ekipler oyunun
  Unity/Unreal deposunun içindeki bir `GDD/` klasöründe çalışabiliyor. Giriş "GitHub ile giriş"
  düğmesiyle.
- **Kullanıcılar:** Oyun tasarımı öğrencileri, 2–6 kişilik indie ekipler, üniversite dersleri.
  Türkçe, İngilizce ve Almanca arayüz; ileride Arapça (sağdan sola).
- **Ton:** Sakin, odaklı, profesyonel ama sıkıcı değil. Oyun dünyasına ait hissettirmeli
  (atölye, defter, harita, el yapımı alet hissi); ama "gamer" estetiği (neon, RGB, agresif açılar)
  istemiyorum. Uzun süre yazı yazılan bir araç: okunabilirlik her şeyden önce gelir.

## Benim fikrim

[FİKRİM]

## Sabit kısıtlar (bunlara uy)

- **Arayüz fontu:** Bricolage Grotesque (Google Fonts, variable). Kod için JetBrains Mono.
  Uzun belge metni için Bricolage Grotesque'e uyumlu ikinci bir font önerebilirsin (isteğe bağlı,
  ücretsiz/OFL olmalı).
- **Temalar:** Açık ve koyu tema; ikisi de birinci sınıf olmalı.
- **Erişilebilirlik:** WCAG AA. Metin/arka plan çiftleri en az 4.5:1, büyük metin ve ikonlar en az
  3:1. Verdiğin her renk çifti için kontrast oranını yaz.
- **Cam efekti:** Yalnızca "krom" parçalarda (kenar çubuğu, menüler, diyaloglar, bildirimler).
  Yazı yazılan belge alanı her zaman düz ve opak kalır.
- **Logo:** 16×16 px favicon boyutunda bile okunmalı. Tek renk sürümü olmalı. Açık ve koyu
  zeminde çalışmalı. Başka bir markayı (GitHub, Unity vb.) çağrıştırmamalı.
- **Kurulu yapı:** Arayüz şu CSS değişken adlarıyla kurulu. Yeni değerleri bu adlarla ver;
  gerekiyorsa yeni token ekleyebilirsin, ama mevcutları kaldırma:
  `--bg --canvas --surface --surface-glass --surface-hover --surface-active --hairline --fg
  --fg-muted --fg-subtle --accent --accent-fg --accent-text --accent-soft --success --success-soft
  --warning --warning-soft --danger --danger-soft --info --info-soft --ring --shadow-float`
  (`--accent-fg` = vurgu renkli dolgunun üstündeki yazı; `--accent-text` = normal zeminde vurgu
  renginde yazı.)

## Mevcut ekranlar (yeniden tasarlanacaklar)

1. **Kenar çubuğu:** logo + çalışma alanı seçici, depolama rozeti ("Yerel mod" ya da
   `kullanıcı/depo/GDD`), Ara (Ctrl+K), Şablonlar, Çöp kutusu, sürükle-bırak sayfa ağacı, en altta
   tema ve dil seçici.
2. **Sayfa:** üst çubuk (sayfa yolu, "Yerel olarak kaydedildi", "Gönderilecek 3 değişiklik"
   eşitleme düğmesi, ⋯ menüsü), altında tasarım ilkeleri şeridi, büyük başlık, blok editörü
   (başlıklar, yapılacaklar, bilgi/uyarı/fikir kutuları, açılır bloklar, tablolar, görseller),
   altta geri bağlantılar.
3. **Diyaloglar:** Ctrl+K arama, şablon galerisi (14 GDD şablonu, 4 kategori, sağda önizleme),
   GitHub'a kaydet/aç (depo listesi, klasör alanı), paylaş, tasarım ilkeleri düzenleyici.
4. **Eşitleme ve ekip çalışması:**
   - Üst çubuktaki eşitleme düğmesinin durumları: eşitlendi, gönderiliyor, "3 değişiklik
     gönderilecek", "1 sayfa kararını bekliyor", çevrimdışı.
   - Çakışma şeridi: "Bu sayfa GitHub'da da değişti", yanında *Karşılaştır / Benimkini tut /
     Onunkini tut* düğmeleri.
   - Karşılaştırma görünümü: satır satır, "senin" ve "GitHub'daki" sürüm.
   - Sayfa geçmişi diyaloğu: solda sürüm listesi (kim, ne zaman), sağda önizleme ve "Bu sürümü
     geri yükle" düğmesi.
   - Üst çubukta "son düzenleyen: avatar + kullanıcı adı + ne zaman".
5. **Mobil:** kenar çubuğu çekmece olarak açılıyor.

## İstediğim çıktı (bu sırayla)

1. **Tasarım yönü:** Bir isim ve tek cümlelik özet; ardından 3 tasarım ilkesi ve her biri için
   "yapılır / yapılmaz" örneği.
2. **Moodboard:**
   - 8–12 referans (oyun dünyasından, editoryal tasarımdan, araç arayüzlerinden, malzeme ve
     dokulardan). Her biri için "bundan şunu alıyoruz" notu yaz.
   - Bunları tek bir moodboard görseli olarak **üret** (ızgara düzeninde, renk paleti şeridiyle
     birlikte).
3. **Renk sistemi:**
   - Yukarıdaki token'ların her biri için açık ve koyu tema hex değerleri.
   - Önemli çiftlerin kontrast oranları (fg/canvas, fg-muted/canvas, accent-text/canvas,
     accent-fg/accent ve diğerleri).
   - Bilgi kutusu varyantları (info, warning, danger, success, idea) için arka plan ve ikon rengi.
4. **Tipografi:** Bricolage Grotesque ile ölçek: sayfa başlığı, H1, H2, H3, gövde, küçük metin,
   etiket. Her biri için boyut, satır yüksekliği, ağırlık, harf aralığı ve (variable font
   olduğundan) optik boyut ve genişlik ayarı varsa onlar.
5. **Biçim dili:**
   - Köşe yarıçapları, gölgeler, kenar çizgileri, boşluk ölçeği.
   - Cam efektinin tam değerleri (blur, opaklık, kenar).
   - İkon stili (çizgi kalınlığı; Lucide ile uyumlu olmalı).
   - Hareket: süreler ve easing; "hareketi azalt" tercihine uyulmalı.
6. **Ekran taslakları:** İki görsel **üret**:
   - Koyu temada sayfa ekranı (kenar çubuğu + editör + ilkeler şeridi).
   - Açık temada şablon galerisi diyaloğu.
7. **Logo:**
   - 3 farklı konsept; her biri için kısa gerekçe ve önizleme görseli.
   - Birini seç ve şunları **SVG kodu olarak** ver:
     (a) ikon, `viewBox="0 0 32 32"`, 16 px'te okunur, en fazla 2 renk;
     (b) tek renk ikon (`currentColor` kullanan);
     (c) yatay logotip (ikon + "PageHut" yazısı).
   - Logotipteki yazıyı Bricolage Grotesque ile kur. Yazıyı path'e dönüştürmen gerekmiyor:
     `font-family` ile bırakabilirsin, ama harf aralığını ve ağırlığını belirt.
8. **HANDOFF bloğu:** En sonda, tek bir ```json kod bloğu ver. Bu bloğu olduğu gibi geliştiriciye
   yapıştıracağım. Şema:

```json
{
  "direction": { "name": "", "summary": "", "principles": ["", "", ""] },
  "fonts": {
    "ui": "Bricolage Grotesque",
    "document": "",
    "mono": "JetBrains Mono",
    "googleFontsAxes": ""
  },
  "colors": {
    "light": { "--bg": "#", "--canvas": "#", "...": "her token" },
    "dark": { "--bg": "#", "--canvas": "#", "...": "her token" }
  },
  "contrast": [{ "pair": "--fg on --canvas", "light": 0, "dark": 0 }],
  "callouts": { "info": { "light": { "bg": "#", "icon": "#" }, "dark": { "bg": "#", "icon": "#" } } },
  "typography": {
    "pageTitle": { "size": "", "lineHeight": "", "weight": 0, "tracking": "", "opsz": 0, "wdth": 0 },
    "h1": {}, "h2": {}, "h3": {}, "body": {}, "small": {}, "label": {}
  },
  "radius": { "sm": "", "md": "", "lg": "", "xl": "" },
  "shadow": { "float": "", "card": "" },
  "glass": { "blur": "", "lightBg": "", "darkBg": "", "border": "" },
  "motion": { "fast": "", "base": "", "easing": "" },
  "logo": {
    "iconSvg": "<svg ...>",
    "iconMonoSvg": "<svg ...>",
    "wordmarkSvg": "<svg ...>",
    "rationale": ""
  },
  "notes": ["geliştiriciye özel uyarılar"]
}
```

Kurallar:
- HANDOFF'taki her renk, yukarıda verdiğin kontrast gereksinimlerini karşılamalı.
- SVG'ler geçerli, kendi başına çalışan ve harici dosyaya bağlı olmayan kod olmalı.
- Emin olmadığın bir değer varsa uydurma; `notes` içinde belirt.
