// src/features/patients/NewPatientSgkSection.tsx
// SGK block used in the NewPatientFormCard: flag + checkboxes +
// SGK profile dropdown + expected reimbursement + month selector.

import { SGK_PROFILES } from './sgkProfiles';

type NewPatientSgkSectionProps = {
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  sgkProfileId: string;
  sgkExpectedReimbursement: string;
  sgkExpectedMonth: string;
  onChangeSgkFlag: (value: boolean) => void;
  onChangeSgkPrescriptionReceived: (value: boolean) => void;
  onChangeSgkRecordedToSystem: (value: boolean) => void;
  onChangeSgkProfileId: (value: string) => void;
  onChangeSgkExpectedReimbursement: (value: string) => void;
  onChangeSgkExpectedMonth: (value: string) => void; // "yyyy-MM"
};

export function NewPatientSgkSection({
  sgkFlag,
  sgkPrescriptionReceived,
  sgkRecordedToSystem,
  sgkProfileId,
  sgkExpectedReimbursement,
  sgkExpectedMonth,
  onChangeSgkFlag,
  onChangeSgkPrescriptionReceived,
  onChangeSgkRecordedToSystem,
  onChangeSgkProfileId,
  onChangeSgkExpectedReimbursement,
  onChangeSgkExpectedMonth,
}: NewPatientSgkSectionProps) {
  const handleToggleSgkFlag = (checked: boolean) => {
    onChangeSgkFlag(checked);
    if (!checked) {
      // When SGK is turned off, derived flags and profile fields must be reset.
      onChangeSgkPrescriptionReceived(false);
      onChangeSgkRecordedToSystem(false);
      onChangeSgkProfileId('');
      onChangeSgkExpectedReimbursement('');
      onChangeSgkExpectedMonth('');
    }
  };

  const handleChangeProfile = (value: string) => {
    onChangeSgkProfileId(value);

    const profile = SGK_PROFILES.find((p) => p.id === value);
    if (profile) {
      // 3. sütun: firmaya SGK tarafından ödenecek net tutar.
      // UI'da TL string olarak tutuyoruz; virgül veya nokta serbest kalabilir.
      const asString = profile.netToFirm.toString().replace('.', ',');
      onChangeSgkExpectedReimbursement(asString);

      // Eğer henüz ay seçilmemişse, default olarak içinde bulunulan ayı ata.
      if (!sgkExpectedMonth) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        onChangeSgkExpectedMonth(`${yyyy}-${mm}`); // type="month" formatı
      }
    } else {
      onChangeSgkExpectedReimbursement('');
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          id="sgk-flag"
          type="checkbox"
          checked={sgkFlag}
          onChange={(e) => handleToggleSgkFlag(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <label
          htmlFor="sgk-flag"
          className="select-none text-xs font-medium text-slate-700"
        >
          SGK hastası
        </label>
      </div>

      <div className="flex flex-col gap-1 pl-5 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!sgkFlag}
            checked={sgkPrescriptionReceived}
            onChange={(e) =>
              onChangeSgkPrescriptionReceived(e.target.checked)
            }
            className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
          />
          <span>Reçete geldi mi?</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!sgkFlag}
            checked={sgkRecordedToSystem}
            onChange={(e) =>
              onChangeSgkRecordedToSystem(e.target.checked)
            }
            className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
          />
          <span>Sisteme işlendi mi?</span>
        </label>
      </div>

      {/* SGK profil seçimi + beklenen ödeme */}
      <div className="mt-2 flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-700">SGK Profili</span>
          <select
            disabled={!sgkFlag}
            value={sgkProfileId}
            onChange={(e) => handleChangeProfile(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">Profil seçin...</option>
            {SGK_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-700">
            Beklenen SGK Ödemesi (net)
          </span>
          <input
            type="text"
            disabled={!sgkFlag}
            value={sgkExpectedReimbursement}
            onChange={(e) =>
              onChangeSgkExpectedReimbursement(e.target.value)
            }
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
            placeholder="Örn. 6104,45"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-700">
            Beklenen Ödeme Ayı (SGK)
          </span>
          <input
            type="month"
            disabled={!sgkFlag}
            value={sgkExpectedMonth}
            onChange={(e) => onChangeSgkExpectedMonth(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>
      </div>
    </div>
  );
}
