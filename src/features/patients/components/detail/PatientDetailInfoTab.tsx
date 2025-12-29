// src/features/patients/components/detail/PatientDetailInfoTab.tsx
// Summary: Patient detail drawer "Info" tab showing identity, contact, reference and archive info.
// Integrations:
// - Uses patientFormatUtils.formatDate for consistent date formatting.
// - Supports soft delete + restore actions via optional callbacks.
// Security notes:
// - The tab does not directly mutate DB; it calls provided callbacks (which should use RPCs).

import type { PatientRow } from '../../types';
import { formatDate } from '../../patientFormatUtils';

type PatientDetailInfoTabProps = {
  patient: PatientRow;

  /**
   * Optional soft-delete handler (RPC-backed).
   * Rendered only when the patient is NOT deleted.
   */
  onDeletePatient?: (patient: PatientRow) => void;

  /**
   * Optional restore handler (RPC-backed).
   * Rendered only when the patient IS deleted.
   */
  onRestorePatient?: (patient: PatientRow) => void;

  isDeleting?: boolean;
  isRestoring?: boolean;
};

export function PatientDetailInfoTab({
  patient,
  onDeletePatient,
  onRestorePatient,
  isDeleting = false,
  isRestoring = false,
}: PatientDetailInfoTabProps) {
  const referenceDisplay =
    patient.reference_name && patient.reference_name.trim().length > 0
      ? patient.reference_name
      : '-';

  const satisfactionDisplay =
    patient.satisfaction_10 != null ? `${patient.satisfaction_10} / 10` : '-';

  const isDeleted = !!patient.deleted_at;

  const handleDeleteClick = () => {
    if (!onDeletePatient) return;

    const confirmed = window.confirm(
      [
        'Bu hastayı silmek istediğinizden emin misiniz?',
        '',
        'Silme işlemi:',
        '- Hastayı ana listeden kaldırır.',
        '- Soft delete olarak işaretlenir (geri alınabilir).',
        '',
        'Not: Fatura ve cihaz kayıtları silinmez.',
      ].join('\n'),
    );

    if (!confirmed) return;
    onDeletePatient(patient);
  };

  const handleRestoreClick = () => {
    if (!onRestorePatient) return;

    const confirmed = window.confirm(
      [
        'Bu hastayı geri almak istediğinizden emin misiniz?',
        '',
        'Geri alma işlemi:',
        '- Hastayı tekrar aktif listelere dahil eder.',
        '- Silme işaretlerini (deleted_at / deleted_by / reason) temizler.',
      ].join('\n'),
    );

    if (!confirmed) return;
    onRestorePatient(patient);
  };

  return (
    <section className="space-y-4">
      <div className="space-y-2">
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
            <span className="text-sm text-slate-900">{patient.phone ?? '-'}</span>
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
            <span className="text-sm text-slate-900">{referenceDisplay}</span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Memnuniyet (1–10)</span>
            <span className="text-sm text-slate-900">{satisfactionDisplay}</span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Arşiv Kodu</span>
            <span className="text-sm text-slate-900">
              {patient.archive_code ?? '-'}
            </span>
          </div>

          <div className="flex justify-between gap-2 pt-1">
            <span className="text-xs text-slate-500">T.C. Kimlik No</span>
            <span className="text-sm text-slate-900">
              {patient.national_id ?? '-'}
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Yakın Telefonu</span>
            <span className="text-sm text-slate-900">{patient.kin_phone ?? '-'}</span>
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
      </div>

      {isDeleted && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
          <h4 className="text-xs font-semibold uppercase text-amber-800">
            Silinmiş Kayıt
          </h4>
          <p className="text-xs text-amber-900">
            Bu hasta kaydı soft delete ile silinmiş görünüyor.
          </p>
          <div className="text-[11px] text-amber-900">
            <div>
              <span className="font-semibold">Silinme tarihi:</span>{' '}
              {formatDate(patient.deleted_at ?? null)}
            </div>
            {patient.delete_reason && (
              <div>
                <span className="font-semibold">Sebep:</span> {patient.delete_reason}
              </div>
            )}
          </div>

          {onRestorePatient && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleRestoreClick}
                disabled={isRestoring}
                className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRestoring ? 'Geri Alınıyor...' : 'Geri Al'}
              </button>
            </div>
          )}
        </div>
      )}

      {!isDeleted && onDeletePatient && (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-3">
          <h4 className="text-xs font-semibold uppercase text-red-700">
            Hasta Kaydını Sil
          </h4>
          <p className="text-xs text-red-800">
            Bu işlem hastayı ana listeden kaldırır ve kaydı silinmiş olarak işaretler.
            Silinen hastalar daha sonra geri alınabilir. Fatura ve cihaz hareketleri
            kalmaya devam eder.
          </p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="inline-flex items-center rounded-md border border-red-300 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? 'Siliniyor...' : 'Hastayı Sil'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
