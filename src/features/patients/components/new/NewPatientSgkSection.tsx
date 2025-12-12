// src/features/patients/components/new/NewPatientSgkSection.tsx
// SGK block used in the NewPatientFormCard: flag + checkboxes +
// optional prescription number + SGK profile dropdown +
// expected reimbursement (locked) + month (locked) + device count.
//
// Behaviour:
// - Only the top "SGK hastası" row is always visible.
// - When sgkFlag === true, the full SGK flow is shown.
// - When sgkFlag === false, all inner fields are hidden and reset.
//
// v2.8 (UI-first):
// - Adds sgkPillPrescription checkbox (always visible when SGK enabled).
// - Adds deviceFlowType control to hide/disable profile selection for "battery_only".
// - Adds pill reimbursement extra: 624 TL (KDV dahil) * sgkDeviceCount
//   when deviceFlowType is battery_device or battery_only and sgkPillPrescription is true.

import { SGK_PROFILES } from '../../sgkProfiles';

type DeviceFlowType = 'rechargeable_device' | 'battery_device' | 'battery_only';

type NewPatientSgkSectionProps = {
  deviceFlowType?: DeviceFlowType;

  /**
   * If true, adds extra pill reimbursement for battery flows:
   * 624 TL (KDV dahil) * sgkDeviceCount
   *
   * UI-first: not persisted in patient form state yet.
   */
  sgkPillPrescription?: boolean;
  onChangeSgkPillPrescription?: (value: boolean) => void;

  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  sgkProfileId: string;
  sgkExpectedReimbursement: string; // TOTAL (already multiplied)
  sgkExpectedMonth: string;
  sgkPrescriptionNo: string;

  /**
   * How many devices SGK is applied to for this patient.
   * IMPORTANT: This is NOT derived from device drafts.
   */
  sgkDeviceCount: '1' | '2';

  onChangeSgkFlag: (value: boolean) => void;
  onChangeSgkPrescriptionReceived: (value: boolean) => void;
  onChangeSgkRecordedToSystem: (value: boolean) => void;
  onChangeSgkProfileId: (value: string) => void;
  onChangeSgkExpectedReimbursement: (value: string) => void;
  onChangeSgkExpectedMonth: (value: string) => void; // "yyyy-MM"
  onChangeSgkPrescriptionNo: (value: string) => void;
  onChangeSgkDeviceCount: (value: '1' | '2') => void;
};

type SgkProfile = {
  id: string;
  label: string;
  netToFirm: number;
};

const PILL_EXTRA_REIMBURSEMENT_KDV_INCLUSIVE = 624;

// Money helpers (TR format support).
function formatMoneyLikeTR(value: number): string {
  const fixed = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return fixed.replace('.', ',');
}

function getMultiplier(count: '1' | '2'): number {
  return count === '2' ? 2 : 1;
}

function computeBaseFromProfile(profileId: string, count: '1' | '2'): number {
  if (!profileId) return 0;
  const profile = (SGK_PROFILES as SgkProfile[]).find((p) => p.id === profileId);
  if (!profile) return 0;
  return Number((profile.netToFirm * getMultiplier(count)).toFixed(2));
}

function computePillExtra(count: '1' | '2'): number {
  return Number((PILL_EXTRA_REIMBURSEMENT_KDV_INCLUSIVE * getMultiplier(count)).toFixed(2));
}

function computeExpectedMonth3MonthsAhead(): string {
  const base = new Date();
  base.setMonth(base.getMonth() + 3);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function NewPatientSgkSection({
  deviceFlowType = 'rechargeable_device',
  sgkPillPrescription = false,
  onChangeSgkPillPrescription,
  sgkFlag,
  sgkPrescriptionReceived,
  sgkRecordedToSystem,
  sgkProfileId,
  sgkExpectedReimbursement,
  sgkExpectedMonth,
  sgkPrescriptionNo,
  sgkDeviceCount,
  onChangeSgkFlag,
  onChangeSgkPrescriptionReceived,
  onChangeSgkRecordedToSystem,
  onChangeSgkProfileId,
  onChangeSgkExpectedReimbursement,
  onChangeSgkExpectedMonth,
  onChangeSgkPrescriptionNo,
  onChangeSgkDeviceCount,
}: NewPatientSgkSectionProps) {
  const isBatteryFlow = deviceFlowType === 'battery_device' || deviceFlowType === 'battery_only';
  const isProfileSelectable = deviceFlowType !== 'battery_only';

  const resetSgkDerivedFields = () => {
    onChangeSgkPrescriptionReceived(false);
    onChangeSgkRecordedToSystem(false);
    onChangeSgkProfileId('');
    onChangeSgkExpectedReimbursement('');
    onChangeSgkExpectedMonth('');
    onChangeSgkPrescriptionNo('');
    onChangeSgkDeviceCount('1');
    onChangeSgkPillPrescription?.(false);
  };

  const handleToggleSgkFlag = (checked: boolean) => {
    onChangeSgkFlag(checked);
    if (!checked) {
      // When SGK is turned off, derived flags and profile fields must be reset.
      resetSgkDerivedFields();
    }
  };

  const computeAndSetReimbursementAndMonth = (profileId: string, count: '1' | '2', pillRx: boolean) => {
    const base = isProfileSelectable ? computeBaseFromProfile(profileId, count) : 0;
    const pillExtra = isBatteryFlow && pillRx ? computePillExtra(count) : 0;

    const total = Number((base + pillExtra).toFixed(2));

    if (total <= 0) {
      onChangeSgkExpectedReimbursement('');
      // Keep month empty if nothing to collect
      onChangeSgkExpectedMonth('');
      return;
    }

    onChangeSgkExpectedReimbursement(formatMoneyLikeTR(total));

    // Default expected month = 3 months after "now".
    onChangeSgkExpectedMonth(computeExpectedMonth3MonthsAhead());
  };

  const handleChangeProfile = (value: string) => {
    onChangeSgkProfileId(value);

    // Even if profile is cleared, pill extra may still apply on battery flows.
    computeAndSetReimbursementAndMonth(value, sgkDeviceCount, sgkPillPrescription);
  };

  const handleChangeDeviceCount = (value: '1' | '2') => {
    onChangeSgkDeviceCount(value);
    computeAndSetReimbursementAndMonth(sgkProfileId, value, sgkPillPrescription);
  };

  const handleTogglePillPrescription = (checked: boolean) => {
    onChangeSgkPillPrescription?.(checked);
    computeAndSetReimbursementAndMonth(sgkProfileId, sgkDeviceCount, checked);
  };

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
        <label htmlFor="sgk-flag" className="select-none text-xs font-medium text-slate-700">
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
                onChange={(e) => onChangeSgkPrescriptionReceived(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              <span>Reçete geldi mi?</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!sgkFlag}
                checked={sgkRecordedToSystem}
                onChange={(e) => onChangeSgkRecordedToSystem(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              <span>Sisteme işlendi mi?</span>
            </label>

            {/* Pill prescription (always visible; effective only on battery flows) */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!sgkFlag}
                checked={sgkPillPrescription}
                onChange={(e) => handleTogglePillPrescription(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              <span>Pil Reçetesi</span>
            </label>

            {/* Prescription number */}
            <label className="mt-1 flex flex-col gap-1">
              <span className="text-xs text-slate-700">SGK Reçete No (opsiyonel)</span>
              <input
                type="text"
                disabled={!sgkFlag}
                value={sgkPrescriptionNo}
                onChange={(e) => onChangeSgkPrescriptionNo(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Reçete numarası"
              />
            </label>

            {deviceFlowType === 'rechargeable_device' && (
              <p className="mt-1 text-[11px] text-slate-500">
                Pil Reçetesi seçeneği pil satışlarında kullanılır. Şarjlı cihaz akışında hesaplamaya etkisi yoktur.
              </p>
            )}
          </div>

          {/* SGK profile + device count + derived totals */}
          <div className="mt-2 flex flex-col gap-2 text-xs">
            {/* Profile is hidden for battery_only */}
            {isProfileSelectable ? (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-700">SGK Profili</span>
                <select
                  disabled={!sgkFlag}
                  value={sgkProfileId}
                  onChange={(e) => handleChangeProfile(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Profil seçin...</option>
                  {(SGK_PROFILES as SgkProfile[]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-md border border-slate-200 bg-white px-2 py-2">
                <p className="text-[11px] text-slate-600">
                  Pil hastalarında SGK profili seçilmez. SGK cihaz adedi (1/2) seçimi pil ödemesi çarpanı için kullanılır.
                </p>
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-700">SGK Cihaz Adedi</span>
              <select
                disabled={!sgkFlag}
                value={sgkDeviceCount}
                onChange={(e) => handleChangeDeviceCount(e.target.value as '1' | '2')}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="1">1 cihaz</option>
                <option value="2">2 cihaz</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Bu seçim cihaz satırlarından otomatik türetilmez; iş kuralı gereği manuel seçilir.
              </p>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-700">Beklenen SGK Ödemesi (net)</span>
              <input
                type="text"
                disabled={!sgkFlag}
                readOnly
                value={sgkExpectedReimbursement}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Seçimlere göre otomatik hesaplanır"
              />
              {isBatteryFlow && sgkPillPrescription && (
                <p className="mt-1 text-[11px] text-slate-600">
                  Pil reçetesi ek ödemesi: {PILL_EXTRA_REIMBURSEMENT_KDV_INCLUSIVE} TL (KDV dahil) × cihaz adedi
                </p>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-700">Beklenen Ödeme Ayı (SGK)</span>
              <input
                type="month"
                disabled={!sgkFlag}
                readOnly
                value={sgkExpectedMonth}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <p className="mt-1 text-[11px] text-slate-500">
              Beklenen ödeme tutarı ve ayı sistem tarafından otomatik hesaplanır (yaklaşık 3 ay sonrası). Bu alanlar sonradan elle
              değiştirilmez.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
