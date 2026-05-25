// src/features/meetings/meetingSatisfactionTypes.ts
// Summary: Shared types, constants and helpers for meeting satisfaction surveys.
// - 1–5 satisfaction scale (fixed labels).
// - Local question pool (memnuniyet + ipucu soruları).
// - Per-patient "do not repeat until all asked" logic via localStorage (device-based).
// - Types shared between MeetingNewFormCard and MeetingSatisfactionSurveySection/api.satisfaction.

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
  id: string; // Stable ID (do not change; used to track per-patient history)
  text: string;
  group: QuestionGroup;
  isHint: boolean; // true = "Hasta ipucu" soruları
}

// UI helper for NewMeeting form (local survey)
export interface MeetingSatisfactionQuestionWithAnswer
  extends MeetingSatisfactionQuestionDef {
  score: SatisfactionScore | null;
}

/**
 * DB-facing types for meeting_satisfaction_* tables.
 * These mirror the Supabase schema used by api.satisfaction.ts.
 */
export interface MeetingSatisfactionQuestionList {
  id: string;
  name: string;
  is_active: boolean;
  // Optional metadata (present in DB but not required by UI)
  description?: string | null;
  created_at?: string | null;
}

export interface MeetingSatisfactionQuestion {
  id: string;
  list_id: string;
  question_text: string;
  sort_order: number;
  is_active: boolean;
}

export interface MeetingSatisfactionAnswer {
  meeting_id: string;
  patient_id: string;
  list_id: string;
  question_id: string;
  score: SatisfactionScore | null;
  created_at?: string | null;
}

export interface MeetingSatisfactionPromptQuestion {
  prompt_id?: string | null;
  question_id: string;
  list_id: string;
  list_name: string;
  question_text: string;
  sort_order: number;
  prompt_order: number;
  score?: SatisfactionScore | null;
}

export interface MeetingSatisfactionDraft {
  questionIds: string[];
  answers: {
    questionId: string;
    score: SatisfactionScore;
  }[];
}

// Payload expected by saveMeetingSatisfaction() API helper
export interface SaveMeetingSatisfactionInput {
  meetingId: string;
  patientId: string;
  questionIds: string[];
  answers: {
    questionId: string;
    score: SatisfactionScore;
  }[];
}

/**
 * Local question pool
 * - Combined from: "MEMNUNİYET SORULARI" + "HASTA İPUCU SORULARI (CİHAZ KULLANANLAR İÇİN)"
 * - group: rough categorization for future reporting.
 * - isHint: marks "ipucu" style questions.
 */

export const ALL_SATISFACTION_QUESTIONS: MeetingSatisfactionQuestionDef[] = [
  // MEMNUNİYET SORULARI (isHint: false)
  {
    id: 'mem_01_kalip_rahatsiz',
    text: 'Kalıplar kulağınıza rahat oluyor mu, acıtma vs yapıyor mu?',
    group: 'device',
    isHint: false,
  },
  {
    id: 'mem_02_genel_memnuniyet',
    text: 'Genel olarak cihazlardan memnun musunuz?',
    group: 'service',
    isHint: false,
  },
  {
    id: 'mem_03_cevre_sesleri_anlasilirlik',
    text: 'Çevrenizdeki sesler (evde, işte, dışarıda) eskisine göre daha rahat anlaşılıyor mu?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_04_ev_ici_konusma_tv',
    text: 'Ev içindeyken, özellikle televizyon açıkken konuşmaları rahatça anlayabiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_05_ciha_siz_ve_ciha_li_karsilastirma',
    text: 'Cihazı takmadan ve taktıktan sonraki farkı net hissedebiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_06_ses_tonu_kalin_ince',
    text: 'Sesler olduğundan daha kalın, tiz ya da tok geliyor mu?',
    group: 'device',
    isHint: false,
  },
  {
    id: 'mem_07_gunluk_ses_rahatsizlik',
    text: 'Çevrede duyduğunuz normal günlük seslerde rahatsız olduğunuz sesler var mı?',
    group: 'device',
    isHint: false,
  },
  {
    id: 'mem_08_ev_tv_seviyesi',
    text: 'Evde televizyon izlerken cihazlarla birlikte ses seviyesini rahatça düşük tutabiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_09_kalabalik_ortam',
    text: 'Kalabalık bir ortamda (pazar, çarşı, toplu taşıma) konuşmaları takip edebiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_10_restoran_kafe',
    text: 'Restoran, kafe gibi ortamlarda karşıdaki kişiyi anlamakta zorlanıyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_11_yururken_denge_cevre_ses',
    text: 'Yolda yürürken hem çevre seslerini duyup hem de rahatça sohbet edebiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_12_telefon_gorusmesi',
    text: 'Telefonda konuşurken karşı tarafı net duyabiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_13_fisilti_ses',
    text: 'Sessiz bir ortamda fısıltı gibi daha kısık sesleri duyabiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_14_kalabalik_gurultu',
    text: 'Trafikte, pazarda veya gürültülü yerlerde cihazlar sizi rahatsız ediyor mu?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_15_alisveris',
    text: 'Alışveriş yaparken kasadaki kişiyle veya görevlilerle iletişimde zorluk yaşıyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_16_aile_ici_iletisim',
    text: 'Evde aile bireylerinizle konuşurken kendinizi rahat ifade edebiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_17_is_yeri_iletisim',
    text: 'İş yerinde çalışma arkadaşlarınızla veya müşterilerle iletişim kurarken zorluk yaşıyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_18_toplu_tasima',
    text: 'Toplu taşımada (otobüs, metro vb.) anonsları ve etrafınızdaki konuşmaları duyabiliyor musunuz?',
    group: 'communication',
    isHint: false,
  },
  {
    id: 'mem_19_kullanim_suresi',
    text: 'Cihazlarınızı gün içinde ortalama ne kadar süre takıyorsunuz?',
    group: 'service',
    isHint: false,
  },
  {
    id: 'mem_20_pil_degisimi',
    text: 'Pil değişimi konusunda zorlandığınız bir nokta var mı?',
    group: 'device',
    isHint: false,
  },
  {
    id: 'mem_21_temizlik_bakim',
    text: 'Cihazların temizlik ve bakımında zorlandığınız bir nokta var mı?',
    group: 'device',
    isHint: false,
  },

  // HASTA İPUCU SORULARI (CİHAZ KULLANANLAR İÇİN) – isHint: true
  {
    id: 'hint_01_telefon_konusma',
    text: 'Telefonda konuşulanları net anlayabiliyor musunuz?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_02_kus_cocuk_kadin_sesleri',
    text: 'Kuş sesi, kadın sesi, zil sesi, çocuk sesleri nasıl geliyor?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_03_erkek_motor_araba_kapi',
    text: 'Erkek sesi, motor sesi, araba sesi, kapı kapanma sesi nasıl geliyor?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_04_kalabalik_gurultulu_ortamlar',
    text: 'Kalabalıkta, çarşıda, pazarda, trafikte, gürültülü ortamlarda sesler nasıl geliyor?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_05_tv_ses_seviyesi',
    text: 'Televizyon sesini normal seviyede mi açıyorsunuz yoksa yüksek seste mi açıyorsunuz?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_06_konusurken_bagirma',
    text: 'Konuşurken farkında olmadan bağırıyor musunuz?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_07_rahatsiz_edici_sesler',
    text: 'Rahatsız edici, kulağınızı tırmalayan sesler var mı?',
    group: 'device',
    isHint: true,
  },
  {
    id: 'hint_08_uzak_mesafe_konusma',
    text: 'Uzak mesafeden konuşan birini net duyabiliyor musunuz?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_09_uzaktan_seslenme',
    text: 'Uzak mesafeden size seslenildiğinde duyabiliyor musunuz?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_10_fisilti_sesleri',
    text: 'Fısıltılı sesleri duyup anlayabiliyor musunuz?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_11_bagirarak_konusma_rahatsizlik',
    text: 'Bağırarak konuşulması sizi rahatsız ediyor mu?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_12_disari_cikinca_ses_degisim',
    text: 'Dışarı çıkınca sesler değişiyor mu?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_13_kapali_ortam_ses_degisim',
    text: 'Kapalı ortamda sesler değişiyor mu?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_14_sessiz_ortam_ses_degisim',
    text: 'Sessiz ortamda sesler değişiyor mu?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_15_yakinlar_sesleri',
    text: 'Yakınlarınızın sesleri nasıl geliyor?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_16_catal_bicak_sesleri',
    text: 'Çatal bıçak sesleri nasıl geliyor?',
    group: 'device',
    isHint: true,
  },
  {
    id: 'hint_17_sag_sol_kulak_fark',
    text: 'Sağ ve sol kulağınızdan gelen seslerde farklılık var mı?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_18_is_ortami_sesleri',
    text: 'İş ortamındaki sesler nasıl geliyor?',
    group: 'communication',
    isHint: true,
  },
  {
    id: 'hint_19_temizlik_bakim_zorluk',
    text: 'Temizlik ve bakım konusunda zorlandığınız bir nokta var mı?',
    group: 'device',
    isHint: true,
  },
  {
    id: 'hint_20_akitni_enfeksiyon',
    text: 'Kulağınızda sık sık akıntı, enfeksiyon vb. sorunlar oluyor mu?',
    group: 'service',
    isHint: true,
  },
];

// ---- LocalStorage helpers (per-patient question rotation) ----

const STORAGE_KEY_PREFIX = 'meeting_satisfaction_answered_';

function getStorageKeyForPatient(patientId: string): string {
  return `${STORAGE_KEY_PREFIX}${patientId}`;
}

function readAnsweredIds(patientId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getStorageKeyForPatient(patientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === 'string');
  } catch {
    return [];
  }
}

function writeAnsweredIds(patientId: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const unique = Array.from(new Set(ids));
    window.localStorage.setItem(
      getStorageKeyForPatient(patientId),
      JSON.stringify(unique),
    );
  } catch {
    // Ignore quota / JSON errors – survey will still work, only rotation may reset
  }
}

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Returns up to `maxQuestions` questions for the given patient.
 * - Uses ALL_SATISFACTION_QUESTIONS as pool.
 * - Tries not to repeat questions already asked to this patient on this device.
 * - When all questions are used, it resets and starts again from full pool.
 */
export function getSurveyQuestionsForPatient(
  patientId: string,
  maxQuestions = 5,
): MeetingSatisfactionQuestionWithAnswer[] {
  const answeredIds = readAnsweredIds(patientId);

  // Questions not yet asked to this patient
  let remaining = ALL_SATISFACTION_QUESTIONS.filter(
    (q) => !answeredIds.includes(q.id),
  );

  // If less than requested, reset the cycle
  if (remaining.length < maxQuestions) {
    remaining = ALL_SATISFACTION_QUESTIONS.slice();
  }

  const pickedBase = shuffle(remaining).slice(0, maxQuestions);

  return pickedBase.map((q) => ({
    ...q,
    score: null,
  }));
}

/**
 * Marks the given question ids as "asked" for this patient.
 * - Stored locally per device via localStorage.
 */
export function markQuestionsAnsweredForPatient(
  patientId: string,
  questionIds: string[],
): void {
  const existing = readAnsweredIds(patientId);
  const next = existing.concat(questionIds);
  writeAnsweredIds(patientId, next);
}
