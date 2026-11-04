import type { TemplateSet } from "./types";

export const tr: TemplateSet = {
  "one-page-gdd": {
    title: "Tek sayfalık GDD",
    description: "Oyunun tamamı tek sayfada: tanıtım, tasarım ilkeleri, çekirdek döngü, kapsam.",
    markdown: `:::callout idea
Bu sayfayı iki dakikada okunacak kadar kısa tut. Ayrıntılar büyüdükçe ayrı sayfalara bağla.
:::

## Tanıtım (pitch)

*Tek cümle: oyuncu kimi oynuyor, ne yapıyor, neden eğlenceli?*

## Tasarım ilkeleri (design pillars)

1. **Birinci ilke:** her özelliğin desteklemesi gereken şey
2. **İkinci ilke:**
3. **Üçüncü ilke:**

## Çekirdek döngü (core loop)

1. Keşfet
2. Topla
3. Geliştir
4. Yeni bir zorlukla tekrarla

## Oyuncu ve platform

| | |
| --- | --- |
| Tür | |
| Platform | |
| Hedef oyuncu | |
| Oturum süresi | |
| Benzer oyunlar | |

## Temel özellikler

- [ ] Birinci özellik
- [ ] İkinci özellik
- [ ] Üçüncü özellik

## Kapsam ve riskler

:::callout warning
En büyük risk: *bu oyunun tamamlanmasını ne engelleyebilir?*
:::
`,
  },
  "full-gdd": {
    title: "Oyun Tasarım Dokümanı",
    description: "Eksiksiz GDD yapısı: vizyon, oynanış, dünya, içerik, üretim.",
    markdown: `## 1. Vizyon

### Yüksek konsept (high concept)

### Tasarım ilkeleri

1.
2.
3.

### Hedef kitle ve platformlar

## 2. Oynanış

### Çekirdek döngü

### Kontroller

| Eylem | Klavye / fare | Oyun kolu |
| --- | --- | --- |
| Hareket | WASD | Sol analog |
| Etkileşim | E | A |

### Mekanikler

*Sistemleri listele; karmaşık olanların her biri için ayrı bir Mekanik tanımı sayfası aç.*

### İlerleme (progression)

### Başarısızlık ve zorluk

## 3. Dünya ve hikâye

### Mekân ve dönem

### Ana karakterler

### Anlatı yapısı

## 4. İçerik

### Bölümler

### Düşmanlar ve engeller

### Eşyalar

## 5. Görsel ve ses

### Görsel stil

### Ses yönelimi

## 6. Kullanıcı arayüzü

### HUD

### Menüler

## 7. Üretim

### Kilometre taşları

| Kilometre taşı | Tarih | Hedef |
| --- | --- | --- |
| Prototip | | Çekirdek döngü oynanabilir |
| Dikey kesit | | Cilalı tek bir bölüm |
| Alfa | | Tüm özellikler oyunda |
| Beta | | İçerik tamamlandı |

### Ekip ve roller

:::toggle Açık sorular
- Birinci soru
:::
`,
  },
  "vertical-slice": {
    title: "Dikey kesit planı",
    description: "Oyunun cilalı ve temsil edici küçük bir parçasının kapsamı.",
    markdown: `:::callout idea
Dikey kesit (vertical slice), son kalite çıtasını oyunun küçük bir parçasında kanıtlar: tek bölüm, her katmanı bitmiş.
:::

## Amaç

*Bu kesit hangi soruyu yanıtlıyor? (ör. "Gizlilik oynanışı tam kalitede eğlenceli mi?")*

## Kapsamda olanlar

- [ ] Bölüm / alan:
- [ ] Mekanikler:
- [ ] Düşmanlar:
- [ ] Arayüz ekranları:
- [ ] Ses:

## Kapsam dışı

-

## Kalite çıtası

| Katman | Hedef |
| --- | --- |
| Oynanış | Son his, ayarları yapılmış |
| Görsel | Son hâli ya da ona çok yakın |
| Ses | Son efektler, geçici müzik olabilir |
| Arayüz | Son yerleşim |

## Başarı ölçütleri

1. Test oyuncuları kesiti yardım almadan bitiriyor
2.
3.

## Takvim ve sorumlular

| Görev | Sorumlu | Teslim |
| --- | --- | --- |
| | | |

:::callout warning
Kesilecekler listesi: kesit gecikirse ilk neyi çıkaracaksınız?
:::
`,
  },
  "pitch-deck": {
    title: "Sunum (pitch deck) taslağı",
    description: "Yayıncıya, jüriye ya da sınıfa sunum için slayt slayt taslak.",
    markdown: `## Slayt 1: Başlık

Oyunun adı, tek cümlelik kanca, ana görsel.

## Slayt 2: Kanca

*Oyuncular neden önemsesin? Tek cümle ve tek görsel.*

## Slayt 3: Oynanış

Üç adımda çekirdek döngü, bir GIF ya da kısa video.

## Slayt 4: Tasarım ilkeleri

1.
2.
3.

## Slayt 5: Hedef kitle ve pazar

| | |
| --- | --- |
| Hedef oyuncu | |
| Benzer oyunlar | |
| Platformlar | |
| Fiyat | |

## Slayt 6: Farkımız ne?

## Slayt 7: Ekip

## Slayt 8: Durum ve yol haritası

- [ ] Prototip
- [ ] Dikey kesit
- [ ] Çıkış

## Slayt 9: Talebimiz

*Neye ihtiyacınız var: yatırım, yayıncı, geri bildirim, not?*

:::callout idea
Sunumu beş dakikanın altında prova edin. Her slayt beş saniyede okunabilmeli.
:::
`,
  },
  "level-design": {
    title: "Bölüm tasarım dokümanı",
    description: "Tek bir bölümün yerleşimi, akışı, karşılaşmaları ve ölçüleri.",
    markdown: `## Genel bakış

| | |
| --- | --- |
| Bölüm | |
| Oyundaki yeri | ör. 10 bölümden 3. |
| Oynanma süresi | |
| Öğretilen yeni mekanik | |
| Atmosfer | |

## Bölümün amacı

*Oyuncu burada ne öğreniyor, ne hissediyor, neyi başarıyor?*

## Akış ve ritim

1. **Giriş:** güvenli alan, yeni fikrin tanıtımı
2. **Pratik:** mekaniği düşük riskle kullanma
3. **Kırılma:** mekaniğin bilinen bir şeyle birleşmesi
4. **Doruk:**
5. **Ödül ve çıkış:**

## Harita

![Harita taslağı](assets/level-map.png)

## Karşılaşmalar

| # | Konum | Düşmanlar | Amaç |
| --- | --- | --- | --- |
| 1 | | | |

## Ölçüler (metrics)

| Ölçü | Değer |
| --- | --- |
| Zıplama yüksekliği | |
| Koridor genişliği | |
| Siper aralığı | |

## Gizli alanlar ve isteğe bağlı yollar

:::callout warning
Kayıt noktaları: oyuncunun nerede yeniden doğduğunu işaretle; hiçbir bölüm 2 dakikadan uzun tekrar oynatmamalı.
:::
`,
  },
  "mechanic-spec": {
    title: "Mekanik tanımı",
    description: "Tek bir mekaniğin kuralları, girdileri, uç durumları ve ayar değerleri.",
    markdown: `## Özet

*Tek cümle: oyuncu ne yapıyor ve neden?*

## Hizmet ettiği tasarım ilkesi

## Kurallar

1.
2.
3.

## Girdiler ve geri bildirim

| Girdi | Sonuç | Geri bildirim (görsel / ses / titreşim) |
| --- | --- | --- |
| | | |

## Durumlar

\`\`\`
Bekleme -> Şarj -> Bırakma -> Bekleme süresi -> Bekleme
\`\`\`

## Ayar değerleri

| Parametre | Değer | Not |
| --- | --- | --- |
| Bekleme süresi (cooldown) | 1,5 sn | |
| Hasar | 10 | |

## Uç durumlar

- Oyuncu havadaysa ne olur?
- İki oyuncu aynı anda tetiklerse ne olur?

## Diğer sistemlerle etkileşim

## Açık sorular

- [ ]
`,
  },
  "economy-balance": {
    title: "Ekonomi ve denge tablosu",
    description: "Para birimleri, kaynaklar ve harcama noktaları, fiyatlar, ilerleme eğrileri.",
    markdown: `## Para birimleri

| Birim | Nasıl kazanılır | Nereye harcanır | Üst sınır |
| --- | --- | --- | --- |
| Altın | Düşmanlar, sandıklar | Dükkân, geliştirmeler | |

## Kaynaklar ve harcama noktaları (sources & sinks)

:::callout idea
Her kaynağın bir harcama noktası olmalı. Oyuncu sadece kazanırsa enflasyon tüm kararları anlamsızlaştırır.
:::

## İlerleme eğrisi

Seviye başına gereken deneyim: \`xp(seviye) = 100 * 1.15 ^ (seviye - 1)\`

| Seviye | Sonrakine XP | Açılanlar |
| --- | --- | --- |
| 1 | 100 | |
| 2 | 115 | |
| 3 | 132 | |

## Fiyatlar

| Eşya | Fiyat | Alabilmek için süre |
| --- | --- | --- |
| | | |

## Hasar ve can

| Birim | Can | Hasar | Oyuncuyu kaç vuruşta öldürür |
| --- | --- | --- | --- |
| | | | |

:::callout warning
Hedefi yazın: "Yeni bir oyuncu ilk geliştirmesini yaklaşık 10 dakikada almalı."
:::
`,
  },
  "ui-ux-flow": {
    title: "Arayüz / kullanıcı deneyimi akışı",
    description: "Ekranlar, gezinme, HUD ve erişilebilirlik gereksinimleri.",
    markdown: `## Ekran listesi

| Ekran | Amaç | Nereden açılır |
| --- | --- | --- |
| Başlık | | Açılış |
| Ana menü | | Başlık |
| Ayarlar | | Ana menü, duraklatma |
| HUD | | Oynanış |
| Duraklatma | | Oynanış |

## Gezinme akışı

\`\`\`
Açılış -> Başlık -> Ana menü -> Oynanış <-> Duraklatma -> Ayarlar
\`\`\`

## HUD

*Oyuncu neyi her zaman görmeli? Ne yalnızca gerektiğinde görünmeli?*

- Can
- Görev
-

## Girdi

- [ ] Oyun koluyla tamamen oynanabilir
- [ ] Yalnızca klavyeyle tamamen oynanabilir
- [ ] Tuşlar yeniden atanabilir

## Erişilebilirlik

- [ ] Boyut ve arka plan seçenekli altyazılar
- [ ] Renk körlüğüne uygun palet (bilgi asla yalnızca renkle verilmez)
- [ ] Metin ölçekleme
- [ ] Hareketi / ekran sarsıntısını azaltma seçeneği
- [ ] Basılı tutma yerine alternatifler

## Tel kafes çizimler (wireframe)

![Tel kafes](assets/wireframe.png)
`,
  },
  "narrative-bible": {
    title: "Anlatı / hikâye kitabı",
    description: "Dünya, evren bilgisi (lore), hikâye yapısı, karakterler ve ton.",
    markdown: `## Öncül

*Tek paragraf: dünya, çatışma, kahramanın amacı.*

## Tema ve ton

## Dünya

### Tarih

### Mekânlar

### Gruplar (factions)

| Grup | Amacı | Oyuncuyla ilişkisi |
| --- | --- | --- |
| | | |

## Hikâye yapısı

| Perde | Olaylar | Oynanışla bağı |
| --- | --- | --- |
| I. Kurulum | | |
| II. Çatışma | | |
| III. Çözüm | | |

## Karakterler

*Her ana karakter için bir Karakter kartı açıp buraya bağla.*

## Anlatım yolları

- [ ] Ara sahneler
- [ ] Oyun içi diyaloglar
- [ ] Çevresel anlatım
- [ ] Toplanabilir lore parçaları

## Kanon kuralları

:::callout warning
Bu dünyada her zaman doğru olan şeyler. Yeni içeriği bunlara göre kontrol edin.
:::

1.
`,
  },
  "character-sheet": {
    title: "Karakter kartı",
    description: "Bir karakterin rolü, kişiliği, yetenekleri, görünüşü ve sesi.",
    markdown: `![Konsept çizimi](assets/character.png)

## Temel bilgiler

| | |
| --- | --- |
| Ad | |
| Rol | Ana karakter / müttefik / düşman / NPC |
| Yaş | |
| İlk göründüğü yer | |

## Kişilik

*Üç sıfat, ardından ne istediği ve neden korktuğu üzerine tek cümle.*

## Geçmiş

## Yetenekler ve değerler

| Değer | Miktar |
| --- | --- |
| Can | |
| Hız | |
| Özel yetenek | |

## İlişkiler

| Karakter | İlişki |
| --- | --- |
| | |

## Görünüş ve ses

- Siluet:
- Renk paleti:
- Ses / konuşma tarzı:

## Gelişim (karakter arkı)

*Başından sonuna nasıl değişiyor?*
`,
  },
  "art-bible": {
    title: "Sanat kitabı (art bible)",
    description: "Görsel stil, renk paletleri, referanslar ve varlık kuralları.",
    markdown: `## Görsel ilkeler

1.
2.
3.

## İlham panosu (mood board)

![Referans](assets/reference-1.png)

## Renk

| Kullanım | Renkler | Not |
| --- | --- | --- |
| Oyuncu | | Her arka plandan ayrışmalı |
| Düşmanlar | | |
| Etkileşimli nesneler | | |

## Şekiller ve siluetler

*Dost = yuvarlak, tehlike = sivri mi? Şekil dilinizi tanımlayın.*

## Işık ve kamera

## Karakterler

## Ortamlar

## Arayüz stili

## Varlık (asset) kuralları

| Varlık | Format | Boyut / poligon bütçesi | Adlandırma |
| --- | --- | --- | --- |
| Dokular | PNG | en fazla 2048² | T_Ad_Tür |
| Karakterler | FBX | | SK_Ad |

:::callout warning
1 MB'tan büyük dosyaları bu çalışma alanına koymayın; sanat deposuna ya da sürücüye bağlantı verin.
:::
`,
  },
  "technical-design": {
    title: "Teknik tasarım dokümanı",
    description: "Motor, mimari, sistemler, araçlar ve teknik riskler.",
    markdown: `## Platform ve motor

| | |
| --- | --- |
| Oyun motoru | |
| Programlama dili | |
| Hedef platformlar | |
| En düşük sistem gereksinimi | |
| Hedef kare hızı | |

## Mimariye genel bakış

\`\`\`
Girdi -> Oyun durumu -> Sistemler (yapay zekâ, fizik, dövüş) -> Görüntü / ses
\`\`\`

## Sistemler

| Sistem | Sorumlu | Durum | Not |
| --- | --- | --- | --- |
| Kayıt / yükleme | | | |
| Yapay zekâ | | | |

## Veri ve içerik hattı (pipeline)

## Araçlar

## Performans bütçeleri

| Bütçe | Hedef |
| --- | --- |
| Kare süresi | 16,6 ms |
| Bellek | |
| Yükleme süresi | |

## Teknik riskler

- [ ] Risk:
  - Önlem:

## Kod standartları ve sürüm kontrolü

:::callout idea
Dal adlarını, kod inceleme kurallarını ve derlemenin nasıl alındığını yazın; yeni katılan ilk gün işe başlayabilsin.
:::
`,
  },
  "playtest-report": {
    title: "Oyun testi raporu",
    description: "Oturum bilgileri, gözlemler, bulgular ve yapılacaklar.",
    markdown: `## Oturum

| | |
| --- | --- |
| Tarih | |
| Sürüm (build) | |
| Test oyuncuları | |
| Yürüten | |
| Süre | |

## Amaçlar

*Ne öğrenmek istedik?*

1.

## Gözlemler

| Zaman | Ne oldu | Önem |
| --- | --- | --- |
| | | Düşük / Orta / Yüksek |

## Alıntılar

> "…"

## Bulgular

:::callout warning
Bulguları çözüm olarak değil sorun olarak yazın: "ok ekle" değil, "oyuncular çıkışı görmüyor".
:::

1.

## Yapılacaklar

- [ ] İş, sorumlu, teslim tarihi

## Ölçümler

| Ölçüm | Sonuç |
| --- | --- |
| Tamamlama oranı | |
| Ortalama süre | |
| Bölüm başına ölüm | |
`,
  },
  "post-mortem": {
    title: "Proje değerlendirmesi (post-mortem)",
    description: "Neler iyi gitti, neler kötü gitti, bir dahakine neyi değiştireceğiz.",
    markdown: `## Proje özeti

| | |
| --- | --- |
| Proje | |
| Süre | |
| Ekip büyüklüğü | |
| Sonuç | |

## Hedefler ve sonuçlar

| Hedef | Sonuç |
| --- | --- |
| | |

## İyi gidenler

1.
2.
3.

## Kötü gidenler

1.
2.
3.

## Kapsam

*Neyi, ne zaman kestik ve doğru karar mıydı?*

## Süreç ve iletişim

## Bir dahaki sefere

- [ ]
- [ ]

:::callout idea
Suçlamadan yazın: kişileri değil, kararları ve o anki koşulları anlatın.
:::
`,
  },
};
