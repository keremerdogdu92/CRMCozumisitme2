// src/features/profitCalculator/components/ProfitCalculatorQuickCommission.tsx
// Summary: Minimal standalone card-commission calculator for quick preview.
// Used at the top of ProfitCalculatorPage.

import { useState, useMemo } from "react";

const RATES = [
  { i: 1, w: 2.69, f: 2.99 },
  { i: 2, w: 6.99, f: 7.49 },
  { i: 3, w: 8.99, f: 9.29 },
  { i: 4, w: 10.89, f: 11.29 },
  { i: 6, w: 14.59, f: 14.99 },
  { i: 9, w: 19.99, f: 20.49 },
  { i: 12, w: 25.49, f: 25.99 },
];

const SWITCH = "2026-03-01";

function rateForInstallments(n: number) {
  const r = RATES.find((x) => x.i === n);
  if (!r) return null;
  return new Date() >= new Date(`${SWITCH}T00:00:00`) ? r.f : r.w;
}

function format(amount: number | null) {
  if (amount == null) return "-";
  return amount.toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY",
  });
}

export function ProfitCalculatorQuickCommission() {
  const [sale, setSale] = useState("");
  const [installment, setInstallment] = useState("");

  const saleNum = Number(
    sale.replace(/\./g, "").replace(",", "."),
  );

  const rate = useMemo(() => {
    if (!installment) return null;
    return rateForInstallments(Number(installment));
  }, [installment]);

  const { fee, net } = useMemo(() => {
    if (!saleNum || !rate) return { fee: null, net: null };
    const fee = Number((saleNum * (rate / 100)).toFixed(2));
    const net = Number((saleNum - fee).toFixed(2));
    return { fee, net };
  }, [saleNum, rate]);

  return (
    <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
      <p className="mb-1 text-sm font-semibold text-slate-800">
        Hızlı Kart Komisyonu Hesaplama
      </p>
      <p className="mb-3 text-[11px] text-slate-500">
        Fiyat ve taksit seçerek komisyonu hemen görebilirsiniz.
      </p>

      <div className="mb-2 flex gap-2">
        <input
          className="w-32 rounded border p-2 text-sm"
          placeholder="Fiyat"
          value={sale}
          onChange={(e) => setSale(e.target.value)}
        />

        <select
          className="rounded border p-2 text-sm"
          value={installment}
          onChange={(e) => setInstallment(e.target.value)}
        >
          <option value="">Taksit</option>
          <option value="1">1 (Tek Çekim)</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="6">6</option>
          <option value="9">9</option>
          <option value="12">12</option>
        </select>

        <input
          className="w-20 rounded border bg-slate-100 p-2 text-sm"
          readOnly
          value={rate ?? ""}
          placeholder="%"
        />
      </div>

      <div className="text-[12px] text-slate-700">
        Komisyon: <b>{format(fee)}</b> — Net: <b>{format(net)}</b>
      </div>
    </div>
  );
}
