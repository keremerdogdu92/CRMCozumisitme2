// src/features/patients/PatientDetailInfoTab.tsx
// Info tab for patient detail drawer: identity, contact, reference and SGK flags.

import type { PatientRow } from './types';
import { formatDate } from './patientFormatUtils';

type PatientDetailInfoTabProps = {
  patient: PatientRow;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  onChangeSgkFlag: (value: boolean) => void;
  onChangeSgkPrescriptionReceived: (value: boolean) => void;
  onChangeSgkRecordedToSystem: (value: boolean) => void;
};

export function PatientDetailInfoTab({
  patient,
  sgkFlag,
  sgkPrescriptionReceived,
  sgkRecordedToSystem,
  onChangeSgkFlag,
  onChangeSgkPrescriptionReceived,
  onChangeSgkRecordedToSystem,
}: PatientDetailInfoTabProps) {
  const referenceDisplay =
    patient.reference_name && patient.reference_name.trim().length > 0
      ? patient.reference_name
      : '-';

  const satisfactionDisplay =
    patient.satisfaction_10 != null
      ? `${patient.satisfaction_10} / 10`
      : '-';

  const invoiceStatusLabel = patient.invoice_issued ? 'Kesildi' : 'Bekliyor';
  const invoiceDateDisplay = patient.invoice_issued_at
    ? formatDate(patient.invoice_issued_at)
    : '-';

  const prescriptionNoDisplay =
    patient.sgk_prescription_no &&
    patient.sgk_prescription_no.trim().length > 0
      ? patient.sgk_prescription_no
      : '-';

  return (
    <>
      {/* Basic + extended info merged under Özlük */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Özlük Bilgileri & Referans
        </h4>
        <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Ad Soyad</span>
            <span className="text-xs font-medium text-slate-900">
              {patient.full_name}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Telefon</span>
            <span className="text-xs text-slate-900">
              {patient.phone ?? '-'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Kayıt Tarihi</span>
            <span className="text-xs text-slate-900">
              {formatDate(patient.created_at)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Son Görüşme</span>
            <span className="text-xs text-slate-900">
              {formatDate(patient.last_visit_at)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Referans</span>
            <span className="text-xs text-slate-900">
              {referenceDisplay}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">
              Memnuniyet (1–10)
            </span>
            <span className="text-xs text-slate-900">
              {satisfactionDisplay}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Arşiv Kodu</span>
            <span className="text-xs text-slate-900">
              {patient.archive_code ?? '-'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Fatura Durumu</span>
            <span className="text-xs text-slate-900">
              {invoiceStatusLabel}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Fatura Tarihi</span>
            <span className="text-xs text-slate-900">
              {invoiceDateDisplay}
            </span>
          </div>

          {/* Identity / kin / address included under Özlük */}
          <div className="mt-1 border-t border-slate-200 pt-1 flex justify-between gap-2">
            <span className="text-xs text-slate-500">T.C. Kimlik No</span>
            <span className="text-xs text-slate-900">
              {patient.national_id ?? '-'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Yakın Telefonu</span>
            <span className="text-xs text-slate-900">
              {patient.kin_phone ?? '-'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Adres</span>
            <span className="text-xs text-slate-900 whitespace-pre-line">
              {patient.address && patient.address.trim().length > 0
                ? patient.address
                : '-'}
            </span>
          </div>
        </div>
      </section>

      {/* SGK fields */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          SGK ve Evrak Takibi
        </h4>
        <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
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

          <div className="mt-1 flex justify-between gap-2 text-xs">
            <span className="text-slate-500">Reçete No</span>
            <span className="text-slate-900">
              {prescriptionNoDisplay}
            </span>
          </div>

          <p className="mt-1 text-[11px] text-slate-500">
            Bu alanlar ana listede satırları renklendirir ve
            &quot;Reçete bekleniyor / Sisteme işlenecek&quot; uyarılarını
            tetikler.
          </p>
        </div>
      </section>
    </>
  );
}
