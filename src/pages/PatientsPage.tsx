// src/pages/PatientsPage.tsx

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../utils/supabaseClient';
import { useMemo, useState } from 'react';

type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
  sgk_flag: boolean | null;
};

async function fetchPatients(): Promise<PatientRow[]> {
  const { data, error } = await supabaseClient
    .from('patients')
    .select('id, full_name, phone, created_at, last_visit_at, sgk_flag')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patients fetch error:', error);
    throw error;
  }

  return data ?? [];
}

export default function PatientsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['patients'],
    queryFn: fetchPatients,
  });

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data;

    return data.filter((p) => {
      const name = p.full_name?.toLowerCase() ?? '';
      const phone = p.phone?.toLowerCase() ?? '';
      return name.includes(term) || phone.includes(term);
    });
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Hastalar yükleniyor...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-red-600">
        Hasta verileri alınırken bir hata oluştu. Lütfen Supabase bağlantısını
        ve RLS ayarlarını kontrol edin.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Hastalar</h2>
        <p className="text-sm text-slate-500">
          Henüz kayıtlı hasta bulunmuyor. Supabase panelinden veya ileride
          eklenecek &quot;Yeni Hasta&quot; formundan hasta ekleyebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hastalar</h2>
          <p className="text-xs text-slate-500">
            Toplam {data.length} kayıt
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* İleride buraya gerçek "Yeni Hasta" butonu gelecek */}
          {/* <button className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Yeni Hasta
          </button> */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim veya telefon ile ara..."
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 md:w-64"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Filtreye uygun hasta bulunamadı. Arama kriterlerini değiştirerek
          tekrar deneyebilirsiniz.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Ad Soyad
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Telefon
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  SGK
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Son Ziyaret
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Kayıt Tarihi
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-800">{p.full_name}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {p.phone ?? '-'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={[
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        p.sgk_flag
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-50 text-slate-500',
                      ].join(' ')}
                    >
                      {p.sgk_flag ? 'Evet' : 'Hayır'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {p.last_visit_at
                      ? new Date(p.last_visit_at).toLocaleDateString('tr-TR')
                      : '-'}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {new Date(p.created_at).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
