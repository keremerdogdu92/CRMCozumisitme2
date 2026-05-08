// src/pages/TrialsPage.tsx
// Summary: Trials (deneme) lead pipeline page: list, inline create form and detail drawer orchestration.
// Integrations:
// - React Query fetch via fetchTrials({ mode }) with soft delete visibility mode.
// - Lead pipeline status filter is client-side on the fetched dataset (status filter).
// - Soft delete mode filter is visible to all roles (admin + staff) because RLS allows org-scoped reads.
// - Deep-link support: /trials?focusId=<trialId> forces effective mode='all' to avoid hiding the target row.
//
// Patch v2.5 (soft delete filter visibility + unified filter bar):
// - CHANGE: SoftDeleteModeFilter is no longer admin-only; staff can also view deleted/all.
// - KEEP: focusId forces effectiveSoftDeleteMode='all'.
// - UI: Filters row now uses the same "toolbar container" format as PatientsPage.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { TrialNewFormCard } from '../features/trials/TrialNewFormCard';
import { TrialsTable } from '../features/trials/TrialsTable';
import { TrialDetailDrawer } from '../features/trials/TrialDetailDrawer';
import { fetchTrials, createTrial } from '../features/trials/api';
import type { NewTrialForm, TrialRow, TrialStatus } from '../features/trials/types';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';
import { SoftDeleteModeFilter } from '../components/table/SoftDeleteModeFilter';
import type { SoftDeleteMode } from '../utils/softDelete/softDeleteTypes';

const initialFormState: NewTrialForm = {
  fullName: '',
  phone: '',
  firstMeetAt: '',
  nextMeetAt: '',
  note: '',
  offerNote: '',
  devices: [
    {
      rowKey: 'row-0',
      side: '',
      brand: '',
      model: '',
      listPrice: '',
      quotePrice: '',
    },
  ],
};

type TrialStatusFilter = TrialStatus | 'all';

const TRIAL_STATUS_FILTER_OPTIONS: { value: TrialStatusFilter; label: string }[] =
  [
    { value: 'active', label: 'Aktif' },
    { value: 'converted', label: 'Dönüştü' },
    { value: 'lost', label: 'Kaybedildi' },
    { value: 'all', label: 'Hepsi' },
  ];

export default function TrialsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data: profile } = useCurrentProfile();
  void profile;

  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formState, setFormState] = useState<NewTrialForm>(initialFormState);
  const [detailTrial, setDetailTrial] = useState<TrialRow | null>(null);

  const [softDeleteMode, setSoftDeleteMode] = useState<SoftDeleteMode>('active');

  // Lead pipeline filter (client-side)
  const [statusFilter, setStatusFilter] = useState<TrialStatusFilter>('active');

  // Deep link support: /trials?focusId=<trialId>
  const focusId = searchParams.get('focusId');

  // If we deep-link to a specific row, do not accidentally hide it by soft-delete mode.
  const effectiveSoftDeleteMode: SoftDeleteMode = focusId ? 'all' : softDeleteMode;

  const queryKey = useMemo(
    () => ['trials', { softDeleteMode: effectiveSoftDeleteMode }] as const,
    [effectiveSoftDeleteMode],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchTrials({ mode: effectiveSoftDeleteMode }),
  });

  const createMutation = useMutation({
    mutationFn: createTrial,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trials'] });
      setFormState(initialFormState);
      setShowCreateForm(false);
    },
  });

  const trials = data ?? [];

  const filteredTrials = trials.filter((t) => {
    if (focusId) {
      return t.id === focusId;
    }

    // 1) Status filter
    if (statusFilter !== 'all' && t.status !== statusFilter) {
      return false;
    }

    // 2) Search filter
    const term = search.trim().toLowerCase();
    if (!term) return true;

    return (
      (t.full_name ?? '').toLowerCase().includes(term) ||
      (t.phone ?? '').toLowerCase().includes(term)
    );
  });

  const mutationError =
    (createMutation.error as Error | null | undefined)?.message ?? '';

  if (isLoading) {
    return <div className="p-8 text-sm text-slate-500">Denemeler yükleniyor...</div>;
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-red-600">
        Deneme verileri alınırken bir hata oluştu. Lütfen Supabase bağlantısını ve RLS ayarlarını kontrol edin.
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 sm:py-6 md:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Denemeler</h2>
          <p className="mt-1 text-xs text-slate-500">Toplam {trials.length} kayıt</p>
          {focusId && (
            <p className="mt-1 text-[11px] text-primary-700">
              Görüşmeden gelindi. Sadece seçilen deneme kaydı gösteriliyor.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="İsim veya telefon ile ara..."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!!focusId}
          />

          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {showCreateForm ? 'Formu Kapat' : 'Yeni Deneme'}
          </button>
        </div>
      </div>

      {/* Filters row (unified toolbar container like PatientsPage) */}
      <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 shadow-sm sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-y-0 sm:bg-slate-50">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 sm:text-xs">Durum:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TrialStatusFilter)}
              disabled={!!focusId}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
            >
              {TRIAL_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {focusId && (
              <span className="text-[11px] text-slate-400">
                (focusId aktifken filtreler kilitlidir)
              </span>
            )}
          </div>

          {/* Soft delete mode: visible for everyone (admin + staff) */}
          {!focusId ? (
            <SoftDeleteModeFilter value={softDeleteMode} onChange={setSoftDeleteMode} />
          ) : (
            <SoftDeleteModeFilter value={softDeleteMode} onChange={setSoftDeleteMode} className="opacity-60 pointer-events-none" />
          )}
        </div>

        {/* Reserved for future right-side toolbar actions if needed */}
        <div className="hidden sm:block" />
      </div>

      {/* New trial form card */}
      {showCreateForm && (
        <TrialNewFormCard
          open={showCreateForm}
          onToggle={() => setShowCreateForm((prev) => !prev)}
          values={formState}
          onChange={(patch) =>
            setFormState((prev) => ({
              ...prev,
              ...patch,
            }))
          }
          onSubmit={() => createMutation.mutate(formState)}
          isSubmitting={createMutation.isPending}
          errorMessage={
            createMutation.isError
              ? 'Kayıt sırasında bir hata oluştu. ' + (mutationError ? `Detay: ${mutationError}` : '')
              : undefined
          }
        />
      )}

      {/* Trials table */}
      <TrialsTable
        items={filteredTrials}
        onSelectRow={(t) => setDetailTrial(t)}
        focusedId={focusId}
        toolbarRight={null}
      />

      {/* Detail drawer */}
      <TrialDetailDrawer trial={detailTrial} open={!!detailTrial} onClose={() => setDetailTrial(null)} />
    </div>
  );
}
