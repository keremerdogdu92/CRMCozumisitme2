// src/pages/ReferencesPage.tsx
// Summary: References page: list, inline create form and detail drawer orchestration.
// Integrations:
// - React Query: fetch references list with SoftDeleteMode support (active/deleted/all).
// - Table preferences: uses the same bucket as ReferencesTable to read UI toggle visibility.
// - Deep link: focusId query param (/references?focusId=<uuid>) forces mode "all".
//
// Patch v2.6.0 (2025-12-29):
// - CHANGE: SoftDeleteMode filter visibility is controlled by table preferences UI toggle:
//   state.ui.showSoftDeleteFilter (toggled from Columns dropdown inside ReferencesTable).
// - CHANGE: Align preferences tableId with ReferencesTable ("references") to share the same bucket.
// - KEEP: focusId forces effectiveDeleteMode = 'all' to ensure deleted rows are visible.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ReferenceNewFormCard } from '../features/references/ReferenceNewFormCard';
import { ReferencesTable } from '../features/references/ReferencesTable';
import { ReferenceDetailDrawer } from '../features/references/ReferenceDetailDrawer';
import {
  fetchReferences,
  createReference,
  REFERENCES_QUERY_KEY,
} from '../features/references/api';
import type { NewReferenceForm, ReferenceRow, SoftDeleteMode } from '../features/references/types';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';
import { SoftDeleteModeFilter } from '../components/table/SoftDeleteModeFilter';
import { useTablePreferences } from '../components/table/useTablePreferences';
import {
  REFERENCE_COLUMNS,
  REFERENCES_TABLE_ID,
  REFERENCES_UI_FLAG_SHOW_SOFT_DELETE_FILTER,
} from '../features/references/ReferencesTable';

const initialFormState: NewReferenceForm = {
  fullName: '',
  group: '',
  phone: '',
  commissionScheme: null,
  commissionPercent: 0,
  commissionFixed: 0,
  contactIntervalDays: '',
  lastMeetAt: '',
  nextMeetAt: '',
  note: '',
  isActive: true,
};

export default function ReferencesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formState, setFormState] = useState<NewReferenceForm>(initialFormState);
  const [detailRef, setDetailRef] = useState<ReferenceRow | null>(null);

  // Admin-only list filter
  const [deleteMode, setDeleteMode] = useState<SoftDeleteMode>('active');

  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const userId = profile?.id ?? null;

  // Shared prefs bucket with ReferencesTable, so Columns dropdown UI toggles affect this page.
  const { isUiFlagEnabled } = useTablePreferences<ReferenceRow>(
    REFERENCES_TABLE_ID,
    REFERENCE_COLUMNS,
    userId,
  );

  const showSoftDeleteFilter = isUiFlagEnabled(
    REFERENCES_UI_FLAG_SHOW_SOFT_DELETE_FILTER,
    true,
  );

  // Meetings deep-link support: /references?focusId=<referenceId>
  const focusId = searchParams.get('focusId');

  const effectiveDeleteMode: SoftDeleteMode = focusId ? 'all' : deleteMode;

  const { data, isLoading, isError } = useQuery({
    queryKey: REFERENCES_QUERY_KEY(effectiveDeleteMode),
    queryFn: () => fetchReferences(effectiveDeleteMode),
    enabled: !!profile && profile.role === 'admin',
  });

  const createMutation = useMutation({
    mutationFn: createReference,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: REFERENCES_QUERY_KEY(effectiveDeleteMode),
      });
      setFormState(initialFormState);
      setShowCreateForm(false);
    },
  });

  const references = data ?? [];

  const filtered = useMemo(() => {
    return references.filter((r) => {
      if (focusId) {
        return r.id === focusId;
      }

      const term = search.trim().toLowerCase();
      if (!term) return true;

      return (r.full_name ?? '').toLowerCase().includes(term);
    });
  }, [references, focusId, search]);

  const mutationError =
    (createMutation.error as Error | null | undefined)?.message ?? '';

  if (profileLoading || isLoading) {
    return (
      <div className="p-8 text-sm text-slate-500">Referanslar yükleniyor...</div>
    );
  }

  // Only admins can see this page
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="p-8 text-sm text-slate-500">
        Bu sayfa sadece yöneticilere özeldir. Referans listesi, komisyon ayarları
        ve takip hatırlatmalarına yalnızca yönetici hesapları erişebilir.
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-red-600">
        Referans verileri alınırken bir hata oluştu. Lütfen Supabase bağlantısını
        ve RLS ayarlarını kontrol edin.
      </div>
    );
  }

  const totalCount = references.length;

  return (
    <div className="space-y-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Referanslar</h2>
          <p className="mt-1 text-xs text-slate-500">Toplam {totalCount} kayıt</p>
          {focusId && (
            <p className="mt-1 text-[11px] text-primary-700">
              Görüşmeden gelindi. Sadece seçilen referans kaydı gösteriliyor.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Soft delete mode filter (visibility controlled via table prefs UI toggle) */}
          {!focusId && showSoftDeleteFilter && (
            <SoftDeleteModeFilter
              value={deleteMode}
              onChange={setDeleteMode}
              className="w-full sm:w-auto"
            />
          )}

          <input
            type="text"
            placeholder="İsim veya kurum ile ara..."
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
            {showCreateForm ? 'Formu Kapat' : 'Yeni Referans'}
          </button>
        </div>
      </div>

      {/* New reference form card */}
      {showCreateForm && (
        <ReferenceNewFormCard
          open={showCreateForm}
          onToggle={() => setShowCreateForm((prev) => !prev)}
          values={formState}
          onChange={(patch) =>
            setFormState((prev) => ({
              ...prev,
              ...patch,
            }))
          }
          onSubmit={() => createMutation.mutate({ ...formState })}
          isSubmitting={createMutation.isPending}
          errorMessage={
            createMutation.isError
              ? 'Kayıt sırasında bir hata oluştu. ' +
                (mutationError ? `Detay: ${mutationError}` : '')
              : undefined
          }
        />
      )}

      {/* References table */}
      <ReferencesTable
        items={filtered}
        onSelectRow={(r) => setDetailRef(r)}
        focusedId={focusId}
      />

      {/* Detail drawer */}
      <ReferenceDetailDrawer
        reference={detailRef}
        open={!!detailRef}
        onClose={() => setDetailRef(null)}
      />
    </div>
  );
}
