// src/features/patients/components/new/NewPatientSgkSection.tsx
// Summary: SGK block used in the NewPatientFormCard.
// v2.8:
// - Adds deviceFlowType awareness.
// - Adds sgkPillPrescription checkbox for battery flows.
// - Computes sgkExpectedReimbursement as TOTAL (profile * count) + (pillExtra * count if enabled).
// - For battery_only: hides profile selection; reimbursement is pill-only when enabled.

import type { NewPatientDeviceFlowType } from '../../types';
import {
  computeSgkSnapshot,
  useSgkReimbursementPeriods,
} from '../../api/api.sgkReimbursements';

type NewPatientSgkSectionProps = {
  deviceFlowType: NewPatientDeviceFlowType;

  sgkPillPrescription: boolean;
  onChangeSgkPillPrescription: (value: boolean) => void;

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
  onChangeSgkSnapshot: (patch: {
    sgkRatePeriodId: string | null;
    sgkProfileRateId: string | null;
    sgkRateEffectiveDate: string | null;
    sgkBaseReimbursement: number | null;
    sgkPillExtraAmount: number | null;
  }) => void;
};

export function NewPatientSgkSection({
  deviceFlowType,
  sgkPillPrescription,
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
  onChangeSgkSnapshot,
}: NewPatientSgkSectionProps) {
  const { data: sgkPeriods } = useSgkReimbursementPeriods();
  const isBatteryFlow = deviceFlowType === 'battery_device' || deviceFlowType === 'battery_only';
  const isBatteryOnly = deviceFlowType === 'battery_only';
  const previewSnapshot = computeSgkSnapshot({
    periods: sgkPeriods,
    effectiveDate: null,
    profileId: isBatteryOnly ? null : sgkProfileId || null,
    deviceCount: sgkDeviceCount,
    pillPrescription: sgkPillPrescription,
  });
  const profileOptions = previewSnapshot.period.rates;

  const clearSnapshot = () => {
    onChangeSgkSnapshot({
      sgkRatePeriodId: null,
      sgkProfileRateId: null,
      sgkRateEffectiveDate: null,
      sgkBaseReimbursement: null,
      sgkPillExtraAmount: null,
    });
  };

  const applySnapshot = (
    enabled: boolean,
    profileId: string,
    count: '1' | '2',
    pill: boolean,
  ) => {
    if (!enabled) {
      onChangeSgkExpectedReimbursement('');
      onChangeSgkExpectedMonth('');
      clearSnapshot();
      return;
    }

    const snapshot = computeSgkSnapshot({
      periods: sgkPeriods,
      effectiveDate: null,
      profileId: isBatteryOnly ? null : profileId || null,
      deviceCount: count,
      pillPrescription: pill,
    });
    onChangeSgkExpectedReimbursement(snapshot.totalInput);
    onChangeSgkExpectedMonth(snapshot.expectedMonth);
    onChangeSgkSnapshot({
      sgkRatePeriodId: snapshot.period.id.startsWith('fallback-')
        ? null
        : snapshot.period.id,
      sgkProfileRateId: snapshot.rate?.id.startsWith('fallback-')
        ? null
        : snapshot.rate?.id ?? null,
      sgkRateEffectiveDate:
        snapshot.totalAmount > 0 ? snapshot.effectiveDate : null,
      sgkBaseReimbursement:
        snapshot.totalAmount > 0 ? snapshot.baseAmount : null,
      sgkPillExtraAmount:
        snapshot.totalAmount > 0 ? snapshot.pillExtraAmount : null,
    });
  };

  const resetSgkDerivedFields = () => {
    onChangeSgkPrescriptionReceived(false);
    onChangeSgkRecordedToSystem(false);
    onChangeSgkProfileId('');
    onChangeSgkExpectedReimbursement('');
    onChangeSgkExpectedMonth('');
    onChangeSgkPrescriptionNo('');
    onChangeSgkDeviceCount('1');
    onChangeSgkPillPrescription(false);
    clearSnapshot();
  };

  const handleToggleSgkFlag = (checked: boolean) => {
    onChangeSgkFlag(checked);
    if (!checked) {
      resetSgkDerivedFields();
    } else {
      applySnapshot(checked, sgkProfileId, sgkDeviceCount, sgkPillPrescription);
    }
  };

  const handleChangeProfile = (value: string) => {
    onChangeSgkProfileId(value);
    applySnapshot(sgkFlag, value, sgkDeviceCount, sgkPillPrescription);
  };

  const handleChangeDeviceCount = (value: '1' | '2') => {
    onChangeSgkDeviceCount(value);
    applySnapshot(sgkFlag, sgkProfileId, value, sgkPillPrescription);
  };

  const handleTogglePillPrescription = (checked: boolean) => {
    onChangeSgkPillPrescription(checked);
    applySnapshot(sgkFlag, sgkProfileId, sgkDeviceCount, checked);
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

            {/* Battery-only extra checkbox */}
            {isBatteryFlow && (
              <label className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!sgkFlag}
                  checked={sgkPillPrescription}
                  onChange={(e) => handleTogglePillPrescription(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                />
                <span>Pil reçetesi var mı? (ek ödeme)</span>
              </label>
            )}

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
          </div>

          {/* SGK profile + device count + derived totals */}
          <div className="mt-2 flex flex-col gap-2 text-xs">
            {!isBatteryOnly && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-700">SGK Profili</span>
                <select
                  disabled={!sgkFlag}
                  value={sgkProfileId}
                  onChange={(e) => handleChangeProfile(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Profil seçin...</option>
                  {profileOptions.map((p) => (
                    <option key={p.profile_id} value={p.profile_id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
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
                placeholder="Profil seçince otomatik hesaplanır"
              />
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
              Beklenen ödeme tutarı ve ayı sistem tarafından otomatik hesaplanır (yaklaşık 3 ay sonrası).
              Bu alanlar sonradan elle değiştirilmez.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
