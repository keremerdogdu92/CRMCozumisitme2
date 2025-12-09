// src/features/patients/import/LegacyDeviceRowFixModal.tsx
// Summary: Modal UI for fixing a single legacy device staging row.
// User selects a patient (by national_id) and an ear_side (R/L/Çift),
// then the modal calls the manual-linker API to create devices + patient_devices.

import { useState, FormEvent } from 'react';
import { supabaseClient } from '../../../utils/supabaseClient';
import type { LegacyDevicesImportRow } from './types';
import type { PatientRow } from '../types';

type LegacyDeviceRowFixModalProps = {
  row: LegacyDevicesImportRow;
  onClose: () => void;
  onFixed: () => void; // Called when row is successfully imported
};

type EarSideOption = 'R' | 'L' | 'Çift';

const EAR_SIDE_OPTIONS: EarSideOption[] = ['R', 'L', 'Çift'];

export function LegacyDeviceRowFixModal({
  row,
  onClose,
  onFixed,
}: LegacyDeviceRowFixModalProps) {
  // raw_row is the original CSV row; normalized_payload is usually null for errors.
  const raw = row.raw_row || {};

  const [nationalId, setNationalId] = useState<string>(
    String(raw.patient_national_id ?? '') || '',
  );
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(
    null,
  );
  const [earSide, setEarSide] = useState<EarSideOption | ''>('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brand = String(raw.device_brand ?? '');
  const model = String(raw.device_model ?? '');
  const soldAt = String(raw.sold_at ?? '');
  const devicePrice = String(raw.device_price ?? '');
  const rawEarSide = String(raw.ear_side ?? '');

  async function handleSearchPatient(e: FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setSelectedPatient(null);

    const trimmed = nationalId.trim();
    if (!trimmed) {
      setSearchError('Lütfen T.C. Kimlik No girin.');
      return;
    }
    if (!/^\d{11}$/.test(trimmed)) {
      setSearchError('T.C. Kimlik No 11 haneli olmalıdır.');
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabaseClient
        .from('patients')
        .select('id, full_name, national_id, phone, created_at')
        .eq('national_id', trimmed)
        .limit(1);

      if (error) {
        setSearchError('Hasta araması başarısız: ' + error.message);
        return;
      }

      if (!data || data.length === 0) {
        setSearchError('Bu T.C. Kimlik No ile kayıtlı hasta bulunamadı.');
        return;
      }

      setSelectedPatient(data[0] as PatientRow);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedPatient) {
      setSubmitError('Önce bir hasta seçmelisiniz.');
      return;
    }
    if (!earSide) {
      setSubmitError('Kulak tarafını (R / L / Çift) seçmelisiniz.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        '/api/legacy-patient-devices-manual-linker',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staging_row_id: row.id,
            patient_id: selectedPatient.id,
            ear_side: earSide,
          }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          (body && body.error) ||
          `Manual linker failed with status ${response.status}`;
        setSubmitError(msg);
        return;
      }

      onFixed();
      onClose();
    } catch (err) {
      setSubmitError(
        (err as Error)?.message ||
          'Legacy device manual link request failed.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
        <h2 className="text-sm font-semibold text-slate-900">
          Legacy cihaz satırını düzelt (row #{row.row_index})
        </h2>

        <p className="mt-1 text-[11px] text-slate-500">
          Bu satırdaki cihazı bir hastaya manuel bağlayıp gerçek{' '}
          <code className="bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
            devices
          </code>{' '}
          ve{' '}
          <code className="bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
            patient_devices
          </code>{' '}
          kayıtları oluşturacağız.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 rounded-md bg-slate-50 p-2 text-[11px] text-slate-800 sm:grid-cols-2">
          <div>
            <div>
              <span className="font-semibold">Marka:</span> {brand || '-'}
            </div>
            <div>
              <span className="font-semibold">Model:</span> {model || '-'}
            </div>
            <div>
              <span className="font-semibold">CSV ear_side:</span>{' '}
              {rawEarSide || '-'}
            </div>
          </div>
          <div>
            <div>
              <span className="font-semibold">Satış tarihi (CSV):</span>{' '}
              {soldAt || '-'}
            </div>
            <div>
              <span className="font-semibold">Satır toplam fiyatı:</span>{' '}
              {devicePrice || '-'}
            </div>
            <div>
              <span className="font-semibold">Job ID:</span> {row.job_id}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-[11px]">
          <div className="space-y-1">
            <label className="block font-semibold text-slate-800">
              Hasta T.C. Kimlik No
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="11 haneli T.C."
              />
              <button
                type="button"
                onClick={handleSearchPatient}
                disabled={isSearching || !nationalId.trim()}
                className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSearching ? 'Aranıyor...' : 'Hasta bul'}
              </button>
            </div>
            {searchError && (
              <p className="mt-1 text-[10px] text-red-600">{searchError}</p>
            )}
            {selectedPatient && (
              <div className="mt-1 rounded-md bg-emerald-50 p-2 text-[10px] text-emerald-900">
                <div className="font-semibold">
                  Seçilen hasta: {selectedPatient.full_name}
                </div>
                <div>
                  T.C.: {selectedPatient.national_id ?? '-'} | Tel:{' '}
                  {selectedPatient.phone ?? '-'}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block font-semibold text-slate-800">
              Kulak tarafı (ear_side)
            </label>
            <select
              value={earSide}
              onChange={(e) =>
                setEarSide(e.target.value as EarSideOption | '')
              }
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Seçin...</option>
              {EAR_SIDE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'R'
                    ? 'R (Right / Sağ)'
                    : opt === 'L'
                      ? 'L (Left / Sol)'
                      : 'Çift (2 cihaz – sol & sağ)'}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-500">
              Not: Manuel linker &apos;Tek&apos; değerini desteklemiyor; tek
              cihazı hangi kulakta olduğunu biliyorsanız R veya L seçin.
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
              {isSubmitting ? 'Kaydediliyor...' : 'Düzelt ve içeri al'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
