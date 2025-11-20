// src/pages/TrialsPage.tsx
// Trials (deneme hastaları) page: list, inline create form and detail drawer orchestration.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrialNewFormCard } from '../features/trials/TrialNewFormCard';
import { TrialsTable } from '../features/trials/TrialsTable';
import { TrialDetailDrawer } from '../features/trials/TrialDetailDrawer';
import { fetchTrials, createTrial, TRIALS_QUERY_KEY } from '../features/trials/api';
import type { NewTrialForm, TrialRow } from '../features/trials/types';

const initialFormState: NewTrialForm = {
  fullName: '',
  phone: '',
  firstMeetAt: '',
  nextMeetAt: '',
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

export default function TrialsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formState, setFormState] = useState<NewTrialForm>(initialFormState);
  const [detailTrial, setDetailTrial] = useState<TrialRow | null>(null);

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: TRIALS_QUERY_KEY,
    queryFn: fetchTrials,
  });

  const createMutation = useMutation({
    mutationFn: createTrial,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TRIALS_QUERY_KEY });
      setFormState(initialFormState);
      setShowCreateForm(false);
    },
  });

  const trials = data ?? [];

  const filteredTrials = trials.filter((t) => {
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
        Deneme verileri alınırken bir hata oluştu. Lütfen Supabase bağlantısını ve RLS
        ayarlarını kontrol edin.
      </div>
    );
  }

  const totalCount = trials.length;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Denemeler</h2>
          <p className="text-xs text-slate-500 mt-1">Toplam {totalCount} kayıt</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="İsim veya telefon ile ara..."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              ? 'Kayıt sırasında bir hata oluştu. ' +
                (mutationError ? `Detay: ${mutationError}` : '')
              : undefined
          }
        />
      )}

      {/* Trials table */}
      <TrialsTable items={filteredTrials} onSelectRow={(t) => setDetailTrial(t)} />

      {/* Detail drawer */}
      <TrialDetailDrawer
        trial={detailTrial}
        open={!!detailTrial}
        onClose={() => setDetailTrial(null)}
      />
    </div>
  );
}
