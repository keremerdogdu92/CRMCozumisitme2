// src/features/patients/components/detail/PatientDetailInfoTab.tsx
// Summary: Patient detail drawer "Info" tab showing identity, contact, reference and archive info.
// Integrations:
// - Uses patientFormatUtils.formatDate for consistent date formatting.
// - Supports soft delete + restore actions via optional callbacks.
// - Supports editing personal info with collapsible edit section.
// Security notes:
// - The tab does not directly mutate DB; it calls provided callbacks (which should use RPCs).

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PatientRow } from '../../types';
import { formatDate } from '../../patientFormatUtils';
import { updatePatientPersonalInfo } from '../../api/api.patients.update';
import { PATIENTS_QUERY_KEY } from '../../api/api.core';

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
  const queryClient = useQueryClient();

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState(patient.full_name || '');
  const [phone, setPhone] = useState(patient.phone || '');
  const [nationalId, setNationalId] = useState(patient.national_id || '');
  const [kinPhone, setKinPhone] = useState(patient.kin_phone || '');
  const [address, setAddress] = useState(patient.address || '');
  const [archiveCode, setArchiveCode] = useState(patient.archive_code || '');
  const [satisfaction10, setSatisfaction10] = useState(
    patient.satisfaction_10 != null ? String(patient.satisfaction_10) : '',
  );
  const [createdAt, setCreatedAt] = useState(
    patient.created_at ? new Date(patient.created_at).toISOString().split('T')[0] : '',
  );

  const referenceDisplay =
    patient.reference_name && patient.reference_name.trim().length > 0
      ? patient.reference_name
      : '-';

  const satisfactionDisplay =
    patient.satisfaction_10 != null ? `${patient.satisfaction_10} / 10` : '-';

  const isDeleted = !!patient.deleted_at;

  const handleEditClick = () => {
    setIsEditing(!isEditing);
    setEditError(null);
    // Reset form to current patient data when opening edit
    if (!isEditing) {
      setFullName(patient.full_name || '');
      setPhone(patient.phone || '');
      setNationalId(patient.national_id || '');
      setKinPhone(patient.kin_phone || '');
      setAddress(patient.address || '');
      setArchiveCode(patient.archive_code || '');
      setSatisfaction10(
        patient.satisfaction_10 != null ? String(patient.satisfaction_10) : '',
      );
      setCreatedAt(
        patient.created_at ? new Date(patient.created_at).toISOString().split('T')[0] : '',
      );
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setEditError(null);

    try {
      await updatePatientPersonalInfo({
        id: patient.id,
        fullName,
        phone,
        nationalId,
        kinPhone,
        address,
        archiveCode,
        satisfaction10,
        createdAt,
      });

      // Invalidate queries to refresh patient data
      await queryClient.invalidateQueries({ queryKey: [PATIENTS_QUERY_KEY] });

      setIsEditing(false);
      setIsSaving(false);
    } catch (err) {
      console.error('Failed to update patient personal info:', err);
      setEditError(
        err instanceof Error ? err.message : 'Güncelleme sırasında bir hata oluştu.',
      );
      setIsSaving(false);
    }
  };

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
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase text-slate-500">
            Özlük Bilgileri
          </h4>
          {!isDeleted && (
            <div className="flex items-center gap-2">
              {isEditing && (
                <>
                  <button
                    type="button"
                    onClick={handleEditClick}
                    disabled={isSaving}
                    className="text-xs font-medium text-slate-600 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-md bg-primary-600 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </>
              )}
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Düzenle
                </button>
              )}
            </div>
          )}
        </div>

        {editError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {editError}
          </div>
        )}

        <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
          {/* Ad Soyad */}
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Ad Soyad</span>
            {isEditing ? (
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Ad Soyad"
              />
            ) : (
              <span className="text-sm font-medium text-slate-900">
                {patient.full_name}
              </span>
            )}
          </div>

          {/* Telefon */}
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Telefon</span>
            {isEditing ? (
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Telefon"
              />
            ) : (
              <span className="text-sm text-slate-900">{patient.phone ?? '-'}</span>
            )}
          </div>

          {/* Kayıt Tarihi */}
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Kayıt Tarihi</span>
            {isEditing ? (
              <input
                type="date"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            ) : (
              <span className="text-sm text-slate-900">
                {formatDate(patient.created_at)}
              </span>
            )}
          </div>

          {/* Son Görüşme - read-only */}
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Son Görüşme</span>
            <span className="text-sm text-slate-900">
              {formatDate(patient.last_visit_at)}
            </span>
          </div>

          {/* Referans - read-only */}
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Referans</span>
            <span className="text-sm text-slate-900">{referenceDisplay}</span>
          </div>

          {/* Memnuniyet */}
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Memnuniyet (1–10)</span>
            {isEditing ? (
              <input
                type="number"
                min="1"
                max="10"
                value={satisfaction10}
                onChange={(e) => setSatisfaction10(e.target.value)}
                className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="1-10"
              />
            ) : (
              <span className="text-sm text-slate-900">{satisfactionDisplay}</span>
            )}
          </div>

          {/* Arşiv Kodu */}
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Arşiv Kodu</span>
            {isEditing ? (
              <input
                type="text"
                value={archiveCode}
                onChange={(e) => setArchiveCode(e.target.value)}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Arşiv Kodu"
              />
            ) : (
              <span className="text-sm text-slate-900">
                {patient.archive_code ?? '-'}
              </span>
            )}
          </div>

          {/* T.C. Kimlik No */}
          <div className="flex justify-between gap-2 pt-1">
            <span className="text-xs text-slate-500">T.C. Kimlik No</span>
            {isEditing ? (
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="T.C. Kimlik No"
              />
            ) : (
              <span className="text-sm text-slate-900">
                {patient.national_id ?? '-'}
              </span>
            )}
          </div>

          {/* Yakın Telefonu */}
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">Yakın Telefonu</span>
            {isEditing ? (
              <input
                type="text"
                value={kinPhone}
                onChange={(e) => setKinPhone(e.target.value)}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Yakın Telefonu"
              />
            ) : (
              <span className="text-sm text-slate-900">{patient.kin_phone ?? '-'}</span>
            )}
          </div>

          {/* Adres */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Adres</span>
            {isEditing ? (
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Adres"
              />
            ) : (
              <span className="whitespace-pre-line text-sm text-slate-900">
                {patient.address && patient.address.trim().length > 0
                  ? patient.address
                  : '-'}
              </span>
            )}
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
