// src/features/patients/PatientDetailSgkInvoiceTab.tsx
// SGK and Invoice tab for patient detail drawer: SGK flags, prescription no,
// SGK profile-based reimbursement info and invoice status.

import type { PatientRow } from '../../types';
import { formatDate } from '../../patientFormatUtils';
import { getSgkProfileLabel } from '../../sgkProfiles';

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
  const invoiceStatusLabel = invoiceIssued
    ? 'Fatura kesildi'
    : 'Fatura henüz kesilmedi';

  const invoiceDateDisplay = invoiceIssuedAt
    ? formatDate(invoiceIssuedAt)
    : '-';

  const sgkProfileLabel = getSgkProfileLabel(patient.sgk_profile ?? null);

  const sgkExpectedReimbursementDisplay =
    patient.sgk_expected_reimbursement != null
      ? `${patient.sgk_expected_reimbursement.toLocaleString('tr-TR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} ₺`
      : '-';

  const sgkExpectedMonthDisplay = patient.sgk_expected_reimbursement_month
    ? formatDate(patient.sgk_expected_reimbursement_month)
    : '-';

  const sgkRecordedToSystemAtDisplay =
    patient.sgk_recorded_to_system_at != null
      ? formatDate(patient.sgk_recorded_to_system_at)
      : '-';

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        SGK, Evrak ve Fatura Takibi
      </h4>
      <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
        {/* SGK flags */}
        <div className="flex items-center gap-2">
          <input
            id="detail-sgk-flag"
            type="checkbox"
            checked={sgkFlag}
            onChange={(e) => onChangeSgkFlag(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <label
            htmlFor="detail-sgk-flag"
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

        {/* Sisteme işlendiği tarih (okuma amaçlı) */}
        <div className="mt-1 pl-5 text-[11px] text-slate-500">
          <span className="mr-1">Sisteme işlendiği tarih:</span>
          <span className="font-medium text-slate-700">
            {sgkRecordedToSystemAtDisplay}
          </span>
        </div>

        {/* SGK prescription no (editable but biraz geri planda) */}
        <div className="mt-2 flex flex-col gap-1 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-700">SGK Reçete No</span>
            <input
              type="text"
              value={sgkPrescriptionNo}
              onChange={(e) => onChangeSgkPrescriptionNo(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Reçete numarasını bir kez girin..."
            />
          </label>
        </div>

        {/* SGK profile + expected reimbursement (read-only) */}
        <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-200 pt-2 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">SGK Profili</span>
            <span className="text-right text-xs text-slate-900">
              {sgkProfileLabel}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">
              Beklenen SGK Ödemesi (net)
            </span>
            <span className="text-right text-xs text-slate-900">
              {sgkExpectedReimbursementDisplay}
            </span>
          </div>
          <div className="flex justify-between gap-2 sm:col-span-2">
            <span className="text-xs text-slate-500">
              Beklenen Ödeme Ayı
            </span>
            <span className="text-right text-xs text-slate-900">
              {sgkExpectedMonthDisplay}
            </span>
          </div>
        </div>

        <p className="mt-1 text-[11px] text-slate-500">
          Bu alanlar ana listede satırları renklendirir ve SGK / fatura
          uyarılarını tetikler. Beklenen SGK ödemesi tutarı ve ayı, profil +
          sistem kuralına göre otomatik hesaplanır.
        </p>

        {/* Invoice status */}
        <div className="mt-3 border-t border-slate-200 pt-2">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={invoiceIssued}
                onChange={(e) =>
                  onChangeInvoiceIssued(e.target.checked)
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span>Fatura kesildi mi?</span>
            </label>
            <span
              className={
                'text-[11px] font-medium ' +
                (invoiceIssued
                  ? 'text-emerald-700'
                  : 'text-amber-700')
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
              Fatura henüz kesilmediyse hasta listesinde uyarı olarak
              görünecektir.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
