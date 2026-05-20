// src/features/settings/SgkReimbursementSettingsCard.tsx
// Settings UI for date-based SGK reimbursement periods.

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  SGK_REIMBURSEMENT_PERIODS_QUERY_KEY,
  formatSgkMoneyInput,
  saveSgkReimbursementPeriod,
  useSgkReimbursementPeriods,
  type SaveSgkReimbursementPeriodRate,
} from '../patients/api/api.sgkReimbursements';
import type { SgkProfileRate, SgkReimbursementPeriod } from '../patients/types';
import { useCurrentProfile } from '../auth/useCurrentProfile';

type RateDraft = {
  profile_id: string;
  label: string;
  gross: string;
  net_to_firm: string;
  employee_share: string;
  retiree_share: string;
  retiree_net_after_share: string;
};

type FormState = {
  validFrom: string;
  pillExtraPerDevice: string;
  rates: RateDraft[];
};

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyDraft(value: number | null | undefined): string {
  return value == null ? '' : formatSgkMoneyInput(value);
}

function createRateDraft(rate: SgkProfileRate): RateDraft {
  return {
    profile_id: rate.profile_id,
    label: rate.label,
    gross: moneyDraft(rate.gross),
    net_to_firm: moneyDraft(rate.net_to_firm),
    employee_share: moneyDraft(rate.employee_share),
    retiree_share: moneyDraft(rate.retiree_share),
    retiree_net_after_share: moneyDraft(rate.retiree_net_after_share),
  };
}

function createFormFromPeriod(period: SgkReimbursementPeriod | null): FormState {
  return {
    validFrom: todayDateInput(),
    pillExtraPerDevice: moneyDraft(period?.pill_extra_per_device ?? 0),
    rates: (period?.rates ?? []).map(createRateDraft),
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('tr-TR');
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SgkReimbursementSettingsCard() {
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const { data: periods, isLoading, isError } = useSgkReimbursementPeriods();

  const sortedPeriods = useMemo(
    () => [...(periods ?? [])].sort((a, b) => b.valid_from.localeCompare(a.valid_from)),
    [periods],
  );
  const latestPeriod = sortedPeriods[0] ?? null;

  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const openNewPeriodForm = () => {
    setForm(createFormFromPeriod(latestPeriod));
    setMessage(null);
  };

  const closeForm = () => {
    setForm(null);
    setMessage(null);
  };

  const patchRate = (
    profileId: string,
    patch: Partial<RateDraft>,
  ) => {
    setForm((current) =>
      current
        ? {
            ...current,
            rates: current.rates.map((rate) =>
              rate.profile_id === profileId ? { ...rate, ...patch } : rate,
            ),
          }
        : current,
    );
  };

  const handleSave = async () => {
    if (!form) return;
    setMessage(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.validFrom)) {
      setMessage('Geçerli bir başlangıç tarihi seçin.');
      return;
    }

    const pillExtraPerDevice = parseMoney(form.pillExtraPerDevice);
    if (pillExtraPerDevice == null || pillExtraPerDevice < 0) {
      setMessage('Pil ek tutarı geçerli olmalı.');
      return;
    }

    const rates: SaveSgkReimbursementPeriodRate[] = [];
    for (const rate of form.rates) {
      const gross = parseMoney(rate.gross);
      const netToFirm = parseMoney(rate.net_to_firm);
      if (gross == null || netToFirm == null) {
        setMessage(`${rate.label} için brüt ve net firma tutarı zorunlu.`);
        return;
      }
      rates.push({
        profile_id: rate.profile_id,
        label: rate.label.trim() || rate.profile_id,
        gross,
        net_to_firm: netToFirm,
        employee_share: parseMoney(rate.employee_share),
        retiree_share: parseMoney(rate.retiree_share),
        retiree_net_after_share: parseMoney(rate.retiree_net_after_share),
      });
    }

    if (rates.length === 0) {
      setMessage('Kaydedilecek SGK profili bulunamadı.');
      return;
    }

    setIsSaving(true);
    try {
      await saveSgkReimbursementPeriod({
        validFrom: form.validFrom,
        pillExtraPerDevice,
        rates,
      });
      await queryClient.invalidateQueries({
        queryKey: SGK_REIMBURSEMENT_PERIODS_QUERY_KEY,
      });
      setForm(null);
      setMessage('SGK oran dönemi kaydedildi.');
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'SGK oran dönemi kaydedilirken hata oluştu.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile?.org_id) {
    return (
      <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          SGK Ödeme Oranları
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Oturumda geçerli organizasyon bulunamadı.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            SGK Ödeme Oranları
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Yeni dönem açarken son kayıt kopyalanır; hasta hesaplaması sisteme işlenme tarihindeki dönemi kullanır.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewPeriodForm}
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
          disabled={isLoading || isSaving}
        >
          Yeni SGK dönemi ekle
        </button>
      </div>

      {isLoading && (
        <p className="text-xs text-slate-500">SGK oranları yükleniyor...</p>
      )}
      {isError && (
        <p className="text-xs text-red-600">
          SGK oranları alınırken hata oluştu. Fallback oranlar gösterilebilir.
        </p>
      )}
      {message && (
        <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {message}
        </p>
      )}

      <div className="space-y-2">
        {sortedPeriods.slice(0, 4).map((period) => (
          <div
            key={period.id}
            className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-slate-800">
                Geçerlilik: {formatDate(period.valid_from)}
              </div>
              <div className="text-slate-600">
                Pil ek tutarı: {formatMoney(period.pill_extra_per_device)} TL / cihaz
              </div>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {period.rates.length} SGK profili
              {period.id.startsWith('fallback-') ? ' - kod fallback oranı' : ''}
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="mt-4 space-y-3 rounded-md border border-primary-100 bg-primary-50/40 p-3">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">Geçerlilik başlangıcı</span>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) =>
                  setForm((current) =>
                    current ? { ...current, validFrom: e.target.value } : current,
                  )
                }
                className="rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">Pil ek tutarı / cihaz</span>
              <input
                type="text"
                value={form.pillExtraPerDevice}
                onChange={(e) =>
                  setForm((current) =>
                    current
                      ? { ...current, pillExtraPerDevice: e.target.value }
                      : current,
                  )
                }
                className="rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="624"
              />
            </label>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Profil
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Brüt
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Firmaya net
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Çalışan payı
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Emekli payı
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Emekli net
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.rates.map((rate) => (
                  <tr key={rate.profile_id}>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={rate.label}
                        onChange={(e) =>
                          patchRate(rate.profile_id, { label: e.target.value })
                        }
                        className="w-48 rounded border border-slate-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <MoneyInput
                        value={rate.gross}
                        onChange={(value) => patchRate(rate.profile_id, { gross: value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <MoneyInput
                        value={rate.net_to_firm}
                        onChange={(value) =>
                          patchRate(rate.profile_id, { net_to_firm: value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <MoneyInput
                        value={rate.employee_share}
                        onChange={(value) =>
                          patchRate(rate.profile_id, { employee_share: value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <MoneyInput
                        value={rate.retiree_share}
                        onChange={(value) =>
                          patchRate(rate.profile_id, { retiree_share: value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <MoneyInput
                        value={rate.retiree_net_after_share}
                        onChange={(value) =>
                          patchRate(rate.profile_id, {
                            retiree_net_after_share: value,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-60"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
            >
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-28 rounded border border-slate-200 px-2 py-1"
    />
  );
}
