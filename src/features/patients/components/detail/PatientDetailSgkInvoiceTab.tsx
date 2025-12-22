// src/features/patients/components/detail/PatientDetailSgkInvoiceTab.tsx
// SGK and Invoice tab for patient detail drawer: read-only SGK summary
// + collapsible edit section (flags, profile, device count, pill extra, system date) and invoice status.

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

  // Optional: upper component ileride sisteme işlendiği tarihi de state olarak tutmak isterse.
  sgkRecordedToSystemAt?: string | null;
  onChangeSgkRecordedToSystemAt?: (value: string | null) => void;

  sgkPrescriptionNo: string;
  onChangeSgkPrescriptionNo: (value: string) => void;

  // Saved invoice state coming from parent (DB-backed).
  invoiceIssued: boolean;
  invoiceIssuedAt: string | null;

  // Invoice save integration (handled in parent).
  invoiceIsSaving?: boolean;
  invoiceSaveError?: string | null;
  onSaveInvoice: (params: {
    invoiceIssued: boolean;
    invoiceIssuedAt: string | null;
  }) => void;
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

// For <input type="date"> value from ISO-like strings.
function toDateInputValue(isoLike: string | null | undefined): string {
  if (!isoLike) return '';
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todayAsDateInput(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function PatientDetailSgkInvoiceTab({
  patient,
  sgkFlag,
  sgkPrescriptionReceived,
  sgkRecordedToSystem,
  onChangeSgkFlag,
  onChangeSgkPrescriptionReceived,
  onChangeSgkRecordedToSystem,
  sgkRecordedToSystemAt,
  onChangeSgkRecordedToSystemAt,
  sgkPrescriptionNo,
  onChangeSgkPrescriptionNo,
  invoiceIssued,
  invoiceIssuedAt,
  invoiceIsSaving,
  invoiceSaveError,
  onSaveInvoice,
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

  // Sisteme işlendiği tarih için lokal input state.
  const [sgkRecordedAtInput, setSgkRecordedAtInput] = useState<string>(
    toDateInputValue(
      sgkRecordedToSystemAt ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (((patient as any).sgk_recorded_to_system_at as string | null) ?? null),
    ),
  );

  // Invoice local edit state:
  // - invoiceIssuedLocal: checkbox state (editable).
  // - invoiceDateInput: <input type="date"> value (yyyy-MM-dd).
  const [invoiceIssuedLocal, setInvoiceIssuedLocal] = useState<boolean>(invoiceIssued);
  const [invoiceDateInput, setInvoiceDateInput] = useState<string>(
    toDateInputValue(invoiceIssuedAt),
  );

  // Initial sync from patient row whenever *patient changes* (ID bazında)
  // veya üst katmandan gelen sgkRecordedToSystemAt / invoice fields dışarıdan güncellenirse.
  useEffect(() => {
    setIsEditing(false);
    setProfileError(null);

    setSgkProfileId(patient.sgk_profile ?? '');

    if (patient.sgk_expected_reimbursement != null) {
      setSgkExpectedReimbursement(
        formatMoneyLikeTR(Number(patient.sgk_expected_reimbursement)),
      );
    } else {
      setSgkExpectedReimbursement('');
    }

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

    setSgkRecordedAtInput(
      toDateInputValue(
        sgkRecordedToSystemAt ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (((patient as any).sgk_recorded_to_system_at as string | null) ?? null),
      ),
    );

    // Invoice local state reset from saved values:
    setInvoiceIssuedLocal(invoiceIssued);
    setInvoiceDateInput(toDateInputValue(invoiceIssuedAt));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id, sgkRecordedToSystemAt, invoiceIssued, invoiceIssuedAt]);

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
    if (!checked) {
      const confirmed = window.confirm(
        [
          'SGK hastası işaretini kaldırırsanız SGK ile ilgili işaretler (reçete geldi / sisteme işlendi) ve',
          'beklenen SGK ödemesi bilgileri sıfırlanabilir.',
          '',
          'Devam etmek istediğinize emin misiniz?',
        ].join('\n'),
      );
      if (!confirmed) return;

      setSgkProfileId('');
      setSgkDeviceCount('1');
      setSgkPillPrescription(false);
      setSgkExpectedReimbursement('');
      setSgkExpectedMonth('');
      setSgkRecordedAtInput('');
      onChangeSgkRecordedToSystemAt?.(null);
      onChangeSgkRecordedToSystem(false);
      onChangeSgkPrescriptionReceived(false);
    } else {
      recomputeExpected(true, sgkProfileId, sgkDeviceCount, sgkPillPrescription);
      onChangeSgkFlag(true);
    }

    if (!checked) {
      onChangeSgkFlag(false);
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

  const handleToggleRecordedToSystem = (checked: boolean) => {
    if (!sgkFlag) return;

    if (!checked) {
      const confirmed = window.confirm(
        [
          '“Sisteme işlendi mi?” kutusunu kapatırsanız sisteme işlenme tarihi temizlenecek.',
          '',
          'Bu durum SGK takip ve raporlamayı etkileyebilir.',
          'Devam etmek istediğinize emin misiniz?',
        ].join('\n'),
      );
      if (!confirmed) return;

      setSgkRecordedAtInput('');
      onChangeSgkRecordedToSystemAt?.(null);
      onChangeSgkRecordedToSystem(false);
      return;
    }

    if (!sgkRecordedToSystem && !sgkRecordedAtInput) {
      const today = todayAsDateInput();
      setSgkRecordedAtInput(today);
      onChangeSgkRecordedToSystemAt?.(today);
    }

    onChangeSgkRecordedToSystem(true);
  };

  const handleRecordedDateChange = (value: string) => {
    setSgkRecordedAtInput(value);
    onChangeSgkRecordedToSystemAt?.(value || null);
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

  // --- Invoice local handlers ---

  const handleToggleInvoiceIssuedLocal = (checked: boolean) => {
    if (!checked) {
      // If there is an existing date in the input, confirm before clearing.
      if (invoiceDateInput && invoiceDateInput.trim().length > 0) {
        const confirmed = window.confirm(
          [
            '“Fatura kesildi mi?” işaretini kaldırırsanız fatura tarihi temizlenecek.',
            '',
            'Bu işlem kayıtlı fatura tarihini siler. Devam etmek istediğinize emin misiniz?',
          ].join('\n'),
        );
        if (!confirmed) return;
      }

      setInvoiceIssuedLocal(false);
      setInvoiceDateInput('');
      return;
    }

    // First time marking as issued: default to today if no date yet.
    setInvoiceIssuedLocal(true);
    if (!invoiceDateInput || invoiceDateInput.trim().length === 0) {
      setInvoiceDateInput(todayAsDateInput());
    }
  };

  const handleInvoiceDateChange = (value: string) => {
    setInvoiceDateInput(value);
  };

  const handleSaveInvoiceClick = () => {
    // When invoice is marked as issued but date is empty, default to today.
    let effectiveDate = invoiceDateInput;
    if (invoiceIssuedLocal && (!effectiveDate || effectiveDate.trim().length === 0)) {
      effectiveDate = todayAsDateInput();
      setInvoiceDateInput(effectiveDate);
    }

    onSaveInvoice({
      invoiceIssued: invoiceIssuedLocal,
      invoiceIssuedAt: invoiceIssuedLocal ? effectiveDate || null : null,
    });
  };

  // --- Read-only summary values (DB-backed) ---

  const invoiceStatusLabel = invoiceIssued ? 'Fatura kesildi' : 'Fatura henüz kesilmedi';

  const invoiceDateDisplay = invoiceIssuedAt ? formatDate(invoiceIssuedAt) : '-';

  // FIX: avoid mixing || and ?? without parentheses.
  const sgkProfileLabel = getSgkProfileLabel(
    (sgkProfileId || patient.sgk_profile) ?? null,
  );

  const sgkExpectedReimbursementDisplay = sgkExpectedReimbursement
    ? `${sgkExpectedReimbursement} ₺`
    : '-';

  const expectedMonthIso = monthInputToIsoDate(sgkExpectedMonth);
  const sgkExpectedMonthDisplay = expectedMonthIso ? formatDate(expectedMonthIso) : '-';

  const sgkPrescriptionNoDisplay =
    sgkPrescriptionNo && sgkPrescriptionNo.trim().length > 0
      ? sgkPrescriptionNo
      : '-';

  const sgkRecordedDateDisplay =
    sgkRecordedAtInput && sgkRecordedAtInput.trim().length > 0
      ? formatDate(sgkRecordedAtInput)
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
            <span className="text-slate-500">Sisteme İşlendiği Tarih</span>
            <span className="text-right text-slate-900">
              {sgkRecordedDateDisplay}
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
                  onChange={(e) => handleToggleRecordedToSystem(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                />
                <span>Sisteme işlendi mi?</span>
              </label>

              {/* Sisteme işlendiği tarih (manuel ayar) */}
              <div className="mt-1 flex flex-col gap-1 pl-5">
                <span className="text-xs text-slate-700">
                  Sisteme işlendiği tarih
                </span>
                <input
                  type="date"
                  value={sgkRecordedAtInput}
                  onChange={(e) => handleRecordedDateChange(e.target.value)}
                  disabled={!sgkFlag || !sgkRecordedToSystem}
                  className="w-44 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
                <p className="text-[11px] text-slate-400">
                  Kutuyu ilk kez işaretlediğinizde bugünün tarihi otomatik gelir.
                  Gerekirse buradan geri dönük olarak düzeltebilirsiniz.
                </p>
              </div>

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
                checked={invoiceIssuedLocal}
                onChange={(e) => handleToggleInvoiceIssuedLocal(e.target.checked)}
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

          {/* Saved invoice date summary (DB-backed) */}
          <div className="mt-1 flex justify-between gap-2 text-[11px] text-slate-600">
            <span>Fatura Tarihi (kayıtlı)</span>
            <span>{invoiceDateDisplay}</span>
          </div>

          {/* Editable invoice date + save button */}
          <div className="mt-2 flex flex-col gap-1 text-[11px] text-slate-700">
            <span>Düzenlenecek fatura tarihi</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={invoiceDateInput}
                onChange={(e) => handleInvoiceDateChange(e.target.value)}
                disabled={!invoiceIssuedLocal}
                className="w-40 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
              <button
                type="button"
                onClick={handleSaveInvoiceClick}
                disabled={!!invoiceIsSaving}
                className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {invoiceIsSaving ? 'Kaydediliyor...' : 'Fatura Tarihini Kaydet'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Kutuyu işaretlediğinizde bugünün tarihi otomatik gelir. Gerekirse buradan
              geri dönük bir tarih seçip &quot;Fatura Tarihini Kaydet&quot; butonuna
              basın. Kutunun işaretini kaldırırsanız fatura tarihi temizlenir.
            </p>
            {invoiceSaveError && (
              <p className="text-[11px] text-red-600">{invoiceSaveError}</p>
            )}
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
