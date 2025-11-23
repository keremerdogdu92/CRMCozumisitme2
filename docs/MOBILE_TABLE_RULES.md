4) docs/mobile/MOBILE_TABLE_RULES.md
# Mobile Table Rules

Bu doküman; tüm tablo / liste görünümleri için mobilde uyulması gereken ayrıntılı kuralları içerir.

---

## 1. Genel Kurallar

1. Her tablo:
   - `overflow-x-auto rounded-lg border border-slate-200 bg-white`
   - `<table className="min-w-full text-left text-xs">`
2. Header satırı:
   - `className="bg-slate-50 text-slate-600"`
3. Satırlar:
   - `className="border-t border-slate-100"`

---

## 2. Sütun Önceliklendirme

Her tablo için sütunlar önem derecesine göre sıralanmalı. Mobilde:

- Öncelik 1–3 sütun her zaman görünür.
- Daha düşük öncelikli sütunların metni kısaltılabilir / düzenlenebilir.

Örnek: **Meetings** tablosu sütun önceliği:

1. Tarih (`at`)
2. Kişi (`subject_name`)
3. Tip (`meeting_type`)
4. Başlık (`subject`)
5. Sonraki Tarih (`next_at`)
6. Memnuniyet (`satisfaction_10`)
7. Not (`note`)

---

## 3. Metin Kısaltma (Ellipsis)

Uzun metinler (özellikle `note`, açıklama alanları):

- Maksimum karakter: 80–120 arası.
- Kural:
  ```ts
  const text =
    note && note.length > 120 ? note.slice(0, 120) + '…' : note ?? '-';


UI içinde:

<td className="px-3 py-2 text-slate-600">
  {m.note ? m.note.slice(0, 120) : '-'}
  {m.note && m.note.length > 120 ? '…' : ''}
</td>

4. Tarih Formatı

Tüm tablo tarihleri:

new Date(value).toLocaleDateString('tr-TR')

Eğer tarih yoksa: '-'

Örnek helper:

export function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

5. Para Formatı

Para birimi: ₺

Format:

amount.toLocaleString('tr-TR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})


Tabloda kullanım:

<td className="px-3 py-2 text-slate-800">
  {p.amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}{' '}
  ₺
</td>

6. Responsive Davranış

Yatay Scroll

Tüm tablolar yatay scroll’u destekler (overflow-x-auto).

Sütun sayısı fazla olduğunda kullanıcı sağa kaydırarak bakabilir.

Dikey Boşluk

Hücre padding’i:

px-3 py-2 → mobil için yeterli; daha büyüğe çıkma.

İkon / Short Label Kullanımı

Çok alan kaplayan text yerine:

SGK durumu: “✓ / ✗” veya kısa badge.

Meeting type: “H”, “D”, “R” (görsel badge ile) ileride düşünülebilir.

7. Boş Durum ve Hata Durumu

Boş tablo:

Tablo yerine kısa metin:

<p className="text-xs text-slate-500">
  Henüz kayıt yok. Yukarıdan yeni bir kayıt ekleyebilirsiniz.
</p>


Hata durumunda:

<p className="text-xs text-red-600">
  Kayıtlar yüklenirken bir hata oluştu: {error.message}
</p>

8. Satır Aksiyonları (Gelecek İçin)

Eğer satır bazlı aksiyon butonları (Düzenle, Sil vb.) eklenecekse:

Masaüstü:

Son sütunda “Aksiyon” sütunu.

Mobil:

Tercihen:

Satırın alt satırında buton grubu (flex gap-1),
veya

Tek “⋮” menü butonu → tıklayınca menü açılır.

Kural: Mobilde aynı satıra 3+ küçük buton sıkıştırma.

Bu kurallar, tüm tablo/liste görünümleri için default davranış olarak kabul edilmelidir.


---
