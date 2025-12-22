// src/features/meetings/meetingSatisfactionTypes.ts
// Summary: Shared types, constants and helpers for meeting satisfaction surveys.
// - 1–5 memnuniyet ölçeği (metin karşılıkları ile)
// - MEMNUNIYET SORULARI + HASTA İPUCU SORULARI içindeki sorulardan oluşan birleşik soru havuzu
// - Hasta bazlı, localStorage üzerinden "sorular tekrar dönmesin" mantığı
// - Ek olarak: ipucu soruları için ayrı liste (PATIENT_HINT_QUESTIONS)

export type SatisfactionScore = 1 | 2 | 3 | 4 | 5;

export const SATISFACTION_OPTIONS: {
  value: SatisfactionScore;
  label: string;
}[] = [
  { value: 1, label: 'Hiç memnun değilim' },
  { value: 2, label: 'Memnun değilim' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Memnunum' },
  { value: 5, label: 'Çok memnunum' },
];

export type QuestionGroup = 'service' | 'device' | 'communication';

export interface MeetingSatisfactionQuestionDef {
  id: string; // Sabit ID (silersen komple kaldır; değiştirirsen eski kayıtlarla eşleşme bozulur)
  group: QuestionGroup;
  text: string;
}

export interface MeetingSatisfactionQuestionWithAnswer
  extends MeetingSatisfactionQuestionDef {
  score: SatisfactionScore | null;
}

/**
 * Grup başına kaç soru seçileceğini buradan ayarlayabilirsin.
 * Toplam 5 soruyu bu dağılıma göre dolduruyoruz.
 */
export const QUESTION_GROUP_TARGETS: Record<QuestionGroup, number> = {
  service: 2,
  device: 2,
  communication: 1,
};

/**
 * MEMNUNİYET SORULARI + HASTA İPUCU SORULARI birleşik soru havuzu.
 * Metinleri buradan düzenleyebilirsin.
 */
const QUESTION_BANK: MeetingSatisfactionQuestionDef[] = [
  // --- MEMNUNİYET SORULARI.docx kökenli sorular ---

  // Fit / konfor – device
  {
    id: 'fit_earmold_comfort',
    group: 'device',
    text: 'Kalıplar kulağınıza rahat oluyor mu, acıtma veya baskı yapıyor mu?',
  },
  {
    id: 'fit_dome_comfort',
    group: 'device',
    text: 'Domelar kulağınızdan çıkıyor mu veya acıtma, rahatsızlık yapıyor mu?',
  },

  // Genel ses deneyimi – device
  {
    id: 'sound_overall_experience',
    group: 'device',
    text: 'Tecrübe ettiğiniz bu süre içerisinde sesler sizin için nasıldı?',
  },
  {
    id: 'sound_any_disturbance',
    group: 'device',
    text: 'Rahatsız olduğunuz sesler veya durumlar var mıydı?',
  },
  {
    id: 'device_meets_expectation',
    group: 'device',
    text: 'Bu cihaz genel olarak beklentinizi karşılıyor mu?',
  },

  // Özel senaryolar – device
  {
    id: 'tv_listening',
    group: 'device',
    text: 'Televizyon izlerken sesler sizin için rahat ve anlaşılır geliyor mu?',
  },
  {
    id: 'phone_calls',
    group: 'communication',
    text: 'Telefonla konuşurken sesleri rahat duyup anlayabiliyor musunuz?',
  },
  {
    id: 'music_listening',
    group: 'device',
    text: 'Müzik dinlerken sesler sizin için nasıl, memnun musunuz?',
  },

  // Konuşma & iletişim – communication
  {
    id: 'speech_general_satisfaction',
    group: 'communication',
    text: 'Genel konuşma seslerinden ne kadar memnunsunuz?',
  },
  {
    id: 'service_from_us',
    group: 'service',
    text: 'Bizden aldığınız hizmetten genel olarak memnun musunuz?',
  },
  {
    id: 'noisy_environments',
    group: 'communication',
    text: 'Gürültülü ortamlarda (çarşı, pazar, trafik vb.) sesleri duyma seviyenizden memnun musunuz?',
  },

  // Kullanım kolaylığı – device
  {
    id: 'rechargeable_difficulty',
    group: 'device',
    text: 'Şarjlı cihazı kullanmakta zorlandığınız bir nokta var mı?',
  },
  {
    id: 'sound_quality',
    group: 'device',
    text: 'Cihazların genel ses kalitesini nasıl değerlendirirsiniz?',
  },

  // Fiziksel etkiler – device
  {
    id: 'headache_long_use',
    group: 'device',
    text: 'Cihazları uzun süreli kullanırken baş ağrısı yaşıyor musunuz?',
  },

  // Tercih ve değişiklik – service/device
  {
    id: 'buy_again_same_model',
    group: 'service',
    text: 'Tekrar işitme cihazı almak zorunda kalsanız aynı modeli tekrar tercih eder miydiniz?',
  },
  {
    id: 'what_to_change_on_device',
    group: 'device',
    text: 'Cihazla ilgili değiştirilmesini istediğiniz bir şey var mı?',
  },

  // Kendi sesiniz – communication
  {
    id: 'own_voice_natural',
    group: 'communication',
    text: 'Kendi sesiniz size doğal ve düzgün geliyor mu?',
  },

  // Diğer şikayetler – device/service
  {
    id: 'tinnitus_status',
    group: 'device',
    text: 'Çınlamanızın durumu nasıl, bir değişiklik fark ettiniz mi?',
  },
  {
    id: 'balance_status',
    group: 'device',
    text: 'Denge kaybınızda bir değişim hissettiniz mi?',
  },
  {
    id: 'memory_change',
    group: 'service',
    text: 'Unutkanlığınızda cihaz kullanımından sonra bir değişim var mı?',
  },
  {
    id: 'ask_repeat_often',
    group: 'communication',
    text: 'Söylenenleri sık sık tekrar ettirmek zorunda kalıyor musunuz?',
  },

  // --- HASTA İPUCU SORULARI AYARA BAŞLAMADAN.docx kökenli sorular ---

  {
    id: 'hint_phone_understanding',
    group: 'communication',
    text: 'Telefonda konuşulanları net anlayabiliyor musunuz?',
  },
  {
    id: 'hint_birds_children_bell',
    group: 'communication',
    text: 'Kuş sesi, kadın sesi, zil sesi, çocuk sesleri size nasıl geliyor?',
  },
  {
    id: 'hint_male_engine_car_door',
    group: 'device',
    text: 'Erkek sesi, motor sesi, araba sesi, kapı kapanma sesi size nasıl geliyor?',
  },
  {
    id: 'hint_noisy_places',
    group: 'communication',
    text: 'Kalabalıkta, çarşıda, pazarda, trafikte, gürültülü ortamlarda sesler size nasıl geliyor?',
  },
  {
    id: 'hint_tv_volume',
    group: 'device',
    text: 'Televizyon sesini normal seviyede mi kullanıyorsunuz yoksa yüksek seste mi açıyorsunuz?',
  },
  {
    id: 'hint_speaking_loudly',
    group: 'communication',
    text: 'Konuşurken sık sık bağırıyor musunuz?',
  },
  {
    id: 'hint_harsh_sounds',
    group: 'device',
    text: 'Rahatsız edici, kulağınızı tırmalayan sesler var mı?',
  },
  {
    id: 'hint_far_speaker_understanding',
    group: 'communication',
    text: 'Uzak mesafeden konuşan birini net duyabiliyor musunuz?',
  },
  {
    id: 'hint_far_calling_you',
    group: 'communication',
    text: 'Uzak mesafeden size seslenildiğinde duyabiliyor musunuz?',
  },
  {
    id: 'hint_whisper',
    group: 'communication',
    text: 'Fısıltılı sesleri duyup anlayabiliyor musunuz?',
  },
  {
    id: 'hint_loud_speech_disturb',
    group: 'communication',
    text: 'Bağırarak konuşulması sizi rahatsız ediyor mu?',
  },
  {
    id: 'hint_outside_change',
    group: 'device',
    text: 'Dışarı çıkınca seslerde bir değişim hissediyor musunuz?',
  },
  {
    id: 'hint_closed_space_change',
    group: 'device',
    text: 'Kapalı ortamda seslerde bir değişim hissediyor musunuz?',
  },
  {
    id: 'hint_silent_space_change',
    group: 'device',
    text: 'Sessiz ortamlarda sesleri nasıl duyuyorsunuz, bir değişiklik var mı?',
  },
  {
    id: 'hint_relatives_voices',
    group: 'communication',
    text: 'Yakınlarınızın sesleri size nasıl geliyor?',
  },
  {
    id: 'hint_cutlery_sounds',
    group: 'device',
    text: 'Çatal bıçak seslerini nasıl duyuyorsunuz?',
  },
  {
    id: 'hint_left_right_difference',
    group: 'device',
    text: 'Sağ ve sol kulağınızdan gelen seslerde fark hissediyor musunuz?',
  },
  {
    id: 'hint_workplace_sounds',
    group: 'communication',
    text: 'İş ortamındaki sesleri nasıl duyuyorsunuz?',
  },
  {
    id: 'hint_cleaning_care',
    group: 'service',
    text: 'Temizlik ve bakım konusunda zorlandığınız bir nokta var mı?',
  },
  {
    id: 'hint_ear_infection',
    group: 'service',
    text: 'Kulağınızda sık sık akıntı, enfeksiyon vb. durumlar oluyor mu?',
  },
];

// localStorage anahtarları
const STORAGE_KEY_PREFIX = 'meeting_satisfaction_answered_';

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getAnsweredQuestionIdsForPatient(patientId: string): string[] {
  const storage = getSafeLocalStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY_PREFIX + patientId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string');
  } catch {
    return [];
  }
}

export function markQuestionsAnsweredForPatient(
  patientId: string,
  questionIds: string[],
): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    const existing = new Set(getAnsweredQuestionIdsForPatient(patientId));
    for (const id of questionIds) {
      existing.add(id);
    }
    storage.setItem(
      STORAGE_KEY_PREFIX + patientId,
      JSON.stringify(Array.from(existing)),
    );
  } catch {
    // Sessizce yut – memnuniyet kaydı yine de meetings tablosuna gider
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Belirli bir hasta için 5 soruluk anket üretir.
 * - Önce daha önce sorulmamış soruları kullanmaya çalışır (localStorage’a göre).
 * - Her gruptan QUESTION_GROUP_TARGETS kadar soru seçer.
 * - Yeterli yeni soru yoksa, tüm havuzdan rastgele tamamlar.
 */
export function getSurveyQuestionsForPatient(
  patientId: string,
): MeetingSatisfactionQuestionWithAnswer[] {
  const answeredIds = new Set(getAnsweredQuestionIdsForPatient(patientId));

  // Henüz sorulmamış sorular
  let available = QUESTION_BANK.filter((q) => !answeredIds.has(q.id));
  if (available.length < 5) {
    // Tüm sorular bitmişse tekrar başa dön: tüm havuzu kullan
    available = QUESTION_BANK;
  }

  const byGroup = new Map<QuestionGroup, MeetingSatisfactionQuestionDef[]>();
  for (const q of available) {
    const list = byGroup.get(q.group) ?? [];
    list.push(q);
    byGroup.set(q.group, list);
  }

  const selected: MeetingSatisfactionQuestionDef[] = [];
  const usedIds = new Set<string>();

  // Gruplara göre hedef sayıda soru seç
  for (const [group, target] of Object.entries(
    QUESTION_GROUP_TARGETS,
  ) as [QuestionGroup, number][]) {
    const pool = byGroup.get(group) ?? [];
    const shuffled = shuffle(pool).filter((q) => !usedIds.has(q.id));
    const count = Math.min(target, shuffled.length);
    for (let i = 0; i < count; i++) {
      selected.push(shuffled[i]);
      usedIds.add(shuffled[i].id);
    }
  }

  // Toplam 5'e tamamla
  if (selected.length < 5) {
    const remainingPool = shuffle(available).filter(
      (q) => !usedIds.has(q.id),
    );
    for (const q of remainingPool) {
      if (selected.length >= 5) break;
      selected.push(q);
      usedIds.add(q.id);
    }
  }

  return selected.map((q) => ({
    ...q,
    score: null,
  }));
}

/**
 * HASTA İPUCU SORULARI (Ayara başlamadan önce) için ayrı liste.
 * Aynı metinler yukarıdaki QUESTION_BANK içinde de var, ama
 * istersen bu listeyi “ön görüşme / ipucu” ekranlarında kullanabilirsin.
 */
export interface PatientHintQuestionDef {
  id: string;
  text: string;
}

export const PATIENT_HINT_QUESTIONS: PatientHintQuestionDef[] = [
  {
    id: 'hint_phone_understanding',
    text: 'Telefonda konuşulanları net anlayabiliyor musunuz?',
  },
  {
    id: 'hint_birds_children_bell',
    text: 'Kuş sesi, kadın sesi, zil sesi, çocuk sesleri size nasıl geliyor?',
  },
  {
    id: 'hint_male_engine_car_door',
    text: 'Erkek sesi, motor sesi, araba sesi, kapı kapanma sesi size nasıl geliyor?',
  },
  {
    id: 'hint_noisy_places',
    text: 'Kalabalıkta, çarşıda, pazarda, trafikte, gürültülü ortamlarda sesler size nasıl geliyor?',
  },
  {
    id: 'hint_tv_volume',
    text: 'Televizyon sesini normal seviyede mi kullanıyorsunuz yoksa yüksek seste mi açıyorsunuz?',
  },
  {
    id: 'hint_speaking_loudly',
    text: 'Konuşurken sık sık bağırıyor musunuz?',
  },
  {
    id: 'hint_harsh_sounds',
    text: 'Rahatsız edici, kulağınızı tırmalayan sesler var mı?',
  },
  {
    id: 'hint_far_speaker_understanding',
    text: 'Uzak mesafeden konuşan birini net duyabiliyor musunuz?',
  },
  {
    id: 'hint_far_calling_you',
    text: 'Uzak mesafeden size seslenildiğinde duyabiliyor musunuz?',
  },
  {
    id: 'hint_whisper',
    text: 'Fısıltılı sesleri duyup anlayabiliyor musunuz?',
  },
  {
    id: 'hint_loud_speech_disturb',
    text: 'Bağırarak konuşulması sizi rahatsız ediyor mu?',
  },
  {
    id: 'hint_outside_change',
    text: 'Dışarı çıkınca seslerde bir değişim hissediyor musunuz?',
  },
  {
    id: 'hint_closed_space_change',
    text: 'Kapalı ortamda seslerde bir değişim hissediyor musunuz?',
  },
  {
    id: 'hint_silent_space_change',
    text: 'Sessiz ortamlarda sesleri nasıl duyuyorsunuz, bir değişiklik var mı?',
  },
  {
    id: 'hint_relatives_voices',
    text: 'Yakınlarınızın sesleri size nasıl geliyor?',
  },
  {
    id: 'hint_cutlery_sounds',
    text: 'Çatal bıçak seslerini nasıl duyuyorsunuz?',
  },
  {
    id: 'hint_left_right_difference',
    text: 'Sağ ve sol kulağınızdan gelen seslerde fark hissediyor musunuz?',
  },
  {
    id: 'hint_workplace_sounds',
    text: 'İş ortamındaki sesleri nasıl duyuyorsunuz?',
  },
  {
    id: 'hint_cleaning_care',
    text: 'Temizlik ve bakım konusunda zorlandığınız bir nokta var mı?',
  },
  {
    id: 'hint_ear_infection',
    text: 'Kulağınızda sık sık akıntı, enfeksiyon vb. durumlar oluyor mu?',
  },
];
