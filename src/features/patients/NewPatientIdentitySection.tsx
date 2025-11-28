// src/features/patients/NewPatientIdentitySection.tsx
// Identity and contact details subsection for the "Yeni Hasta" form.

type NewPatientIdentitySectionProps = {
  nationalId: string;
  kinPhone: string;
  address: string;
  onChangeNationalId: (value: string) => void;
  onChangeKinPhone: (value: string) => void;
  onChangeAddress: (value: string) => void;
};

export function NewPatientIdentitySection({
  nationalId,
  kinPhone,
  address,
  onChangeNationalId,
  onChangeKinPhone,
  onChangeAddress,
}: NewPatientIdentitySectionProps) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="mb-2 text-xs font-semibold text-slate-600">
        Özlük Bilgileri
      </p>

      <div className="grid gap-2 md:grid-cols-3">
        {/* National ID */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">
            T.C. Kimlik No (opsiyonel)
          </label>
          <input
            type="text"
            value={nationalId}
            onChange={(e) => onChangeNationalId(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="11 haneli T.C. no"
          />
        </div>

        {/* Kin phone */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">
            Yakın Telefonu (opsiyonel)
          </label>
          <input
            type="tel"
            value={kinPhone}
            onChange={(e) => onChangeKinPhone(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Acil durumda aranacak kişi"
          />
        </div>

        {/* Address (small textarea) */}
        <div className="md:col-span-1 md:row-span-2">
          <label className="mb-1 block text-[11px] font-medium text-slate-600">
            Adres (opsiyonel)
          </label>
          <textarea
            value={address}
            onChange={(e) => onChangeAddress(e.target.value)}
            rows={3}
            className="h-full min-h-[72px] w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Kısa adres bilgisi"
          />
        </div>
      </div>

      <p className="mt-1 text-[11px] text-slate-500">
        Bu bilgiler hasta detayında &quot;Özlük Bilgileri&quot; bölümünde
        görüntülenir. Doldurmak zorunlu değildir; gerektiğinde daha
        sonra da güncellenebilir.
      </p>
    </div>
  );
}
