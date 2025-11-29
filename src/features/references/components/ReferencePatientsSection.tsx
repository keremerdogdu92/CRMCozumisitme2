// src/features/references/components/ReferencePatientsSection.tsx
// Summary: Patients tab content for reference detail drawer: patients and trial patients tables.

import React from 'react';
import type { TrialRow } from '../../trials/types';
import type { PatientForReference } from '../../patients/api';

type ReferencePatientsSectionProps = {
  patientsForReference: PatientForReference[];
  trialsForReference: TrialRow[];
  isLoadingPatients: boolean;
  isLoadingTrials: boolean;
  isPatientsError: boolean;
  isTrialsError: boolean;
};

export const ReferencePatientsSection: React.FC<ReferencePatientsSectionProps> =
  ({
    patientsForReference,
    trialsForReference,
    isLoadingPatients,
    isLoadingTrials,
    isPatientsError,
    isTrialsError,
  }) => {
    const showLoading = isLoadingPatients || isLoadingTrials;
    const showError =
      (isPatientsError || isTrialsError) &&
      !isLoadingPatients &&
      !isLoadingTrials;
    const showEmpty =
      !isLoadingPatients &&
      !isLoadingTrials &&
      !isPatientsError &&
      !isTrialsError &&
      patientsForReference.length === 0 &&
      trialsForReference.length === 0;

    return (
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Hastalar
        </h4>

        {showLoading && (
          <p className="text-xs text-slate-500">Kayıtlar yükleniyor...</p>
        )}

        {showError && (
          <p className="text-xs text-red-600">
            Bu referansa bağlı kayıtlar yüklenirken bir hata oluştu.
          </p>
        )}

        {showEmpty && (
          <p className="text-xs text-slate-500">
            Bu referansa bağlı hasta veya deneme kaydı henüz yok.
          </p>
        )}

        {/* Kalıcı hastalar listesi */}
        {!isLoadingPatients &&
          !isPatientsError &&
          patientsForReference.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-[11px] font-semibold text-slate-600">
                Hastalar
              </h5>
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        #
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        Kayıt
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        Ad Soyad
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        Telefon
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        Son Görüşme
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...patientsForReference]
                      .sort((a, b) =>
                        b.created_at.localeCompare(a.created_at),
                      )
                      .map((p, idx) => (
                        <tr
                          key={p.id}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-1.5 text-slate-700">
                            {idx + 1}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                            {new Date(
                              p.created_at,
                            ).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-800">
                            {p.full_name}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                            {p.phone ?? '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                            {p.last_visit_at
                              ? new Date(
                                  p.last_visit_at,
                                ).toLocaleDateString('tr-TR')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">
                Toplam hasta:{' '}
                <span className="font-semibold">
                  {patientsForReference.length}
                </span>
              </p>
            </div>
          )}

        {/* Deneme hastaları listesi */}
        {!isLoadingTrials &&
          !isTrialsError &&
          trialsForReference.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-[11px] font-semibold text-slate-600">
                Deneme Hastaları
              </h5>
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        #
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        Kayıt
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        Ad Soyad
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        Telefon
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        İlk Görüşme
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        Sonraki Randevu
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...trialsForReference]
                      .sort((a, b) =>
                        b.created_at.localeCompare(a.created_at),
                      )
                      .map((t, idx) => (
                        <tr
                          key={t.id}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-1.5 text-slate-700">
                            {idx + 1}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                            {t.created_at
                              ? new Date(
                                  t.created_at,
                                ).toLocaleDateString('tr-TR')
                              : '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-800">
                            {t.full_name ?? '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                            {t.phone ?? '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                            {t.first_meet_at
                              ? new Date(
                                  t.first_meet_at,
                                ).toLocaleDateString('tr-TR')
                              : '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                            {t.next_meet_at
                              ? new Date(
                                  t.next_meet_at,
                                ).toLocaleDateString('tr-TR')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">
                Toplam deneme hastası:{' '}
                <span className="font-semibold">
                  {trialsForReference.length}
                </span>
              </p>
            </div>
          )}

        <p className="text-[11px] text-slate-500">
          İleride denemeden kalıcı hastaya dönüşen kayıtlar, trial tablosunda
          ayrıca işaretlenerek bu alt listeden otomatik çıkarılabilir. Şu anda
          tüm deneme kayıtları gösterilmektedir.
        </p>
      </section>
    );
  };
