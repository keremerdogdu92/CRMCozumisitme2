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

function getPeriodStatus(
  period: SgkReimbursementPeriod,
  activePeriodId: string | null,
): { label: string; className: string } {
  const today = todayDateInput();

  if (period.valid_from > today) {
    return { label: 'Planli', className: 'bg-sky-50 text-sky-700' };
  }

  if (period.id === activePeriodId) {
    return { label: 'Aktif', className: 'bg-emerald-50 text-emerald-700' };
  }

  return { label: 'Gecmis', className: 'bg-slate-100 text-slate-600' };
}

export function SgkReimbursementSettingsCard() {
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const { data: periods, isLoading, isError } = useSgkReimbursementPeriods();

  const sortedNewestFirst = useMemo(
    () => [...(periods ?? [])].sort((a, b) => b.valid_from.localeCompare(a.valid_from)),
    [periods],
  );
  const sortedOldestFirst = useMemo(
    () => [...(periods ?? [])].sort((a, b) => a.valid_from.localeCompare(b.valid_from)),
    [periods],
  );
  const activePeriodId = useMemo(() => {
    const today = todayDateInput();
    return (
      [...sortedOldestFirst].filter((period) => period.valid_from <= today)
        .slice(-1)[0]?.id ?? null
    );
  }, [sortedOldestFirst]);
  const latestPeriod = sortedNewestFirst[0] ?? null;

  const [form, setForm] = useState<FormState | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);
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

  const patchRate = (profileId: string, patch: Partial<RateDraft>) => {
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
      setMessage('Gecerli bir baslangic tarihi secin.');
      return;
    }

    const pillExtraPerDevice = parseMoney(form.pillExtraPerDevice);
    if (pillExtraPerDevice == null || pillExtraPerDevice < 0) {
      setMessage('Pil ek tutari gecerli olmali.');
      return;
    }

    const rates: SaveSgkReimbursementPeriodRate[] = [];
    for (const rate of form.rates) {
      const gross = parseMoney(rate.gross);
      const netToFirm = parseMoney(rate.net_to_firm);
      if (gross == null || netToFirm == null) {
        setMessage(`${rate.label} icin brut ve net firma tutari zorunlu.`);
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
      setMessage('Kaydedilecek SGK profili bulunamadi.');
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
      setMessage('SGK oran donemi kaydedildi.');
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'SGK oran donemi kaydedilirken hata olustu.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile?.org_id) {
    return (
      <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          SGK Odeme Oranlari
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Oturumda gecerli organizasyon bulunamadi.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            SGK Odeme Oranlari
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Tum SGK donemleri burada listelenir. Yeni donem acarken son kayit
            kopyalanir; hasta hesaplamasi sisteme islenme tarihindeki donemi
            kullanir.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewPeriodForm}
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
          disabled={isLoading || isSaving}
        >
          Yeni SGK donemi ekle
        </button>
      </div>

      {isLoading && (
        <p className="text-xs text-slate-500">SGK oranlari yukleniyor...</p>
      )}
      {isError && (
        <p className="text-xs text-red-600">
          SGK oranlari alinirken hata olustu. Fallback oranlar gosterilebilir.
        </p>
      )}
      {message && (
        <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {message}
        </p>
      )}

      <div className="space-y-2">
        {sortedOldestFirst.length === 0 && !isLoading && (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
            Kayitli SGK donemi bulunamadi.
          </div>
        )}

        {sortedOldestFirst.map((period) => {
          const isExpanded = expandedPeriodId === period.id;
          const status = getPeriodStatus(period, activePeriodId);

          return (
            <div
              key={period.id}
              className="rounded-md border border-slate-100 bg-slate-50 text-xs"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedPeriodId((current) =>
                    current === period.id ? null : period.id,
                  )
                }
                className="flex w-full flex-col gap-2 px-3 py-2 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">
                      Gecerlilik: {formatDate(period.valid_from)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                    {period.id.startsWith('fallback-') && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Fallback
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {period.rates.length} SGK profili
                  </div>
                </div>
                <div className="text-slate-600">
                  Pil ek tutari: {formatMoney(period.pill_extra_per_device)} TL / cihaz
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 bg-white px-3 py-3">
                  <div className="mb-2 text-[11px] text-slate-500">
                    Gecmis donemler kilitlidir. Yeni oran geldiginde son donemi
                    kopyalayarak yeni SGK donemi ekleyin.
                  </div>
                  <div className="overflow-x-auto rounded-md border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium text-slate-600">
                            Profil
                          </th>
                          <th className="px-2 py-2 text-right font-medium text-slate-600">
                            Brut
                          </th>
                          <th className="px-2 py-2 text-right font-medium text-slate-600">
                            Firmaya net
                          </th>
                          <th className="px-2 py-2 text-right font-medium text-slate-600">
                            Calisan payi
                          </th>
                          <th className="px-2 py-2 text-right font-medium text-slate-600">
                            Emekli payi
                          </th>
                          <th className="px-2 py-2 text-right font-medium text-slate-600">
                            Emekli net
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {period.rates.map((rate) => (
                          <tr key={rate.id}>
                            <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">
                              {rate.label}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right text-slate-700">
                              {formatMoney(rate.gross)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right text-slate-700">
                              {formatMoney(rate.net_to_firm)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right text-slate-700">
                              {formatMoney(rate.employee_share)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right text-slate-700">
                              {formatMoney(rate.retiree_share)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right text-slate-700">
                              {formatMoney(rate.retiree_net_after_share)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {form && (
        <div className="mt-4 space-y-3 rounded-md border border-primary-100 bg-primary-50/40 p-3">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">
                Gecerlilik baslangici
              </span>
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
              <span className="font-medium text-slate-700">
                Pil ek tutari / cihaz
              </span>
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
                    Brut
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Firmaya net
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Calisan payi
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-slate-600">
                    Emekli payi
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
              Iptal
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
