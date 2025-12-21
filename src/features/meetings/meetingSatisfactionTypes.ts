// src/features/meetings/meetingSatisfactionTypes.ts
// Summary: Shared types, constants and helpers for meeting satisfaction surveys.
// - 1–5 memnuniyet ölçeği (metin karşılıkları ile)
// - Lokal soru havuzu (örnek 15 soru)
// - Hasta bazlı, localStorage üzerinden "sorular tekrar dönmesin" mantığı (cihaz bazlı).

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

// -----------------------------------------------------------------------------
// DB-backed types (Supabase tablolari ile uyumlu tipler)
// - meeting_satisfaction_question_lists
// - meeting_satisfaction_questions
// - meeting_satisfaction_answers
// -----------------------------------------------------------------------------

export interface MeetingSatisfactionQuestionList {
  id: string;
  name: string;
  is_active: boolean;
}

export interface MeetingSatisfactionQuestion {
  id: string;
  list_id: string;
  question_text: string;
  sort_order: number;
  is_active: boolean;
}

export interface MeetingSatisfactionAnswer {
  id: string;
  meeting_id: string;
  patient_id: string;
  list_id: string;
  question_id: string;
  score: SatisfactionScore | null;
}

export interface SaveMeetingSatisfactionInput {
  meetingId: string;
  patientId: string;
  listId: string;
  answers: {
    questionId: string;
    score: SatisfactionScore;
  }[];
}

// -----------------------------------------------------------------------------
// Lokal soru havuzu (DB dışı, opsiyonel kullanım için)
// -----------------------------------------------------------------------------

export type QuestionGroup = 'service' | 'device' | 'communication';

export interface MeetingSatisfactionQuestionDef {
  id: string; // Sabit ID (değiştirme, soruyu silersen komple kaldır)
  group: QuestionGroup;
  text: string;
}

export interface MeetingSatisfactionQuestionWithAnswer
  extends MeetingSatisfactionQuestionDef {
  score: SatisfactionScore | null;
}

// Örnek 15 soruluk havuz
// Not: Metinleri istediğin gibi değiştirebilirsin; ID’leri sabit bırak.
const QUESTION_BANK: MeetingSatisfactionQuestionDef[] = [
  // Service
  {
    id: 'service_1',
    group: 'service',
    text: 'Karşılama ve randevu sürecinin genel işleyişinden ne kadar memnunsunuz?',
  },
  {
    id: 'service_2',
    group: 'service',
    text: 'Merkezimizde bekleme süresi ve konforunu nasıl değerlendirirsiniz?',
  },
  {
    id: 'service_3',
    group: 'service',
    text: 'Kontrol randevularının düzenliliği ve takibi sizi ne kadar tatmin ediyor?',
  },
  {
    id: 'service_4',
    group: 'service',
    text: 'Genel hizmet kalitemizden ne kadar memnunsunuz?',
  },
  {
    id: 'service_5',
    group: 'service',
    text: 'Merkezimize olan güven düzeyinizi nasıl değerlendirirsiniz?',
  },

  // Device
  {
    id: 'device_1',
    group: 'device',
    text: 'Kullandığınız işitme cihazının genel performansından ne kadar memnunsunuz?',
  },
  {
    id: 'device_2',
    group: 'device',
    text: 'Cihazın ses kalitesini ve netliğini nasıl değerlendirirsiniz?',
  },
  {
    id: 'device_3',
    group: 'device',
    text: 'Gürültülü ortamlarda cihazdan aldığınız fayda sizi ne kadar tatmin ediyor?',
  },
  {
    id: 'device_4',
    group: 'device',
    text: 'Cihazın kullanım kolaylığından (tuşlar, şarj, pil vb.) ne kadar memnunsunuz?',
  },
  {
    id: 'device_5',
    group: 'device',
    text: 'Cihaz ayarlarının ihtiyacınıza uygun olduğunu düşünüyor musunuz?',
  },

  // Communication
  {
    id: 'communication_1',
    group: 'communication',
    text: 'İhtiyaçlarınızı ve şikayetlerinizi anlatırken ne kadar rahat hissediyorsunuz?',
  },
  {
    id: 'communication_2',
    group: 'communication',
    text: 'Size yapılan açıklamaların (cihaz, fiyat, süreç) anlaşılır olmasından memnun musunuz?',
  },
  {
    id: 'communication_3',
    group: 'communication',
    text: 'Sorularınıza verilen cevapları ne kadar yeterli buluyorsunuz?',
  },
  {
    id: 'communication_4',
    group: 'communication',
    text: 'İletişim dilimizin samimiyet ve saygı açısından seviyesini nasıl değerlendirirsiniz?',
  },
  {
    id: 'communication_5',
    group: 'communication',
    text: 'Genel iletişim sürecimizden ne kadar memnunsunuz?',
  },
];

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
 * - Her gruptan hedef sayıda soru seçer (service:2, device:2, communication:1).
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

  const targetByGroup: Record<QuestionGroup, number> = {
    service: 2,
    device: 2,
    communication: 1,
  };

  const byGroup = new Map<QuestionGroup, MeetingSatisfactionQuestionDef[]>();
  for (const q of available) {
    const list = byGroup.get(q.group) ?? [];
    list.push(q);
    byGroup.set(q.group, list);
  }

  const selected: MeetingSatisfactionQuestionDef[] = [];
  const usedIds = new Set<string>();

  for (const [group, target] of Object.entries(targetByGroup) as [
    QuestionGroup,
    number,
  ][]) {
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
