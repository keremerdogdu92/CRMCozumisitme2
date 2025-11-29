// src/features/patients/PatientDetailInfoTab.tsx
// Info tab for patient detail drawer: identity, contact, reference, SGK flags, prescription no and invoice status.

import { useEffect, useState } from 'react';
import type { PatientRow } from './types';
import { formatDate } from './patientFormatUtils';
import { getSgkProfileLabel } from './sgkProfiles';

type PatientDetailInfoTabProps = {
  patient: PatientRow;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  onChangeSgkFlag: (value: boolean) => void;
  onChangeSgkPrescriptionReceived: (value: boolean) => void;
  onChangeSgkRecordedToSystem: (value: boolean) => void;

  // SGK prescription no (text input)
  sgkPrescriptionNo: string;
  onChangeSgkPrescriptionNo: (value: string) => void;

  // Invoice status (controlled by drawer)
  invoiceIssued: boolean;
  invoiceIssuedAt: string | null;
  onChangeInvoiceIssued: (value: boolean) => void;
};

export function PatientDetailInfoTab({
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
}: PatientDetailInfoTabProps) {
  const [isEditingSgkPrescriptionNo, setIsEditingSgkPrescriptionNo] =
    useState(false);

  // SGK kapatıldığında reçete no edit modu da kapansın
  useEffect(() => {
    if (!sgkFlag) {
      setIsEditingSgkPrescriptionNo(false);
    }
  }, [sgkFlag]);

  const referenceDisplay =
    patient.reference_name && patient.reference_name.trim().length > 0
      ? patient.reference_name
      : '-';

  const satisfactionDisplay =
    patient.satisfaction_10 != null ? `${patient.satisfaction_10} / 10` : '-';

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

  const sgkPrescriptionNoDisplay =
    sgkPrescriptionNo && sgkPrescriptionNo.trim().length > 0
      ? sgkPrescriptionNo
      : '-';

  const shouldShowSgkPrescriptionInput =
    sgkFlag && (isEditingSgkPrescriptionNo || !sgkPrescriptionNo);

  return (
    <>
      {/* Basic + extended info merged under Özlük */}
      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Özlük Bilgileri &amp; Referans
        </h4>
        <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Ad Soyad</span>
            <span className="text-sm font-medium text-slate-900">
              {patient.full_name}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Telefon</span>
            <span className="text-sm text-slate-900">
              {patient.phone ?? '-'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Kayıt Tarihi</span>
            <span className="text-sm text-slate-900">
              {formatDate(patient.created_at)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Son Görüşme</span>
            <span className="text-sm text-slate-900">
              {formatDate(patient.last_visit_at)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Referans</span>
            <span className="text-sm text-slate-900">{referenceDisplay}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              Memnuniyet (1–10)
            </span>
            <span className="text-sm text-slate-900">
              {satisfactionDisplay}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Arşiv Kodu</span>
            <span className="text-sm text-slate-900">
              {patient.archive_code ?? '-'}
            </span>
          </div>

          {/* Identity / kin / address included under Özlük (çizgi kaldırıldı) */}
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">T.C. Kimlik No</span>
            <span className="text-sm text-slate-900">
              {patient.national_id ?? '-'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Yakın Telefonu</span>
            <span className="text-sm text-slate-900">
              {patient.kin_phone ?? '-'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">Adres</span>
            <span className="whitespace-pre-line text-sm text-slate-900">
              {patient.address && patient.address.trim().length > 0
                ? patient.address
                : '-'}
            </span>
          </div>
        </div>
      </section>

      {/* SGK fields + Invoice status grouped together */}
      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          SGK, Evrak ve Fatura Takibi
        </h4>
        <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
          {/* SGK flag + evrak durumu */}
          <div className="space-y-2">
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
                className="select-none text-sm font-medium text-slate-700"
              >
                SGK hastası
              </label>
            </div>

            <div className="flex flex-col gap-1 pl-5 text-[11px]">
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
          </div>

          {/* SGK Reçete No - gizli editleme */}
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">SGK Reçete No</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-900">
                  {sgkPrescriptionNoDisplay}
                </span>
                {sgkFlag && (
                  <button
                    type="button"
                    onClick={() =>
                      setIsEditingSgkPrescriptionNo((prev) => !prev)
                    }
                    className="text-[11px] text-primary-700 hover:underline disabled:opacity-50"
                    disabled={!sgkFlag}
                  >
                    {shouldShowSgkPrescriptionInput ? 'Kapat' : 'Düzenle'}
                  </button>
                )}
              </div>
            </div>

            {shouldShowSgkPrescriptionInput && (
              <input
                type="text"
                value={sgkPrescriptionNo}
                onChange={(e) =>
                  onChangeSgkPrescriptionNo(e.target.value)
                }
                onBlur={() => {
                  // Değer girildiyse, fokus kaybedince alanı kapat
                  if (
                    sgkPrescriptionNo &&
                    sgkPrescriptionNo.trim().length > 0
                  ) {
                    setIsEditingSgkPrescriptionNo(false);
                  }
                }}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Reçete numarasını girin..."
              />
            )}
          </div>

          {/* SGK profile + expected reimbursement (read-only for now) */}
          <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-2 text-[11px] sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">SGK Profili</span>
              <span className="text-right text-slate-900">
                {sgkProfileLabel}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">
                Beklenen SGK Ödemesi (net)
              </span>
              <span className="text-right text-slate-900">
                {sgkExpectedReimbursementDisplay}
              </span>
            </div>
            <div className="flex justify-between gap-2 sm:col-span-2">
              <span className="text-slate-500">Beklenen Ödeme Ayı</span>
              <span className="text-right text-slate-900">
                {sgkExpectedMonthDisplay}
              </span>
            </div>
          </div>

          {/* Fatura durumu – daha sakin görünüm */}
          <div className="mt-3 border-t border-slate-200 pt-2">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
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
                  (invoiceIssued ? 'text-emerald-700' : 'text-slate-500')
                }
              >
                {invoiceStatusLabel}
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-2 text-[11px] text-slate-600">
              <span>Fatura Tarihi</span>
              <span className="text-slate-900">{invoiceDateDisplay}</span>
            </div>
          </div>

          <p className="mt-1 text-[11px] text-slate-500">
            Bu alanlar SGK ve fatura takibini kolaylaştırır; ana listede satır
            renkleri ve uyarılar için temel alınır.
          </p>
        </div>
      </section>
    </>
  );
}
