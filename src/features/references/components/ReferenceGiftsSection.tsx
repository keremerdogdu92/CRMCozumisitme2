// src/features/references/components/ReferenceGiftsSection.tsx
// Summary: Reference gifts/commission tab for reference detail drawer.
// - Lists reference_gifts rows (active only).
// - Allows admin to add a new gift/commission record.
// - Allows soft delete (deleted_at).
//
// v1.0.0:
// - First real implementation replacing placeholder UI.
// - Uses api.gifts.ts aligned to DB schema (gift_type, gift_note, gift_at).

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createReferenceGift,
  fetchReferenceGiftsByReferenceId,
  softDeleteReferenceGift,
  REFERENCE_GIFTS_QUERY_KEY,
  type NewReferenceGiftInput,
  type ReferenceGiftRow,
  type ReferenceGiftType,
} from '../api.gifts';

type ReferenceGiftsSectionProps = {
  referenceId: string;
};

function formatDateTR(value: string | null): string {
  if (!value) return '-';
  try {
    // gift_at is DATE -> "YYYY-MM-DD" usually
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      // If DB returns "YYYY-MM-DD", Date parses as UTC; ok for display.
      return value;
    }
    return d.toLocaleDateString('tr-TR');
  } catch {
    return value;
  }
}

function renderGiftTypeLabel(t: string): string {
  switch (t) {
    case 'commission':
      return 'Komisyon';
    case 'gift':
      return 'Hediye';
    case 'other':
      return 'Diğer';
    default:
      return t || 'Diğer';
  }
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const ReferenceGiftsSection: React.FC<ReferenceGiftsSectionProps> = ({
  referenceId,
}) => {
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewReferenceGiftInput>(() => ({
    referenceId,
    giftType: 'commission',
    amount: null,
    giftNote: '',
    giftAt: todayYmd(),
  }));

  const {
    data: gifts = [],
    isLoading,
    isError,
    error,
  } = useQuery<ReferenceGiftRow[]>({
    queryKey: REFERENCE_GIFTS_QUERY_KEY(referenceId),
    queryFn: () => fetchReferenceGiftsByReferenceId(referenceId),
    enabled: Boolean(referenceId),
  });

  const totalAmount = useMemo(() => {
    return gifts.reduce((sum, g) => sum + (g.amount ?? 0), 0);
  }, [gifts]);

  const createMutation = useMutation({
    mutationFn: createReferenceGift,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: REFERENCE_GIFTS_QUERY_KEY(referenceId),
      });
      setShowCreate(false);
      setForm((prev) => ({
        ...prev,
        amount: null,
        giftNote: '',
        giftAt: todayYmd(),
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: softDeleteReferenceGift,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: REFERENCE_GIFTS_QUERY_KEY(referenceId),
      });
    },
  });

  const mutationError =
    (createMutation.error as Error | null | undefined)?.message ?? '';

  const canSubmit =
    !createMutation.isPending &&
    Boolean(referenceId) &&
    (form.amount === null || Number.isFinite(form.amount)) &&
    form.giftType.trim().length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">
            Hediye / Komisyon
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Referansa bağlı hediye/komisyon ödemeleri. Kayıtlar soft delete ile
            saklanır.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate((p) => !p)}
          className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {showCreate ? 'Vazgeç' : 'Yeni Kayıt'}
        </button>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600">
            Kayıt sayısı:{' '}
            <span className="font-semibold text-slate-900">{gifts.length}</span>
          </p>
          <p className="text-xs text-slate-600">
            Toplam:{' '}
            <span className="font-semibold text-slate-900">
              {totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}{' '}
              TL
            </span>
          </p>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-medium text-slate-600">
                Tip
              </label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.giftType}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    giftType: e.target.value as ReferenceGiftType,
                  }))
                }
              >
                <option value="commission">Komisyon</option>
                <option value="gift">Hediye</option>
                <option value="other">Diğer</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-[11px] font-medium text-slate-600">
                Tutar (TL)
              </label>
              <input
                type="number"
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.amount ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) => ({
                    ...p,
                    amount: v.trim() === '' ? null : Number(v),
                  }));
                }}
                placeholder="örn. 1500"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-[11px] font-medium text-slate-600">
                Tarih
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.giftAt}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    giftAt: e.target.value,
                  }))
                }
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-[11px] font-medium text-slate-600">
                Not
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.giftNote}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    giftNote: e.target.value,
                  }))
                }
                placeholder="opsiyonel"
              />
            </div>
          </div>

          {createMutation.isError && (
            <p className="mt-2 text-xs text-red-600">
              Kayıt sırasında hata oluştu.{' '}
              {mutationError ? `Detay: ${mutationError}` : ''}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              disabled={createMutation.isPending}
            >
              İptal
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canSubmit) return;
                createMutation.mutate({
                  ...form,
                  referenceId,
                });
              }}
              className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              disabled={!canSubmit}
            >
              {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
          Kayıtlar yükleniyor...
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-dashed border-red-200 bg-red-50 px-3 py-4 text-xs text-red-700">
          Kayıtlar alınırken hata oluştu.{' '}
          {(error as Error | null)?.message ? (
            <span className="block mt-1 opacity-90">
              Detay: {(error as Error).message}
            </span>
          ) : null}
        </div>
      )}

      {!isLoading && !isError && gifts.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
          Bu referans için henüz kayıt yok.
        </div>
      )}

      {!isLoading && !isError && gifts.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  Tarih
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  Tip
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  Tutar
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  Not
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody>
              {gifts.map((g) => (
                <tr key={g.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {formatDateTR(g.gift_at)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {renderGiftTypeLabel(g.gift_type)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-800">
                    {(g.amount ?? 0).toLocaleString('tr-TR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    TL
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-slate-500">
                    {g.gift_note ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(g.id)}
                      className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={deleteMutation.isPending}
                      title="Soft delete"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {deleteMutation.isError && (
            <div className="border-t border-slate-100 px-3 py-2 text-xs text-red-600">
              Silme sırasında hata oluştu.{' '}
              {(deleteMutation.error as Error | null)?.message
                ? `Detay: ${(deleteMutation.error as Error).message}`
                : ''}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
