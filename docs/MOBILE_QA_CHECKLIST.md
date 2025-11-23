# Mobile QA Checklist

Bu liste, yeni bir ekran veya büyük UI güncellemesi done sayılmadan önce mobil açıdan kontrol edilmesi gereken maddeleri içerir.

Her ekran için cevaplanması gereken soru:  
> “360px genişlikte, tek el ile kullanılabilir mi?”

---

## 1. Layout & Scroll

1. [ ] Chrome DevTools’ta **iPhone / küçük Android** profilinde test edildi mi?
2. [ ] Yatayda **zorunlu olmayan** hiçbir scroll yok mu?  
       (Sadece tablo wrapper’ları yatay scroll yapabilir.)
3. [ ] Dikey scroll doğal mı, sekmeler veya kartlar arasında kaybolma yok mu?

---

## 2. Formlar

4. [ ] Tüm input’lar `w-full` ve tek sütunda okunur halde mi?
5. [ ] Label, input ve helper text arası boşluklar yeterli mi? (`mb-1`, `space-y-3`)
6. [ ] Odak alınan input ekranın altına sıkışmıyor, klavye açılınca erişilebilir kalıyor mu?
7. [ ] Formdaki en önemli action (Kaydet) ekranda kolayca bulunabiliyor mu?

---

## 3. Tablolar & Listeler

8. [ ] Tablo bir wrapper içinde `overflow-x-auto` ile sarılı mı?
9. [ ] Sütun sayısı makul mü, en kritik 2–3 alan solda mı yer alıyor?
10. [ ] Çok uzun metinler (not, açıklama) 80–120 karakterde kesilip `…` ile gösteriliyor mu?
11. [ ] Boş durumda tablo yerine anlamlı bir mesaj gösteriliyor mu?

---

## 4. Drawer & Detay Ekranları

12. [ ] SideDrawer içindeki sekmeler `flex-wrap` ile dar ekranda taşmıyor mu?
13. [ ] Çok uzun içeriklerde dikey scroll düzgün çalışıyor mu?
14. [ ] Drawer footer’daki butonlara (Kapat, Kaydet) her zaman ulaşılabiliyor mu?

---

## 5. Butonlar & Filtreler

15. [ ] Filtre barları `flex-wrap` ile dar ekranda ikinci satıra geçebiliyor mu?
16. [ ] Hiçbir buton ekran dışına taşmıyor mu?  
17. [ ] Primary butonlar (Kaydet, Ekle vb.) görsel olarak yeterince belirgin mi?

---

## 6. Hata & Edge Durumları

18. [ ] Hata mesajları mobilde tek satır patlatmadan okunabilir şekilde (`text-xs`) mi?
19. [ ] İnternet yavaş veya geç yanıt verdiğinde, loading durumları (spinners / metin) doğru görünüyor mu?
20. [ ] Hatalı input’lar (örneğin geçersiz ödeme tutarı) net ve anlaşılır mesaj veriyor mu?

---

## 7. Performans & UX

21. [ ] Scroll, input yazma, tab değişimi gibi temel aksiyonlarda hissedilir bir lag yok mu?
22. [ ] Fazla büyük görsel / ikon kullanılmadığından mobil veri tüketimi makul mü?  
23. [ ] Aynı ekranı 2–3 kez açıp kapattığında UI bozulmadan stabil kalıyor mu?

---

Bu checklist, her büyük UI değişikliğinden sonra hızlıca üzerinden geçilecek **minimum test seti** olarak kullanılmalıdır.  
Tüm maddelerin “evet” olması, ekranın mobil kullanım için temel seviyede hazır olduğunu gösterir.
