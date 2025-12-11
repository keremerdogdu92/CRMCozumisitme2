// src/features/patients/components/new/NewPatientSgkSection.tsx
// SGK block used in the NewPatientFormCard: flag + checkboxes +
// optional prescription number + SGK profile dropdown +
// expected reimbursement (locked) + month (locked).
//
// Behaviour:
// - Only the top "SGK hastası" row is always visible.
// - When sgkFlag === true, the full SGK flow is shown.
// - When sgkFlag === false, all inner fields are hidden and reset.
//
// v2.6:
// - Supports deviceMultiplier (1 or 2) to show SGK reimbursement for bilateral / 2 devices.

import { SGK_PROFILES } from '../../sgkProfiles';

type NewPatientSgkSectionProps = {
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  sgkProfileId: string;
  sgkExpectedReimbursement: string;
  sgkExpectedMonth: string;
  sgkPrescriptionNo: string;

  /**
   * Multiplier for SGK reimbursement display:
   * - 1: single device
   * - 2: bilateral / two devices
   *
   * Optional to keep backward compatibility with older callers.
   */
  deviceMultiplier?: 1 | 2;

  onChangeSgkFlag: (value: boolean) => void;
  onChangeSgkPrescriptionReceived: (value: boolean) => void;
  onChangeSgkRecordedToSystem: (value: boolean) => void;
  onChangeSgkProfileId: (value: string) => void;
  onChangeSgkExpectedReimbursement: (value: string) => void;
  onChangeSgkExpectedMonth: (value: string) => void; // "yyyy-MM"
  onChangeSgkPrescriptionNo: (value: string) => void;
};

type SgkProfile = {
  id: string;
  label: string;
  netToFirm: number;
};

// Money helpers (TR format support).
function parseMoneyLikeToNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function formatMoneyLikeTR(value: number): string {
  // Keep it compatible with your existing UI style: comma decimal, no currency symbol.
  // Use 2 decimals only when needed.
  const fixed = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return fixed.replace('.', ',');
}

function multiplyMoneyLikeString(
  amount: string,
  multiplier: number,
): string {
  const n = parseMoneyLikeToNumber(amount);
  if (n == null) return amount; // fallback: show raw
  const out = Number((n * multiplier).toFixed(2));
  return formatMoneyLikeTR(out);
}

export function NewPatientSgkSection({
  sgkFlag,
  sgkPrescriptionReceived,
  sgkRecordedToSystem,
  sgkProfileId,
  sgkExpectedReimbursement,
  sgkExpectedMonth,
  sgkPrescriptionNo,
  deviceMultiplier = 1,
  onChangeSgkFlag,
  onChangeSgkPrescriptionReceived,
  onChangeSgkRecordedToSystem,
  onChangeSgkProfileId,
  onChangeSgkExpectedReimbursement,
  onChangeSgkExpectedMonth,
  onChangeSgkPrescriptionNo,
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
      onChangeSgkPrescriptionNo('');
    }
  };

  const handleChangeProfile = (value: string) => {
    onChangeSgkProfileId(value);

    const profile = (SGK_PROFILES as SgkProfile[]).find(
      (p: SgkProfile) => p.id === value,
    );
    if (profile) {
      // 3rd column: net amount that SGK is expected to pay to the firm.
      // Store base single-device value in state; display may be multiplied.
      const asString = profile.netToFirm.toString().replace('.', ',');
      onChangeSgkExpectedReimbursement(asString);

      // Default expected month = 3 months after "now".
      const base = new Date();
      base.setMonth(base.getMonth() + 3);
      const yyyy = base.getFullYear();
      const mm = String(base.getMonth() + 1).padStart(2, '0');
      onChangeSgkExpectedMonth(`${yyyy}-${mm}`); // type="month" format (yyyy-MM)
    } else {
      onChangeSgkExpectedReimbursement('');
      onChangeSgkExpectedMonth('');
    }
  };

  const displayedReimbursement =
    deviceMultiplier === 2
      ? multiplyMoneyLikeString(sgkExpectedReimbursement, 2)
      : sgkExpectedReimbursement;

  return (
    <div className="flex h-full flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      {/* Top row: SGK flag */}
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

      {/* Details are only visible when SGK is enabled */}
      {sgkFlag && (
        <>
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

            {/* Prescription number */}
            <label className="mt-1 flex flex-col gap-1">
              <span className="text-xs text-slate-700">
                SGK Reçete No (opsiyonel)
              </span>
              <input
                type="text"
                disabled={!sgkFlag}
                value={sgkPrescriptionNo}
                onChange={(e) => onChangeSgkPrescriptionNo(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Reçete numarası"
              />
            </label>
          </div>

          {/* SGK profil seçimi + beklenen ödeme (kilitli) */}
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
                {(SGK_PROFILES as SgkProfile[]).map((p: SgkProfile) => (
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
                readOnly
                value={displayedReimbursement}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Profil seçince otomatik hesaplanır"
              />
              {deviceMultiplier === 2 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Çift/2 cihaz seçildiği için SGK tutarı x2 gösteriliyor.
                </p>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-700">
                Beklenen Ödeme Ayı (SGK)
              </span>
              <input
                type="month"
                disabled={!sgkFlag}
                readOnly
                value={sgkExpectedMonth}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <p className="mt-1 text-[11px] text-slate-500">
              Profil seçildiğinde beklenen ödeme tutarı ve ayı sistem
              tarafından otomatik hesaplanır (yaklaşık 3 ay sonrası). Bu
              alanlar sonradan elle değiştirilmez.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
