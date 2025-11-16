// src/features/patients/PatientDetailDrawer.tsx
// Tabbed patient detail drawer using the shared SideDrawer shell.

import { useEffect, useState } from 'react';
import type { PatientRow } from './types';
import { SideDrawer } from '../../components/layout/SideDrawer';

type PatientDetailDrawerProps = {
  patient: PatientRow;
  open: boolean;
  onClose: () => void;
  onSave: (values: {
    sgkFlag: boolean;
    sgkPrescriptionReceived: boolean;
    sgkRecordedToSystem: boolean;
  }) => void;
  isSaving: boolean;
  errorMsg?: string;
};

type PatientDetailTabId = 'info' | 'devices' | 'meetings' | 'payments' | 'audiogram';

export function PatientDetailDrawer({
  patient,
  open,
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

  const footer = (
    <>
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
        className="inline-flex items-center rounded-md bg-primary-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Hasta Detayı"
      subtitle={patient.full_name}
      footer={footer}
    >
      {/* Sekme barı */}
      <div className="border-b border-slate-200 pb-2">
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
                    ? 'border border-primary-200 bg-primary-50 text-primary-700'
                    : 'border border-transparent text-slate-600 hover:bg-slate-50')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sekme içerikleri */}
      <div className="mt-4 space-y-4 text-sm">
        {activeTab === 'info' && (
          <>
            {/* Temel bilgiler */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-500">
                Özlük Bilgileri
              </h4>
              <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
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
              <h4 className="text-xs font-semibold uppercase text-slate-500">
                SGK ve Evrak Takibi
              </h4>
              <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
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
                    className="select-none text-xs font-medium text-slate-700"
                  >
                    SGK hastası
                  </label>
                </div>

                <div className="flex flex-col gap-1 pl-5 text-xs">
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

                <p className="mt-1 text-[11px] text-slate-500">
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
            <h4 className="text-xs font-semibold uppercase text-slate-500">
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
            <h4 className="text-xs font-semibold uppercase text-slate-500">
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
            <h4 className="text-xs font-semibold uppercase text-slate-500">
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
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Audiogram
            </h4>
            <p className="text-xs text-slate-500">
              Audiogram sonuçları ve işitme testleri bu sekmede tutulacak.
              İleride grafikli bir görünüm ve &quot;önce / sonra&quot;
              karşılaştırma seçenekleri eklenebilir.
            </p>
          </section>
        )}

        {errorMsg && (
          <p className="text-[11px] text-red-600">
            Kaydetme sırasında bir hata oluştu. Detay: {errorMsg}
          </p>
        )}
      </div>
    </SideDrawer>
  );
}
