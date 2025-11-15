// src/pages/PatientsPage.tsx
import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../utils/supabaseClient';

type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
  sgk_flag: boolean | null;
};

type NewPatientForm = {
  fullName: string;
  phone: string;
  sgkFlag: boolean;
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

// Yeni hasta kaydı oluşturan yardımcı fonksiyon
async function createPatient(input: NewPatientForm): Promise<void> {
  // 1) Giriş yapan kullanıcıyı al
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user:', userError);
    throw new Error(userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('User not authenticated');
  }

  // 2) Bu kullanıcının profilinden org_id çek
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for org_id:', profileError);
    throw new Error(profileError.message);
  }

  if (!profile?.org_id) {
    throw new Error('Profile org_id is missing');
  }

  // 3) Hastayı bu org_id ile ekle
  const { error: insertError } = await supabaseClient.from('patients').insert({
    org_id: profile.org_id,
    full_name: input.fullName.trim(),
    phone: input.phone.trim() || null,
    sgk_flag: input.sgkFlag,
  });

  if (insertError) {
    console.error('Failed to insert patient:', insertError);
    // Burada özellikle message'ı Error içine koyuyoruz ki React Query düzgün göstersin
    throw new Error(insertError.message);
  }
}

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formState, setFormState] = useState<NewPatientForm>({
    fullName: '',
    phone: '',
    sgkFlag: true,
  });

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['patients'],
    queryFn: fetchPatients,
  });

  const createMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      setFormState({ fullName: '', phone: '', sgkFlag: true });
      setShowCreateForm(false);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formState.fullName.trim()) {
      return;
    }

    createMutation.mutate({
      fullName: formState.fullName,
      phone: formState.phone,
      sgkFlag: formState.sgkFlag,
    });
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-slate-500">Hastalar yükleniyor...</div>;
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-red-600">
        Hasta verileri alınırken bir hata oluştu. Lütfen Supabase bağlantısını ve RLS
        ayarlarını kontrol edin.
      </div>
    );
  }

  const patients = data ?? [];
  const filteredPatients = patients.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(term) ||
      (p.phone ?? '').toLowerCase().includes(term)
    );
  });

  const totalCount = patients.length;
  const mutationError =
    (createMutation.error as Error | null | undefined)?.message ?? '';

  return (
    <div className="p-8 space-y-6">
      {/* Başlık + arama + yeni hasta butonu */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hastalar</h2>
          <p className="text-xs text-slate-500 mt-1">Toplam {totalCount} kayıt</p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
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
            {showCreateForm ? 'Formu Kapat' : 'Yeni Hasta'}
          </button>
        </div>
      </div>

      {/* Yeni hasta formu – butona basınca açılır, tabloyu aşağı iter */}
      {showCreateForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Yeni Hasta Ekle</h3>
          <form className="grid gap-3 md:grid-cols-4 md:items-end" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Ad Soyad
              </label>
              <input
                type="text"
                required
                value={formState.fullName}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, fullName: e.target.value }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Örn. Ahmet Yılmaz"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={formState.phone}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, phone: e.target.value }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="05XXXXXXXXX"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="sgk-flag"
                type="checkbox"
                checked={formState.sgkFlag}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, sgkFlag: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label
                htmlFor="sgk-flag"
                className="text-xs font-medium text-slate-700 select-none"
              >
                SGK hastası
              </label>
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>

            {createMutation.isError && (
              <p className="md:col-span-4 text-xs text-red-600">
                Kayıt sırasında bir hata oluştu. Lütfen bilgileri ve bağlantıyı
                kontrol edin.
                {mutationError && (
                  <span className="block text-[10px] text-red-500/80 mt-1">
                    Detay: {mutationError}
                  </span>
                )}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Hasta listesi */}
      {filteredPatients.length === 0 ? (
        <div className="text-sm text-slate-500">
          Filtreye uyan hasta bulunamadı. Arama kutusunu temizleyebilir veya yeni
          hasta ekleyebilirsiniz.
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
              {filteredPatients.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-800">{p.full_name}</td>
                  <td className="px-4 py-2 text-slate-700">{p.phone ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        p.sgk_flag
                          ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : 'inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500'
                      }
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
