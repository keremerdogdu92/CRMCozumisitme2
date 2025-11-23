## 2) `docs/mobile/MOBILE_PATTERNS.md`

```markdown
# Mobile UI Patterns

Bu doküman; projede tekrar tekrar kullanılacak mobil pattern’leri içerir.  
Amaç: Yeni ekran yazarken hazır bir “kopyala-yapıştır” başlangıç noktası sunmak.

---

## 1. Mobile Form Card Pattern

Çoğu sayfada kullanılan “üstte form, altta liste” yapısına uygun kart.

```tsx
// FormCard.tsx (örnek pattern)
export function FormCard({ title, description, children, onSubmit, isSubmitting }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">
        {title}
      </h2>
      {description && (
        <p className="mb-4 text-xs text-slate-500">
          {description}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        {children}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}
Kullanım:

Meetings, Patients, Trials gibi formlarda bu pattern referans alınabilir.

Mobilde tek sütun, sm: ile iki sütun alanlar için grid gap-3 sm:grid-cols-2 kullanılır.

2. Mobile Table Pattern
Liste ekranlarında kullanılacak standart tablo kabı.

tsx
Kodu kopyala
// MobileTableWrapper.tsx (örnek pattern)
export function MobileTableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-xs">
        {children}
      </table>
    </div>
  );
}
Kullanım örneği (Meetings tablosu):

tsx
Kodu kopyala
<MobileTableWrapper>
  <thead className="bg-slate-50 text-slate-600">
    <tr>
      <th className="px-3 py-2 font-medium">Tarih</th>
      <th className="px-3 py-2 font-medium">Tip</th>
      <th className="px-3 py-2 font-medium">Kişi</th>
      <th className="px-3 py-2 font-medium">Başlık</th>
      <th className="px-3 py-2 font-medium">Sonraki Tarih</th>
      <th className="px-3 py-2 font-medium">Memnuniyet</th>
      <th className="px-3 py-2 font-medium">Not</th>
    </tr>
  </thead>
  <tbody>
    {rows.map((row) => (
      <tr key={row.id} className="border-t border-slate-100">
        {/* hücreler */}
      </tr>
    ))}
  </tbody>
</MobileTableWrapper>
3. Filter Bar Pattern
Üstte toplam bilgi, sağda filtre butonları olan bar.

tsx
Kodu kopyala
function FilterBar() {
  const [filter, setFilter] = useState<'all' | 'patient' | 'trial' | 'reference'>('all');

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-slate-500">
        Toplam <span className="font-semibold">42</span> kayıt var.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: 'Tümü', value: 'all' },
          { label: 'Hastalar', value: 'patient' },
          { label: 'Deneme', value: 'trial' },
          { label: 'Referans', value: 'reference' },
        ].map((opt) => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value as any)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                active
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
Özellikler:

flex-wrap sayesinde telefonda ikinci satıra rahatlıkla iner.

Sağdaki buton grubu gerektiğinde iki satır olabilir.

4. Search + Dropdown Pattern (Meetings Subject Picker)
Meetings formunda kullandığımız “isimle ara + dropdown” pattern’i mobile-friendly bir arama seçicisidir.

Özet pattern:

tsx
Kodu kopyala
type Option = { id: string; name: string };

function SearchDropdown({
  value,
  onSelect,
  fetchOptions,
  placeholder,
}: {
  value: string;
  onSelect: (id: string, name: string) => void;
  fetchOptions: (query: string) => Promise<Option[]>;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState(value ?? '');
  const [touched, setTouched] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { data: options = [], isFetching } = useQuery<Option[]>({
    queryKey: ['search-dropdown', inputValue],
    enabled: inputValue.trim().length >= 2,
    queryFn: async () => {
      const q = inputValue.trim();
      if (!q) return [];
      return fetchOptions(q);
    },
  });

  useEffect(() => {
    if (!touched) {
      setInputValue(value ?? '');
    }
  }, [value, touched]);

  const showDropdown =
    isOpen && inputValue.trim().length >= 2 && options.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        value={inputValue}
        onChange={(e) => {
          setTouched(true);
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 120);
        }}
        placeholder={placeholder ?? 'İsimle ara (en az 2 harf)...'}
      />
      <p className="mt-1 text-[11px] text-slate-500">
        {isFetching ? 'Kişiler aranıyor...' : 'Sonuçlardan birini seçin.'}
      </p>

      {showDropdown && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white text-xs shadow-lg">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="cursor-pointer px-2 py-1 hover:bg-slate-100"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(opt.id, opt.name);
                setInputValue(opt.name);
                setTouched(false);
                setIsOpen(false);
              }}
            >
              {opt.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
Bu pattern:

Mobilde tek input alanı gibi çalışır.

Listeler dar ekranda da okunabilir.

max-h-48 ile liste boyu kontrollü.

5. Mobile Drawer Pattern
Hasta detay çekmecesi gibi yan panellerde temel pattern:

tsx
Kodu kopyala
// İçerik iskeleti (SideDrawer kullanılarak)
<SideDrawer
  open={open}
  onClose={onClose}
  title="Hasta Detayı"
  subtitle={patient.full_name}
  footer={footer}
>
  {/* Tab bar */}
  <div className="border-b border-slate-200 pb-2">
    <div className="flex flex-wrap gap-1">
      {/* Tab buttons */}
    </div>
  </div>

  {/* Content */}
  <div className="mt-4 space-y-4 text-sm">
    {/* sections */}
  </div>
</SideDrawer>
Bölüm pattern’i:

tsx
Kodu kopyala
<section className="space-y-2">
  <h4 className="text-xs font-semibold uppercase text-slate-500">
    Özlük Bilgileri
  </h4>
  <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
    {/* rows */}
  </div>
</section>
Bu dosyadaki pattern’ler; yeni ekran ve komponentlerin mobilde tutarlı davranması için başlangıç şablonu olarak kullanılmalıdır.

yaml
Kodu kopyala
