// src/pages/PatientsPage.tsx
import { useState, useEffect, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../utils/supabaseClient';

type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
  sgk_flag: boolean | null;
  sgk_prescription_received: boolean | null;
  sgk_recorded_to_system: boolean | null;
};

type NewPatientForm = {
  fullName: string;
  phone: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
};

async function fetchPatients(): Promise<PatientRow[]> {
  const { data, error } = await supabaseClient
    .from('patients')
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at,
      sgk_flag,
      sgk_prescription_received,
      sgk_recorded_to_system
    `,
    )
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
    console.error('Failed to get current user (STEP_USER):', userError);
    throw new Error('STEP_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('STEP_USER: User not authenticated');
  }

  // 2) Bu kullanıcının profilinden org_id çek
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for org_id (STEP_PROFILE):', profileError);
    throw new Error('STEP_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (STEP_NO_ORG)', profile);
    throw new Error('STEP_NO_ORG: Profile org_id is missing');
  }

  // 3) Hastayı bu org_id ile ekle
  const { error: insertError } = await supabaseClient.from('patients').insert({
    org_id: profile.org_id,
    full_name: input.fullName.trim(),
    phone: input.phone.trim() || null,
    sgk_flag: input.sgkFlag,
    sgk_prescription_received: input.sgkFlag ? input.sgkPrescriptionReceived : false,
    sgk_recorded_to_system: input.sgkFlag ? input.sgkRecordedToSystem : false,
  });

  if (insertError) {
    console.error('Failed to insert patient (STEP_INSERT):', insertError);
    throw new Error('STEP_INSERT: ' + insertError.message);
  }
}

// SGK alanlarını güncellemek için helper
async function updatePatientSgkFields(params: {
  id: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
}): Promise<void> {
  const { id, sgkFlag, sgkPrescriptionReceived, sgkRecordedToSystem } = params;

  const { error } = await supabaseClient
    .from('patients')
    .update({
      sgk_flag: sgkFlag,
      sgk_prescription_received: sgkFlag ? sgkPrescriptionReceived : false,
      sgk_recorded_to_system: sgkFlag ? sgkRecordedToSystem : false,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update patient SGK fields (STEP_UPDATE_SGK):', error);
    throw new Error('STEP_UPDATE_SGK: ' + error.message);
  }
}

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sgkFilter, setSgkFilter] = useState<'all' | 'sgk' | 'non-sgk'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [detailPatient, setDetailPatient] = useState<PatientRow | null>(null);

  const [formState, setFormState] = useState<NewPatientForm>({
    fullName: '',
    phone: '',
    sgkFlag: true,
    sgkPrescriptionReceived: false,
    sgkRecordedToSystem: false,
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
      setFormState({
        fullName: '',
        phone: '',
        sgkFlag: true,
        sgkPrescriptionReceived: false,
        sgkRecordedToSystem: false,
      });
      setShowCreateForm(false);
    },
  });

  const sgkUpdateMutation = useMutation({
    mutationFn: updatePatientSgkFields,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
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
      sgkPrescriptionReceived: formState.sgkFlag
        ? formState.sgkPrescriptionReceived
        : false,
      sgkRecordedToSystem: formState.sgkFlag
        ? formState.sgkRecordedToSystem
        : false,
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
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.full_name.toLowerCase().includes(term) ||
      (p.phone ?? '').toLowerCase().includes(term);

    const matchesSgk =
      sgkFilter === 'all' ||
      (sgkFilter === 'sgk' && !!p.sgk_flag) ||
      (sgkFilter === 'non-sgk' && !p.sgk_flag);

    return matchesSearch && matchesSgk;
  });

  const totalCount = patients.length;
  const mutationError =
    (createMutation.error as Error | null | undefined)?.message ?? '';

  const formatDate = (value: string | null): string => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('tr-TR');
  };

  const formatSgkWarning = (p: PatientRow): string | null => {
    if (!p.sgk_flag) return null;
    const needsPrescription = !p.sgk_prescription_received;
    const needsRecording = !p.sgk_recorded_to_system;

    if (!needsPrescription && !needsRecording) return null;

    if (needsPrescription && needsRecording) {
      return 'Reçete ve sistem kaydı eksik';
    }
    if (needsPrescription) return 'Reçete bekleniyor';
    return 'Sisteme işlenecek';
  };

  return (
    <div className="p-8 space-y-6">
      {/* Başlık + filtreler + arama + yeni hasta butonu */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hastalar</h2>
          <p className="text-xs text-slate-500 mt-1">Toplam {totalCount} kayıt</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* SGK filtresi */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">SGK filtre:</span>
            <select
              value={sgkFilter}
              onChange={(e) =>
                setSgkFilter(e.target.value as 'all' | 'sgk' | 'non-sgk')
              }
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">Hepsi</option>
              <option value="sgk">Sadece SGK</option>
              <option value="non-sgk">SGK’sız</option>
            </select>
          </div>

          {/* Arama */}
          <input
            type="text"
            placeholder="İsim veya telefon ile ara..."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Yeni hasta butonu */}
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
          <form className="grid gap-3 md:grid-cols-4 md:items-start" onSubmit={handleSubmit}>
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

            {/* SGK üçlü checkbox grubu */}
            <div className="md:col-span-1 flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  id="sgk-flag"
                  type="checkbox"
                  checked={formState.sgkFlag}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormState((s) => ({
                      ...s,
                      sgkFlag: checked,
                      sgkPrescriptionReceived: checked ? s.sgkPrescriptionReceived : false,
                      sgkRecordedToSystem: checked ? s.sgkRecordedToSystem : false,
                    }));
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <label
                  htmlFor="sgk-flag"
                  className="text-xs font-medium text-slate-700 select-none"
                >
                  SGK hastası
                </label>
              </div>

              <div className="pl-5 flex flex-col gap-1 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!formState.sgkFlag}
                    checked={formState.sgkPrescriptionReceived}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        sgkPrescriptionReceived: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                  />
                  <span>Reçete geldi mi?</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!formState.sgkFlag}
                    checked={formState.sgkRecordedToSystem}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        sgkRecordedToSystem: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                  />
                  <span>Sisteme işlendi mi?</span>
                </label>
              </div>
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
                  Alış (Kayıt)
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Ad Soyad
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Telefon
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Cihaz Modeli
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">
                  Fiyat
                </th>
                <th className="px-4 py-2 text-center font-medium text-slate-600">
                  Memnuniyet (1–10)
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Son Görüşme
                </th>
                <th className="px-4 py-2 text-center font-medium text-slate-600">
                  SGK
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Arşiv Kodu
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => {
                const warning = formatSgkWarning(p);
                const hasSgkWarning = !!warning;

                return (
                  <tr
                    key={p.id}
                    className={
                      'border-t border-slate-100 ' +
                      (hasSgkWarning ? 'bg-amber-50/40' : '')
                    }
                  >
                    {/* Alış / kayıt tarihi */}
                    <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>

                    {/* Ad Soyad */}
                    <td className="px-4 py-2 text-slate-800">{p.full_name}</td>

                    {/* Telefon */}
                    <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                      {p.phone ?? '-'}
                    </td>

                    {/* Cihaz Modeli – v1: henüz bağlı değil */}
                    <td className="px-4 py-2 text-slate-500 italic">-</td>

                    {/* Fiyat – v1: henüz bağlı değil */}
                    <td className="px-4 py-2 text-right text-slate-500 italic">
                      -
                    </td>

                    {/* Memnuniyet – v1: henüz bağlı değil */}
                    <td className="px-4 py-2 text-center text-slate-500 italic">
                      -
                    </td>

                    {/* Son Görüşme */}
                    <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                      {formatDate(p.last_visit_at)}
                    </td>

                    {/* SGK etiketi + uyarı */}
                    <td className="px-4 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={
                            p.sgk_flag
                              ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                              : 'inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500'
                          }
                        >
                          {p.sgk_flag ? 'Evet' : 'Hayır'}
                        </span>
                        {warning && (
                          <span className="text-[10px] font-medium text-amber-700">
                            {warning}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Arşiv Kodu – v1: placeholder */}
                    <td className="px-4 py-2 text-slate-500 italic">-</td>

                    {/* İşlemler – Detay çekmecesi */}
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailPatient(p)}
                        className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hasta Detay çekmecesi */}
      {detailPatient && (
        <PatientDetailDrawer
          patient={detailPatient}
          onClose={() => setDetailPatient(null)}
          onSave={(values) =>
            sgkUpdateMutation.mutate({
              id: detailPatient.id,
              sgkFlag: values.sgkFlag,
              sgkPrescriptionReceived: values.sgkPrescriptionReceived,
              sgkRecordedToSystem: values.sgkRecordedToSystem,
            })
          }
          isSaving={sgkUpdateMutation.isPending}
          errorMsg={
            (sgkUpdateMutation.error as Error | null | undefined)?.message ?? ''
          }
        />
      )}
    </div>
  );
}

type PatientDetailDrawerProps = {
  patient: PatientRow;
  onClose: () => void;
  onSave: (values: {
    sgkFlag: boolean;
    sgkPrescriptionReceived: boolean;
    sgkRecordedToSystem: boolean;
  }) => void;
  isSaving: boolean;
  errorMsg: string;
};

type PatientDetailTabId = 'info' | 'devices' | 'meetings' | 'payments' | 'audiogram';

// Basit hasta detay çekmecesi – sekmeli yapı
function PatientDetailDrawer({
  patient,
  onClose,
  onSave,
  isSaving,
  errorMsg,
}: PatientDetailDrawerProps) {
  const [sgkFlag, setSgkFlag] = useState<boolean>(!!patient.sgk_flag);
  const [sgkPrescriptionReceived, setSgkPrescriptionReceived] = useState<boolean>(
    !!patient.sgk_prescription_received,
  );
  const [sgkRecordedToSystem, setSgkRecordedToSystem] = useState<boolean>(
    !!patient.sgk_recorded_to_system,
  );
  const [activeTab, setActiveTab] = useState<PatientDetailTabId>('info');

  // Hasta değişince local state’i resetle
  useEffect(() => {
    setSgkFlag(!!patient.sgk_flag);
    setSgkPrescriptionReceived(!!patient.sgk_prescription_received);
    setSgkRecordedToSystem(!!patient.sgk_recorded_to_system);
    setActiveTab('info');
  }, [patient]);

  const handleSave = () => {
    onSave({
      sgkFlag,
      sgkPrescriptionReceived: sgkFlag ? sgkPrescriptionReceived : false,
      sgkRecordedToSystem: sgkFlag ? sgkRecordedToSystem : false,
    });
  };

  const tabs: { id: PatientDetailTabId; label: string }[] = [
    { id: 'info', label: 'Özlük & SGK' },
    { id: 'devices', label: 'Cihazlar' },
    { id: 'meetings', label: 'Görüşmeler' },
    { id: 'payments', label: 'Ödemeler' },
    { id: 'audiogram', label: 'Audiogram' },
  ];

  return (
    <>
      {/* Arka plan overlay */}
      <div
        className="fixed inset-0 z-30 bg-slate-900/30"
        onClick={onClose}
      />

      {/* Çekmece */}
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Hasta Detayı</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Kapat
          </button>
        </div>

        {/* Sekme barı */}
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

        {/* Sekme içerikleri */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
          {activeTab === 'info' && (
            <>
              {/* Temel bilgiler */}
              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">
                  Özlük Bilgileri
                </h4>
                <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-slate-500">Ad Soyad</span>
                    <span className="text-xs font-medium text-slate-900">
                      {patient.full_name}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-slate-500">Telefon</span>
                    <span className="text-xs text-slate-900">
                      {patient.phone ?? '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-slate-500">Kayıt Tarihi</span>
                    <span className="text-xs text-slate-900">
                      {new Date(patient.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-slate-500">Son Görüşme</span>
                    <span className="text-xs text-slate-900">
                      {patient.last_visit_at
                        ? new Date(patient.last_visit_at).toLocaleDateString('tr-TR')
                        : '-'}
                    </span>
                  </div>
                </div>
              </section>

              {/* SGK alanları */}
              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">
                  SGK ve Evrak Takibi
                </h4>
                <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="detail-sgk-flag"
                      type="checkbox"
                      checked={sgkFlag}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSgkFlag(checked);
                        if (!checked) {
                          setSgkPrescriptionReceived(false);
                          setSgkRecordedToSystem(false);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label
                      htmlFor="detail-sgk-flag"
                      className="text-xs font-medium text-slate-700 select-none"
                    >
                      SGK hastası
                    </label>
                  </div>

                  <div className="pl-5 flex flex-col gap-1 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={!sgkFlag}
                        checked={sgkPrescriptionReceived}
                        onChange={(e) =>
                          setSgkPrescriptionReceived(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                      />
                      <span>Reçete geldi mi?</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={!sgkFlag}
                        checked={sgkRecordedToSystem}
                        onChange={(e) =>
                          setSgkRecordedToSystem(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                      />
                      <span>Sisteme işlendi mi?</span>
                    </label>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1">
                    Bu alanlar ana listede satırları renklendirir ve
                    &quot;Reçete bekleniyor / Sisteme işlenecek&quot; uyarılarını
                    tetikler.
                  </p>
                </div>
              </section>
            </>
          )}

          {activeTab === 'devices' && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">
                Cihazlar
              </h4>
              <p className="text-xs text-slate-500">
                Bir sonraki adımda bu sekmede hastanın aktif cihazları, kulak
                tarafı (sağ/sol/çift), model, seri numarası ve garanti bilgileri
                listelenecek. Şimdilik sadece iskelet olarak duruyor.
              </p>
            </section>
          )}

          {activeTab === 'meetings' && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">
                Görüşmeler
              </h4>
              <p className="text-xs text-slate-500">
                Buraya tarih bazlı ziyaret listesi, not alanı ve
                &quot;Ödeme / Tamir / Aksesuar&quot; alt etiketleri eklenecek.
                Referans amaçlı görüşmeler bu sekmede, ancak ana listede
                personel için gizli tutulacak.
              </p>
            </section>
          )}

          {activeTab === 'payments' && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">
                Ödemeler
              </h4>
              <p className="text-xs text-slate-500">
                Bu sekme, toplam cihaz bedeli, peşinat, taksit planı ve ödeme
                geçmişini gösterecek. Kredi kartı komisyonu ve senet taksit
                gridini buraya bağlamayı planlayacağız.
              </p>
            </section>
          )}

          {activeTab === 'audiogram' && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">
                Audiogram
              </h4>
              <p className="text-xs text-slate-500">
                Audiogram sonuçları ve işitme testleri bu sekmede tutulacak.
                İleride grafikli bir görünüm ve &quot;önce / sonra&quot; karşılaştırma
                seçenekleri eklenebilir.
              </p>
            </section>
          )}

          {errorMsg && (
            <p className="text-[11px] text-red-600">
              Kaydetme sırasında bir hata oluştu. Detay: {errorMsg}
            </p>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Kapat
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </>
  );
}
