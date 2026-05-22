// src/features/patients/import/PatientRowFixModal.tsx
// Summary: Modal UI for fixing a single patient import staging row.
// It edits basic fields (full_name, national_id, phone), updates the staging row,
// and re-runs /api/patients-import-processor for the given job.

import { useState, FormEvent } from 'react';
import { supabaseClient } from '../../../utils/supabaseClient';
import { getAuthenticatedJsonHeaders } from '../../../utils/apiAuthHeaders';
import type { PatientsImportRow } from './types';

type PatientRowFixModalProps = {
  row: PatientsImportRow;
  jobId: string;
  onClose: () => void;
  onFixed: () => void; // called after processor finishes
};

export function PatientRowFixModal({
  row,
  jobId,
  onClose,
  onFixed,
}: PatientRowFixModalProps) {
  const raw = row.raw_row || {};

  const [fullName, setFullName] = useState<string>(
    String(raw.full_name ?? '') || '',
  );
  const [nationalId, setNationalId] = useState<string>(
    String(raw.national_id ?? '') || '',
  );
  const [phone, setPhone] = useState<string>(
    String(raw.phone ?? '') || '',
  );

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string | null {
    if (!fullName.trim()) return 'Ad Soyad zorunludur.';
    const tc = nationalId.trim();
    if (tc && !/^\d{11}$/.test(tc)) {
      return 'T.C. Kimlik No 11 haneli olmalıdır (veya boş bırakın).';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }

    setIsSubmitting(true);
    try {
      const newRawRow = {
        ...raw,
        full_name: fullName.trim(),
        national_id: nationalId.trim() || null,
        phone: phone.trim(),
      };

      // 1) Update staging row to pending so the processor can re-validate/import it.
      const { error: updateError } = await supabaseClient
        .from('patients_import_rows')
        .update({
          raw_row: newRawRow,
          status: 'pending',
          normalized_payload: null,
          error_message: null,
          validated_at: null,
          imported_at: null,
          // leave duplicate_of_patient_id as is; processor will recalc if needed
        })
        .eq('id', row.id);

      if (updateError) {
        setSubmitError(
          'Staging satırı güncellenemedi: ' + updateError.message,
        );
        setIsSubmitting(false);
        return;
      }

      // 2) Re-run the import processor for this job
      const response = await fetch('/api/patients-import-processor', {
        method: 'POST',
        headers: await getAuthenticatedJsonHeaders(),
        body: JSON.stringify({ job_id: jobId }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          (body && body.error) ||
          `patients-import-processor failed with status ${response.status}`;
        setSubmitError(msg);
        setIsSubmitting(false);
        return;
      }

      onFixed();
      onClose();
    } catch (err) {
      setSubmitError(
        (err as Error)?.message || 'Patient row fix request failed.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h2 className="text-sm font-semibold text-slate-900">
          Hasta satırını düzelt (row #{row.row_index})
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Sadece temel alanları (Ad Soyad, T.C., Telefon) düzenleyip bu job
          için hasta import işlemini tekrar çalıştıracağız.
        </p>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-[11px]">
          <div className="space-y-1">
            <label className="block font-semibold text-slate-800">
              Ad Soyad
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Zorunlu"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-semibold text-slate-800">
              T.C. Kimlik No
            </label>
            <input
              type="text"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Opsiyonel veya 11 hane"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-semibold text-slate-800">
              Telefon
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Telefon"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Not: Telefon formatı, var olan hasta import pipeline&apos;ındaki
              kurallara göre normalize edilir.
            </p>
          </div>

          {submitError && (
            <div className="rounded-md bg-red-50 p-2 text-[10px] text-red-700">
              {submitError}
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Düzelt ve tekrar import et'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
