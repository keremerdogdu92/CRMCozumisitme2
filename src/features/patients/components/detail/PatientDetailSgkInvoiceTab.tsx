// src/features/patients/components/detail/PatientDetailSgkInvoiceTab.tsx
// SGK and Invoice tab for patient detail drawer: read-only SGK summary
// + collapsible edit section (flags, profile, device count, pill extra) and invoice status.

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PatientRow } from '../../types';
import { formatDate } from '../../patientFormatUtils';
import { SGK_PROFILES, getSgkProfileLabel } from '../../sgkProfiles';
import { updatePatientSgkProfileInfo } from '../../api/api.patients.update';
import { PATIENTS_QUERY_KEY } from '../../api/api.core';

type PatientDetailSgkInvoiceTabProps = {
  patient: PatientRow;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  onChangeSgkFlag: (value: boolean) => void;
  onChangeSgkPrescriptionReceived: (value: boolean) => void;
  onChangeSgkRecordedToSystem: (value: boolean) => void;

  sgkPrescriptionNo: string;
  onChangeSgkPrescriptionNo: (value: string) => void;

  invoiceIssued: boolean;
  invoiceIssuedAt: string | null;
  onChangeInvoiceIssued: (value: boolean) => void;
};

type SgkDeviceCount = '1' | '2';

type SgkProfileInternal = {
  id: string;
  label: string;
  netToFirm: number;
};

// Fixed extra reimbursement for pill prescriptions (incl. VAT).
// Same iş kuralı: 624 TL / cihaz.
const SGK_PILL_EXTRA_PER_DEVICE_TL = 624;

// Money helpers (TR format support).
function formatMoneyLikeTR(value: number): string {
  const fixed = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return fixed.replace('.', ',');
}

function toCountMultiplier(count: SgkDeviceCount): number {
  return count === '2' ? 2 : 1;
}

function computeTotal(
  profileNetToFirm: number | null,
  count: SgkDeviceCount,
  pillPrescription: boolean,
): string {
  const mult = toCountMultiplier(count);
  const base = profileNetToFirm != null ? profileNetToFirm * mult : 0;
  const pillExtra = pillPrescription ? SGK_PILL_EXTRA_PER_DEVICE_TL * mult : 0;
  const total = Number((base + pillExtra).toFixed(2));
  return total > 0 ? formatMoneyLikeTR(total) : '';
}

function computeDefaultExpectedMonth(): string {
  const base = new Date();
  base.setMonth(base.getMonth() + 3);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`; // type="month" format
}

function monthInputToIsoDate(monthValue: string): string | null {
  if (!monthValue) return null;
  const [yearStr, monthStr] = monthValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, 15));
  return date.toISOString();
}

export function PatientDetailSgkInvoiceTab({
  patient,
  sgkFlag,
  sgkPrescriptionReceived,
  sgkRecordedToSystem,
  onChangeSgkFlag,
  onChangeSgkPrescriptionReceived,
  onChangeSgkRecordedToSystem,
  sgkPrescriptionNo,
  onChangeSgkPrescriptionNo,
  invoiceIssued,
  invoiceIssuedAt,
  onChangeInvoiceIssued,
}: PatientDetailSgkInvoiceTabProps) {
  const queryClient = useQueryClient();

  // --- Local SGK profile-edit state (only for this tab) ---

  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [sgkProfileId, setSgkProfileId] = useState<string>(patient.sgk_profile ?? '');
  const [sgkDeviceCount, setSgkDeviceCount] = useState<SgkDeviceCount>('1');
  const [sgkPillPrescription, setSgkPillPrescription] = useState<boolean>(false);
  const [sgkExpectedReimbursement, setSgkExpectedReimbursement] = useState<string>('');
  const [sgkExpectedMonth, setSgkExpectedMonth] = useState<string>('');

  // Initial sync from patient row whenever patient changes.
  useEffect(() => {
    setIsEditing(false);
    setProfileError(null);

    setSgkProfileId(patient.sgk_profile ?? '');

    // Expected reimbursement -> money-like string
    if (patient.sgk_expected_reimbursement != null) {
      setSgkExpectedReimbursement(
        formatMoneyLikeTR(Number(patient.sgk_expected_reimbursement)),
      );
    } else {
      setSgkExpectedReimbursement('');
    }

    // Expected month -> "yyyy-MM" for <input type="month">
    if (patient.sgk_expected_reimbursement_month) {
      const d = new Date(patient.sgk_expected_reimbursement_month);
      if (!Number.isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        setSgkExpectedMonth(`${yyyy}-${mm}`);
      } else {
        setSgkExpectedMonth('');
      }
    } else {
      setSgkExpectedMonth('');
    }

    // Device count & pill bayrakları DB'de tutulmuyor, sadece hesaplama amaçlı.
    setSgkDeviceCount('1');
    setSgkPillPrescription(false);
  }, [patient.id, patient.sgk_profile, patient.sgk_expected_reimbursement, patient.sgk_expected_reimbursement_month]);

  const findProfileNetToFirm = (profileId: string): number | null => {
    const profile = (SGK_PROFILES as SgkProfileInternal[]).find(
      (p) => p.id === profileId,
    );
    return profile ? profile.netToFirm : null;
  };

  const recomputeExpected = (
    enabled: boolean,
    profileId: string,
    count: SgkDeviceCount,
    pill: boolean,
  ) => {
    if (!enabled) {
      setSgkExpectedReimbursement('');
      setSgkExpectedMonth('');
      return;
    }

    const netToFirm = profileId ? findProfileNetToFirm(profileId) : null;
    const total = computeTotal(netToFirm, count, pill);
    setSgkExpectedReimbursement(total);
    setSgkExpectedMonth(total ? computeDefaultExpectedMonth() : '');
  };

  const handleToggleSgkFlag = (checked: boolean) => {
    onChangeSgkFlag(checked);
    if (!checked) {
      // SGK kapandığında yerel alanları da sıfırla.
      setSgkProfileId('');
      setSgkDeviceCount('1');
      setSgkPillPrescription(false);
      setSgkExpectedReimbursement('');
      setSgkExpectedMonth('');
    } else {
      // SGK açıldığında mevcut profil + varsayılanlarla yeniden hesapla.
      recomputeExpected(true, sgkProfileId, sgkDeviceCount, sgkPillPrescription);
    }
  };

  const handleChangeProfile = (value: string) => {
    setSgkProfileId(value);
    recomputeExpected(sgkFlag, value, sgkDeviceCount, sgkPillPrescription);
  };

  const handleChangeDeviceCount = (value: SgkDeviceCount) => {
    setSgkDeviceCount(value);
    recomputeExpected(sgkFlag, sgkProfileId, value, sgkPillPrescription);
  };

  const handleTogglePillPrescription = (checked: boolean) => {
    setSgkPillPrescription(checked);
    recomputeExpected(sgkFlag, sgkProfileId, sgkDeviceCount, checked);
  };

  const handleSaveSgkProfile = async () => {
    if (!sgkFlag) {
      setProfileError('Önce "SGK hastası" kutusunu işaretleyin.');
      return;
    }

    setProfileError(null);
    setIsSavingProfile(true);
    try {
      await updatePatientSgkProfileInfo({
        id: patient.id,
        sgkProfileId: sgkProfileId || null,
        sgkExpectedReimbursement: sgkExpectedReimbursement || null,
        sgkExpectedMonth: sgkExpectedMonth || null,
      });

      setIsEditing(false);

      // Hasta listesi ve detaylar güncel kalsın.
      await queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'SGK profili güncellenirken beklenmeyen bir hata oluştu.';
      setProfileError(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Read-only summary values ---

  const invoiceStatusLabel = invoiceIssued ? 'Fatura kesildi' : 'Fatura henüz kesilmedi';

  const invoiceDateDisplay = invoiceIssuedAt ? formatDate(invoiceIssuedAt) : '-';

  const sgkProfileLabel = getSgkProfileLabel(sgkProfileId || patient.sgk_profile ?? null);

  const sgkExpectedReimbursementDisplay = sgkExpectedReimbursement
    ? `${sgkExpectedReimbursement} ₺`
    : '-';

  const expectedMonthIso = monthInputToIsoDate(sgkExpectedMonth);
  const sgkExpectedMonthDisplay = expectedMonthIso ? formatDate(expectedMonthIso) : '-';

  const sgkPrescriptionNoDisplay =
    sgkPrescriptionNo && sgkPrescriptionNo.trim().length > 0
      ? sgkPrescriptionNo
      : '-';

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        SGK, Evrak ve Fatura Takibi
      </h4>

      <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
        {/* Read-only SGK summary */}
        <div className="space-y-1 border-b border-slate-200 pb-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">SGK Profili</span>
            <span className="text-right text-slate-900">{sgkProfileLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Beklenen SGK Ödemesi (net)</span>
            <span className="text-right text-slate-900">
              {sgkExpectedReimbursementDisplay}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Beklenen Ödeme Ayı</span>
            <span className="text-right text-slate-900">
              {sgkExpectedMonthDisplay}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">SGK Reçete No</span>
            <span className="text-right text-slate-900">
              {sgkPrescriptionNoDisplay}
            </span>
          </div>
        </div>

        {/* Edit toggle */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            Bu özet, SGK profili ve iş kurallarına göre hesaplanan beklenen ödemeyi
            gösterir.
          </p>
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className="text-[11px] font-medium text-primary-700 hover:underline disabled:opacity-50"
            disabled={isSavingProfile}
          >
            {isEditing ? 'Düzenlemeyi Kapat' : 'Düzenle'}
          </button>
        </div>

        {/* Collapsible edit section */}
        {isEditing && (
          <div className="space-y-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
            {/* SGK flags */}
            <div className="flex items-center gap-2">
              <input
                id="detail-sgk-flag"
                type="checkbox"
                checked={sgkFlag}
                onChange={(e) => handleToggleSgkFlag(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label
                htmlFor="detail-sgk-flag"
                className="select-none text-xs font-medium text-slate-700"
              >
                SGK hastası
              </label>
            </div>

            <div className="flex flex-col gap-1 pl-5">
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
            </div>

            {/* SGK prescription no (editable) */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-700">SGK Reçete No</span>
              <input
                type="text"
                value={sgkPrescriptionNo}
                onChange={(e) => onChangeSgkPrescriptionNo(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Reçete numarasını bir kez girin..."
              />
            </div>

            {/* SGK profile + device count + derived totals */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-700">SGK Profili</span>
                <select
                  disabled={!sgkFlag}
                  value={sgkProfileId}
                  onChange={(e) => handleChangeProfile(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Profil seçin...</option>
                  {(SGK_PROFILES as SgkProfileInternal[]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-700">SGK Cihaz Adedi</span>
                <select
                  disabled={!sgkFlag}
                  value={sgkDeviceCount}
                  onChange={(e) =>
                    handleChangeDeviceCount((e.target.value as SgkDeviceCount) || '1')
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="1">1 cihaz</option>
                  <option value="2">2 cihaz</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-700">
                  Beklenen SGK Ödemesi (net)
                </span>
                <input
                  type="text"
                  disabled
                  value={sgkExpectedReimbursement}
                  className="w-full rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-900 shadow-sm"
                  placeholder="Profil seçince otomatik hesaplanır"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-700">Beklenen Ödeme Ayı</span>
                <input
                  type="month"
                  disabled
                  value={sgkExpectedMonth}
                  className="w-full rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-900 shadow-sm"
                />
              </label>
            </div>

            <p className="text-[11px] text-slate-500">
              SGK profili, cihaz adedi ve pil reçetesi işaretine göre beklenen toplam
              ödeme ve tahmini ödeme ayı otomatik hesaplanır. Bu bilgiler sadece rapor ve
              liste renklendirme amaçlıdır.
            </p>

            <div className="flex items-center justify-end gap-2">
              {profileError && (
                <p className="flex-1 text-[11px] text-red-600">{profileError}</p>
              )}
              <button
                type="button"
                onClick={handleSaveSgkProfile}
                disabled={isSavingProfile}
                className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProfile ? 'Kaydediliyor...' : 'SGK Profilini Kaydet'}
              </button>
            </div>
          </div>
        )}

        {/* Invoice status (always visible) */}
        <div className="mt-1 border-t border-slate-200 pt-2">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={invoiceIssued}
                onChange={(e) => onChangeInvoiceIssued(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span>Fatura kesildi mi?</span>
            </label>
            <span
              className={
                'text-[11px] font-medium ' +
                (invoiceIssued ? 'text-emerald-700' : 'text-amber-700')
              }
            >
              {invoiceStatusLabel}
            </span>
          </div>
          <div className="mt-1 flex justify-between gap-2 text-[11px] text-slate-600">
            <span>Fatura Tarihi</span>
            <span>{invoiceDateDisplay}</span>
          </div>
          {!invoiceIssued && (
            <p className="mt-1 text-[11px] text-amber-700">
              Fatura henüz kesilmediyse hasta listesinde uyarı olarak görünecektir.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
