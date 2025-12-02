// src/features/patients/PatientDetailInfoTab.tsx
// Info tab for patient detail drawer: identity, contact, reference and archive info.

import type { PatientRow } from '../../types';
import { formatDate } from '../../patientFormatUtils';

type PatientDetailInfoTabProps = {
  patient: PatientRow;
};

export function PatientDetailInfoTab({ patient }: PatientDetailInfoTabProps) {
  const referenceDisplay =
    patient.reference_name && patient.reference_name.trim().length > 0
      ? patient.reference_name
      : '-';

  const satisfactionDisplay =
    patient.satisfaction_10 != null
      ? `${patient.satisfaction_10} / 10`
      : '-';

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        Özlük Bilgileri
      </h4>
      <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Ad Soyad</span>
          <span className="text-sm font-medium text-slate-900">
            {patient.full_name}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Telefon</span>
          <span className="text-sm text-slate-900">
            {patient.phone ?? '-'}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Kayıt Tarihi</span>
          <span className="text-sm text-slate-900">
            {formatDate(patient.created_at)}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Son Görüşme</span>
          <span className="text-sm text-slate-900">
            {formatDate(patient.last_visit_at)}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Referans</span>
          <span className="text-sm text-slate-900">
            {referenceDisplay}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">
            Memnuniyet (1–10)
          </span>
          <span className="text-sm text-slate-900">
            {satisfactionDisplay}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Arşiv Kodu</span>
          <span className="text-sm text-slate-900">
            {patient.archive_code ?? '-'}
          </span>
        </div>

        {/* Identity / kin / address (çizgi kaldırıldı; tek blokta) */}
        <div className="flex justify-between gap-2 pt-1">
          <span className="text-xs text-slate-500">T.C. Kimlik No</span>
          <span className="text-sm text-slate-900">
            {patient.national_id ?? '-'}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Yakın Telefonu</span>
          <span className="text-sm text-slate-900">
            {patient.kin_phone ?? '-'}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Adres</span>
          <span className="whitespace-pre-line text-sm text-slate-900">
            {patient.address && patient.address.trim().length > 0
              ? patient.address
              : '-'}
          </span>
        </div>
      </div>
    </section>
  );
}
