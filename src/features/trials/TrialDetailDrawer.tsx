// src/features/trials/TrialDetailDrawer.tsx
// Summary: Read-only detail drawer for a trial lead pipeline row, with tabs and printable offer sheet.
// Integrations:
// - Fetches trial_devices_with_catalog_public for printable offer and device list.
// - Fetches reference lite for display.
// - Fetches meetings by trial for timeline visibility.
// - Uses org settings in print.
// - Supports soft delete / restore actions via shared SoftDeleteRowActionButton + ./api RPC wrappers.
//   * Invalidates TRIALS_QUERY_KEY and closes drawer to avoid stale local trial prop.
//
// Patch v2.2 (detail soft delete actions):
// - ADD: "Sil / Geri getir" action in Summary tab (below status help text area).
// - ADD: Mutations for soft delete / restore (confirm + optional prompt for reason).
// - Invalidate trials query on success; close drawer after success to refresh parent selection.

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { SideDrawer } from '../../components/layout/SideDrawer';
import type { TrialRow, TrialDeviceRow, TrialStatus } from './types';
import {
  fetchTrialDevicesByTrialId,
  TRIAL_DEVICES_BY_TRIAL_QUERY_KEY,
  TRIALS_QUERY_KEY,
  softDeleteTrial,
  restoreTrial,
  updateTrialInfo,
} from './api';
import { openTrialOfferPrint } from './printTrialOffer';
import {
  fetchReferenceLiteById,
  type ReferenceLiteForTrial,
} from '../references/api';
import type { MeetingRow } from '../meetings/types';
import {
  MEETINGS_BY_TRIAL_QUERY_KEY,
  fetchMeetingsByTrialId,
} from '../meetings/api';
import { useOrgSettings } from '../settings/useOrgSettings';
import { SoftDeleteRowActionButton } from '../../components/softDelete/SoftDeleteRowActionButton';

type TrialDetailDrawerProps = {
  trial: TrialRow | null;
  open: boolean;
  onClose: () => void;
};

type TrialTabId = 'summary' | 'devices' | 'meetings';

function formatPrice(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount as number)) return '-';
  try {
    const n = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(n)) return `${amount}`;
    return n.toLocaleString('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    });
  } catch {
    return `${amount}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return '-';
  }
}

function getStatusLabel(status: TrialStatus): string {
  if (status === 'converted') return 'Dönüştü';
  if (status === 'lost') return 'Kaybedildi';
  return 'Aktif';
}

function getStatusBadgeClass(status: TrialStatus): string {
  if (status === 'converted') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }
  if (status === 'lost') {
    return 'bg-rose-50 text-rose-700 border border-rose-200';
  }
  return 'bg-slate-50 text-slate-700 border border-slate-200';
}

/**
 * Trial cihaz satırında marka/model dolu mu kontrolü.
 * Boş satırlar hasta formuna taşınmaz.
 */
function hasBrandOrModel(d: TrialDeviceRow): boolean {
  const brand = d.brand?.trim() ?? '';
  const model = d.model?.trim() ?? '';
  return brand.length > 0 || model.length > 0;
}

/**
 * Trial'daki side değerini normalize eder.
 * - 'both' / 'bilateral' özel olarak kullanılır (split için).
 * - Diğerleri küçük harfe çekilir.
 */
function normalizeTrialSide(raw: string | null): string {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'both' || s === 'bilateral') return 'both';
  if (s === 'right' || s === 'left') return s;
  return '';
}

export function TrialDetailDrawer({ trial, open, onClose }: TrialDetailDrawerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TrialTabId>('summary');
  const [includeDetailsForPrint, setIncludeDetailsForPrint] =
    useState<boolean>(true);

  // "Hastaya dönüştür" seçim modali state'i
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

  // Soft delete busy indicator (drawer scope)
  const [pendingAction, setPendingAction] = useState<'soft_delete' | 'restore' | null>(
    null,
  );

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState(trial?.full_name || '');
  const [phone, setPhone] = useState(trial?.phone || '');
  const [firstMeetAt, setFirstMeetAt] = useState(
    trial?.first_meet_at ? new Date(trial.first_meet_at).toISOString().slice(0, 16) : '',
  );
  const [nextMeetAt, setNextMeetAt] = useState(
    trial?.next_meet_at ? new Date(trial.next_meet_at).toISOString().slice(0, 16) : '',
  );
  const [note, setNote] = useState(trial?.note || '');
  const [offerNote, setOfferNote] = useState(trial?.offer_note || '');
  const [createdAt, setCreatedAt] = useState(
    trial?.created_at ? new Date(trial.created_at).toISOString().split('T')[0] : '',
  );

  // Org ayarları (logo, firma adı, iletişim bilgileri, watermark)
  const { data: orgSettings } = useOrgSettings();

  const trialId = trial?.id ?? null;

  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    isError: isDevicesError,
  } = useQuery({
    queryKey: TRIAL_DEVICES_BY_TRIAL_QUERY_KEY(trialId ?? 'none'),
    queryFn: () => fetchTrialDevicesByTrialId(trialId as string),
    enabled: !!trialId && open,
  });

  const referenceId = trial?.reference_id ?? null;

  const {
    data: referenceLite,
    isLoading: isReferenceLoading,
    isError: isReferenceError,
  } = useQuery<ReferenceLiteForTrial | null>({
    queryKey: ['reference-lite-by-id', referenceId],
    queryFn: () => fetchReferenceLiteById(referenceId as string),
    enabled: !!referenceId && open,
  });

  const {
    data: meetings = [],
    isLoading: isMeetingsLoading,
    isError: isMeetingsError,
    error: meetingsError,
  } = useQuery<MeetingRow[]>({
    queryKey: MEETINGS_BY_TRIAL_QUERY_KEY(trialId ?? 'none'),
    queryFn: () => fetchMeetingsByTrialId(trialId as string),
    enabled: !!trialId && open,
  });

  const softDeleteMutation = useMutation<void, Error, { id: string; reason: string | null }>({
    mutationFn: async ({ id, reason }) => {
      setPendingAction('soft_delete');
      try {
        await softDeleteTrial(id, reason);
      } finally {
        setPendingAction(null);
      }
    },
    onSuccess: () => {
      // Invalidate list so parent refetches fresh row (deleted_at, etc.)
      queryClient.invalidateQueries({ queryKey: TRIALS_QUERY_KEY });
      // Close drawer to avoid stale "trial" prop being displayed after mutation.
      onClose();
    },
  });

  const restoreMutation = useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      setPendingAction('restore');
      try {
        await restoreTrial(id);
      } finally {
        setPendingAction(null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIALS_QUERY_KEY });
      onClose();
    },
  });

  const handleEditClick = () => {
    setIsEditing(!isEditing);
    setEditError(null);
    // Reset form to current trial data when opening edit
    if (!isEditing && trial) {
      setFullName(trial.full_name || '');
      setPhone(trial.phone || '');
      setFirstMeetAt(
        trial.first_meet_at ? new Date(trial.first_meet_at).toISOString().slice(0, 16) : '',
      );
      setNextMeetAt(
        trial.next_meet_at ? new Date(trial.next_meet_at).toISOString().slice(0, 16) : '',
      );
      setNote(trial.note || '');
      setOfferNote(trial.offer_note || '');
      setCreatedAt(
        trial.created_at ? new Date(trial.created_at).toISOString().split('T')[0] : '',
      );
    }
  };

  const handleSave = async () => {
    if (!trial) return;

    setIsSaving(true);
    setEditError(null);

    try {
      await updateTrialInfo({
        id: trial.id,
        fullName,
        phone,
        firstMeetAt: firstMeetAt ? new Date(firstMeetAt).toISOString() : null,
        nextMeetAt: nextMeetAt ? new Date(nextMeetAt).toISOString() : null,
        note,
        offerNote,
        createdAt,
      });

      // Invalidate queries to refresh trial data
      await queryClient.invalidateQueries({ queryKey: TRIALS_QUERY_KEY });

      // Close drawer so user sees updated data in the list
      onClose();
    } catch (err) {
      console.error('Failed to update trial info:', err);
      setEditError(
        err instanceof Error ? err.message : 'Güncelleme sırasında bir hata oluştu.',
      );
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (open && trial) {
      setActiveTab('summary');
      setIncludeDetailsForPrint(true);
      setConvertModalOpen(false);
      setSelectedDeviceIds([]);
      setPendingAction(null);
      setIsEditing(false);
      setEditError(null);
      // Reset form state
      setFullName(trial.full_name || '');
      setPhone(trial.phone || '');
      setFirstMeetAt(
        trial.first_meet_at ? new Date(trial.first_meet_at).toISOString().slice(0, 16) : '',
      );
      setNextMeetAt(
        trial.next_meet_at ? new Date(trial.next_meet_at).toISOString().slice(0, 16) : '',
      );
      setNote(trial.note || '');
      setOfferNote(trial.offer_note || '');
      setCreatedAt(
        trial.created_at ? new Date(trial.created_at).toISOString().split('T')[0] : '',
      );
    }
  }, [open, trialId, trial]);

  if (!trial) {
    return null;
  }

  const typedDevices = devices as TrialDeviceRow[];
  const typedMeetings = meetings as MeetingRow[];

  const tabs: { id: TrialTabId; label: string }[] = [
    { id: 'summary', label: 'Özet' },
    { id: 'devices', label: 'Deneme Cihazları' },
    { id: 'meetings', label: 'Görüşmeler' },
  ];

  const isSoftDeleted = !!trial.deleted_at;
  const isConvertible = !isSoftDeleted && trial.status === 'active';

  const isBusy = pendingAction != null || softDeleteMutation.isPending || restoreMutation.isPending;

  const handlePrintOffer = () => {
    if (typedDevices.length === 0) return;

    openTrialOfferPrint(trial, typedDevices, orgSettings ?? null, {
      includeDeviceDetails: includeDetailsForPrint,
    });
  };

  const handleSoftDeleteClick = () => {
    if (!trial?.id) return;

    const ok = window.confirm('Bu deneme kaydını silmek (soft delete) istiyor musunuz?');
    if (!ok) return;

    const reasonRaw = window.prompt('Silme nedeni (opsiyonel):', '');
    const reason = (reasonRaw ?? '').trim();
    softDeleteMutation.mutate({ id: trial.id, reason: reason.length ? reason : null });
  };

  const handleRestoreClick = () => {
    if (!trial?.id) return;

    const ok = window.confirm('Bu deneme kaydını geri getirmek istiyor musunuz?');
    if (!ok) return;

    restoreMutation.mutate({ id: trial.id });
  };

  /**
   * "Hastaya dönüştür" modali aç.
   * Varsayılan olarak marka/model dolu tüm satırları seçili yap.
   */
  const handleOpenConvertModal = () => {
    if (!isConvertible) {
      return;
    }

    if (!trial || typedDevices.length === 0) {
      setSelectedDeviceIds([]);
      setConvertModalOpen(true);
      return;
    }

    const defaultSelected = typedDevices
      .filter((d) => hasBrandOrModel(d))
      .map((d) => d.id);

    setSelectedDeviceIds(defaultSelected);
    setConvertModalOpen(true);
  };

  const toggleDeviceSelected = (id: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleAllSelectable = () => {
    const selectable = typedDevices
      .filter((d) => hasBrandOrModel(d))
      .map((d) => d.id);

    const allSelected =
      selectable.length > 0 &&
      selectable.every((id) => selectedDeviceIds.includes(id));

    if (allSelected) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(selectable);
    }
  };

  /**
   * Modal içindeki "Hastaya dönüştür" onayı.
   * Seçilen satırlar:
   * - side === 'both' / 'bilateral' → 2 satır (right + left)
   * - side === 'right' / 'left' → tek satır
   * - diğer → side: ''
   */
  const handleConfirmConvertToPatient = () => {
    if (!trial) return;
    if (!isConvertible) return;

    const fromTrial = {
      trialId: trial.id,
      fullName: trial.full_name ?? '',
      phone: trial.phone ?? '',
      referenceId: trial.reference_id ?? null,
      referenceName: referenceLite?.full_name ?? '',
      note: trial.note ?? '',
    };

    const selectedRows = typedDevices.filter((d) =>
      selectedDeviceIds.includes(d.id),
    );

    const devicePayload =
      selectedRows.length > 0
        ? selectedRows
            .filter((d) => hasBrandOrModel(d))
            .flatMap((d) => {
              const brand = d.brand?.trim() ?? '';
              const model = d.model?.trim() ?? '';
              const side = normalizeTrialSide(d.side);

              if (side === 'both') {
                return [
                  { side: 'right', brand, model },
                  { side: 'left', brand, model },
                ];
              }

              if (side === 'right' || side === 'left') {
                return [{ side, brand, model }];
              }

              return [{ side: '', brand, model }];
            })
        : [];

    navigate(`/patients?trialId=${trial.id}`, {
      state: {
        fromTrial,
        fromTrialDevices: devicePayload,
      },
    });

    setConvertModalOpen(false);
  };

  const handleCancelConvertModal = () => {
    setConvertModalOpen(false);
  };

  const statusHelpText = (() => {
    if (isSoftDeleted) {
      return 'Bu deneme kaydı silinmiş (soft delete). Dönüştürme işlemi kapalıdır.';
    }
    if (trial.status === 'converted') {
      return 'Bu deneme kaydı daha önce hastaya dönüştürülmüş. Dönüştürme işlemi kapalıdır.';
    }
    if (trial.status === 'lost') {
      return 'Bu deneme kaydı kaybedildi olarak işaretlenmiş. Dönüştürme işlemi kapalıdır.';
    }
    return null;
  })();

  const content = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-3 pt-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  'rounded-md px-3 py-1.5 text-xs font-medium ' +
                  (isActive
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {activeTab === 'summary' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase text-slate-500">Özet</h4>
              {!isSoftDeleted && (
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

            <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Durum</span>
                <span
                  className={
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                    getStatusBadgeClass(trial.status)
                  }
                >
                  {getStatusLabel(trial.status)}
                </span>
              </div>

              {trial.status === 'lost' && (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-slate-500">Kaybedildi</span>
                    <span className="text-xs text-slate-900">
                      {trial.lost_at ? formatDate(trial.lost_at) : '-'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Kaybetme nedeni</span>
                    <span className="whitespace-pre-line text-xs text-slate-900">
                      {trial.lost_reason && trial.lost_reason.trim()
                        ? trial.lost_reason
                        : '-'}
                    </span>
                  </div>
                </>
              )}

              {trial.status === 'converted' && (
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">Hasta ID</span>
                  <span className="text-xs text-slate-900">
                    {trial.converted_patient_id ?? '-'}
                  </span>
                </div>
              )}

              {isSoftDeleted && (
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">Silinme</span>
                  <span className="text-xs text-slate-900">
                    {trial.deleted_at ? formatDate(trial.deleted_at) : '-'}
                  </span>
                </div>
              )}

              {/* Ad Soyad */}
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Ad Soyad</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Ad Soyad"
                  />
                ) : (
                  <span className="text-xs font-medium text-slate-900">
                    {trial.full_name ?? '-'}
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
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Telefon"
                  />
                ) : (
                  <span className="text-xs text-slate-900">{trial.phone ?? '-'}</span>
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
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                ) : (
                  <span className="text-xs text-slate-900">
                    {formatDate(trial.created_at)}
                  </span>
                )}
              </div>

              {/* İlk Görüşme */}
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">İlk Görüşme</span>
                {isEditing ? (
                  <input
                    type="datetime-local"
                    value={firstMeetAt}
                    onChange={(e) => setFirstMeetAt(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                ) : (
                  <span className="text-xs text-slate-900">
                    {trial.first_meet_at ? formatDate(trial.first_meet_at) : '-'}
                  </span>
                )}
              </div>

              {/* Sonraki Randevu */}
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Sonraki Randevu</span>
                {isEditing ? (
                  <input
                    type="datetime-local"
                    value={nextMeetAt}
                    onChange={(e) => setNextMeetAt(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                ) : (
                  <span className="text-xs text-slate-900">
                    {trial.next_meet_at ? formatDate(trial.next_meet_at) : '-'}
                  </span>
                )}
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Referans</span>
                <span className="text-xs text-slate-900">
                  {!referenceId
                    ? '-'
                    : isReferenceLoading
                    ? 'Yükleniyor...'
                    : isReferenceError
                    ? 'Referans yüklenemedi'
                    : referenceLite?.full_name ?? '-'}
                </span>
              </div>
              {/* Internal note */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">İç Not</span>
                {isEditing ? (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Ekip içi not"
                  />
                ) : (
                  <span className="whitespace-pre-line text-xs text-slate-900">
                    {trial.note && trial.note.trim() ? trial.note : '-'}
                  </span>
                )}
              </div>
              {/* Patient-facing offer note */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Teklif Notu</span>
                {isEditing ? (
                  <textarea
                    value={offerNote}
                    onChange={(e) => setOfferNote(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Hastaya basılacak teklif notu"
                  />
                ) : (
                  <span className="whitespace-pre-line text-xs text-slate-900">
                    {trial.offer_note && trial.offer_note.trim()
                      ? trial.offer_note
                      : '-'}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-1 flex flex-col gap-2 rounded-md border border-slate-100 bg-white px-3 py-2">
              {statusHelpText && (
                <p className="text-[11px] text-slate-500">{statusHelpText}</p>
              )}

              {/* Soft delete / restore action (placed in Summary, not in header) */}
              <div className="flex items-center justify-end">
                <SoftDeleteRowActionButton
                  isDeleted={isSoftDeleted}
                  isBusy={isBusy}
                  size="xs"
                  onSoftDelete={handleSoftDeleteClick}
                  onRestore={handleRestoreClick}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-300"
                    checked={includeDetailsForPrint}
                    onChange={(e) => setIncludeDetailsForPrint(e.target.checked)}
                  />
                  <span>Detaylı çıktı (katalog özellikleri)</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePrintOffer}
                    disabled={typedDevices.length === 0}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Teklif Yazdır
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenConvertModal}
                    disabled={!isConvertible}
                    className={
                      'inline-flex items-center rounded-md px-3 py-1.5 text-[11px] font-medium shadow-sm ' +
                      (isConvertible
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed')
                    }
                  >
                    Hastaya dönüştür
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'devices' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Deneme Cihazları
            </h4>

            {isDevicesLoading && (
              <p className="text-xs text-slate-500">Cihazlar yükleniyor...</p>
            )}

            {isDevicesError && (
              <p className="text-xs text-red-600">
                Cihazlar alınırken bir hata oluştu. Lütfen tekrar deneyin.
              </p>
            )}

            {!isDevicesLoading && !isDevicesError && typedDevices.length === 0 && (
              <p className="text-xs text-slate-500">
                Bu deneme için kayıtlı cihaz satırı bulunmuyor.
              </p>
            )}

            {!isDevicesLoading && !isDevicesError && typedDevices.length > 0 && (
              <div className="space-y-2">
                <table className="min-w-full border border-slate-200 text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600">
                        #
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600">
                        Marka
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600">
                        Model
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600">
                        Kulak
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-right font-medium text-slate-600">
                        Liste Fiyatı
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-right font-medium text-slate-600">
                        Teklif (Satır)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {typedDevices.map((d, index) => (
                      <tr key={d.id}>
                        <td className="border-b border-slate-100 px-2 py-1">
                          {index + 1}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1">
                          {d.brand ?? '-'}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1">
                          {d.model ?? '-'}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1">
                          {d.side ?? '-'}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1 text-right">
                          {formatPrice(d.list_price ?? null)}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1 text-right">
                          {formatPrice(d.quote_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'meetings' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Görüşmeler
            </h4>

            {isMeetingsLoading && (
              <p className="text-xs text-slate-500">Görüşmeler yükleniyor...</p>
            )}

            {isMeetingsError && (
              <p className="text-xs text-red-600">
                Görüşmeler alınırken bir hata oluştu:{' '}
                {(meetingsError as Error)?.message ?? 'Bilinmeyen hata'}
              </p>
            )}

            {!isMeetingsLoading && !isMeetingsError && typedMeetings.length === 0 && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500">
                  Bu deneme hastası için kayıtlı görüşme bulunmuyor.
                </p>
                <p className="text-[11px] text-slate-400">
                  Yeni görüşme eklemek için üst menüden{' '}
                  <span className="font-semibold">Görüşmeler</span> ekranına gidip,
                  görüşme tipi olarak{' '}
                  <span className="font-semibold">Deneme hastası</span> seçerek ilgili
                  kişiyi seçebilirsiniz.
                </p>
              </div>
            )}

            {!isMeetingsLoading && !isMeetingsError && typedMeetings.length > 0 && (
              <div className="space-y-2">
                <table className="min-w-full border border-slate-200 text-[11px]">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Tarih</th>
                      <th className="px-2 py-1 text-left font-medium">Başlık</th>
                      <th className="px-2 py-1 text-left font-medium">Sonraki Tarih</th>
                      <th className="px-2 py-1 text-left font-medium">Memnuniyet</th>
                      <th className="px-2 py-1 text-left font-medium">Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typedMeetings.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100 align-top">
                        <td className="px-2 py-1 text-slate-800">{formatDate(m.at)}</td>
                        <td className="px-2 py-1 text-slate-800">{m.subject ?? '-'}</td>
                        <td className="px-2 py-1 text-slate-800">{formatDate(m.next_at)}</td>
                        <td className="px-2 py-1 text-slate-800">
                          {m.satisfaction_10 ?? '-'}
                        </td>
                        <td className="px-2 py-1 text-slate-600">
                          {m.note ? m.note.slice(0, 160) : '-'}
                          {m.note && m.note.length > 160 ? '…' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-slate-400">
                  Yeni görüşme eklemek için <span className="font-semibold">Görüşmeler</span>{' '}
                  ana ekranını kullanın. Bu sekme sadece ilgili deneme görüşmelerini
                  görüntüler.
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {convertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Hastaya dönüştür: Cihaz seçimi
            </h3>
            <p className="mb-3 text-[11px] text-slate-600">
              Bu denemede teklif ettiğiniz cihaz satırlarından hangilerini yeni hasta kaydına
              taşımak istiyorsunuz? Seçtiğiniz satırlar hasta formunda cihaz satırı olarak
              önceden doldurulur.
            </p>
            <p className="mb-3 text-[11px] text-slate-500">
              Not: Kulak alanı <span className="font-semibold">Çift</span> (both/bilateral)
              olan satırlar, hasta formunda otomatik olarak iki satıra bölünür: sağ ve sol.
            </p>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-700">
                Deneme cihazları
              </span>
              <button
                type="button"
                onClick={handleToggleAllSelectable}
                className="text-[11px] font-medium text-primary-700 hover:underline"
              >
                Tümünü seç / kaldır
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-md border border-slate-200">
              {typedDevices.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-500">
                  Bu deneme için kayıtlı cihaz satırı bulunmuyor. Yine de hasta kaydı
                  açabilirsiniz; cihazlar hasta ekranında seçilir.
                </p>
              ) : (
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Seç</th>
                      <th className="px-2 py-1 text-left font-medium">Marka</th>
                      <th className="px-2 py-1 text-left font-medium">Model</th>
                      <th className="px-2 py-1 text-left font-medium">Kulak</th>
                      <th className="px-2 py-1 text-right font-medium">Teklif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typedDevices.map((d) => {
                      const selectable = hasBrandOrModel(d);
                      const normalizedSide = normalizeTrialSide(d.side);
                      const sideLabel =
                        normalizedSide === 'both'
                          ? 'Çift'
                          : normalizedSide === 'right'
                          ? 'Sağ'
                          : normalizedSide === 'left'
                          ? 'Sol'
                          : d.side ?? '-';
                      const checked = selectedDeviceIds.includes(d.id);

                      return (
                        <tr
                          key={d.id}
                          className={
                            'border-t border-slate-100 ' +
                            (!selectable ? 'bg-slate-50/60 text-slate-400' : '')
                          }
                        >
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-slate-300"
                              disabled={!selectable}
                              checked={selectable && checked}
                              onChange={() => {
                                if (!selectable) return;
                                toggleDeviceSelected(d.id);
                              }}
                            />
                          </td>
                          <td className="px-2 py-1">{d.brand ?? '-'}</td>
                          <td className="px-2 py-1">{d.model ?? '-'}</td>
                          <td className="px-2 py-1">{sideLabel}</td>
                          <td className="px-2 py-1 text-right">
                            {formatPrice(d.quote_price)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelConvertModal}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmConvertToPatient}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-800 shadow-sm hover:bg-emerald-100"
              >
                Seçilenlerle hastaya dönüştür
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Deneme Detayı"
      subtitle="Kişi bilgileri, deneme cihazları ve görüşme süreci"
    >
      {content}
    </SideDrawer>
  );
}
