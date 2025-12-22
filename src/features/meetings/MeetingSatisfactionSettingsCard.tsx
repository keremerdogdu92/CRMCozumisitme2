// src/features/meetings/MeetingSatisfactionSettingsCard.tsx
// Summary: Admin settings card to manage meeting satisfaction survey lists and questions.
// - Lists (meeting_satisfaction_question_lists): create, rename, activate/deactivate.
// - Questions (meeting_satisfaction_questions): view, edit text, change order, activate/deactivate.
// - Uses org_id from current profile for inserts; RLS guards reads.

import { useEffect, useMemo, useState } from 'react';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import type {
  MeetingSatisfactionQuestionList,
  MeetingSatisfactionQuestion,
} from './meetingSatisfactionTypes';
import {
  fetchAllSatisfactionLists,
  fetchAllQuestionsForList,
  createSatisfactionList,
  updateSatisfactionList,
  createSatisfactionQuestion,
  updateSatisfactionQuestion,
} from './api.satisfaction';

type ListStatus = 'idle' | 'loading' | 'saving';

type QuestionStatus = 'idle' | 'loading' | 'saving';

export function MeetingSatisfactionSettingsCard() {
  const { data: profile } = useCurrentProfile();
  const orgId = profile?.org_id ?? null;

  const [lists, setLists] = useState<MeetingSatisfactionQuestionList[]>([]);
  const [listsStatus, setListsStatus] = useState<ListStatus>('idle');
  const [listsError, setListsError] = useState<string | null>(null);

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedListSaving, setSelectedListSaving] =
    useState<boolean>(false);

  const [newListName, setNewListName] = useState('');
  const [newListSaving, setNewListSaving] = useState<boolean>(false);

  const [questions, setQuestions] = useState<MeetingSatisfactionQuestion[]>(
    [],
  );
  const [questionsStatus, setQuestionsStatus] =
    useState<QuestionStatus>('idle');
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionSaving, setNewQuestionSaving] =
    useState<boolean>(false);

  // Load all lists on mount
  useEffect(() => {
    if (!orgId) return;
    void loadLists();
  }, [orgId]);

  async function loadLists(initialSelect: boolean = true) {
    setListsStatus('loading');
    setListsError(null);
    try {
      const data = await fetchAllSatisfactionLists();
      setLists(data);
      setListsStatus('idle');

      if (initialSelect) {
        const activeFirst =
          data.find((l) => l.is_active) ?? data[0] ?? null;
        setSelectedListId(activeFirst ? activeFirst.id : null);
      }
    } catch (err) {
      console.error('MeetingSatisfactionSettingsCard loadLists error', err);
      setListsStatus('idle');
      setListsError(
        'Listeler alınırken bir hata oluştu. Lütfen sayfayı yenileyin.',
      );
    }
  }

  // Load questions when selected list changes
  useEffect(() => {
    if (!selectedListId) {
      setQuestions([]);
      return;
    }
    void loadQuestions(selectedListId);
  }, [selectedListId]);

  async function loadQuestions(listId: string) {
    setQuestionsStatus('loading');
    setQuestionsError(null);
    try {
      const data = await fetchAllQuestionsForList(listId);
      setQuestions(data);
      setQuestionsStatus('idle');
    } catch (err) {
      console.error(
        'MeetingSatisfactionSettingsCard loadQuestions error',
        err,
      );
      setQuestionsStatus('idle');
      setQuestionsError(
        'Sorular alınırken bir hata oluştu. Lütfen sayfayı yenileyin.',
      );
    }
  }

  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) ?? null,
    [lists, selectedListId],
  );

  if (!orgId) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Memnuniyet Soruları
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Oturumda geçerli bir organizasyon bulunamadı. Lütfen tekrar
          giriş yapın veya sistem yöneticinize başvurun.
        </p>
      </section>
    );
  }

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;

    setNewListSaving(true);
    try {
      const created = await createSatisfactionList({
        orgId,
        name: newListName,
      });
      setNewListName('');
      // Reload lists and select the new one
      await loadLists(false);
      setSelectedListId(created.id);
    } catch (err) {
      console.error(
        'MeetingSatisfactionSettingsCard handleCreateList error',
        err,
      );
    } finally {
      setNewListSaving(false);
    }
  }

  async function handleSaveSelectedList(patch: {
    name?: string;
    is_active?: boolean;
  }) {
    if (!selectedList) return;
    setSelectedListSaving(true);
    try {
      const updated = await updateSatisfactionList({
        listId: selectedList.id,
        patch,
      });
      setLists((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l)),
      );
    } catch (err) {
      console.error(
        'MeetingSatisfactionSettingsCard handleSaveSelectedList error',
        err,
      );
    } finally {
      setSelectedListSaving(false);
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedList || !newQuestionText.trim()) return;

    setNewQuestionSaving(true);
    try {
      const maxSort =
        questions.reduce(
          (max, q) => (q.sort_order > max ? q.sort_order : max),
          0,
        ) || 0;
      const nextSort = maxSort + 10;

      const created = await createSatisfactionQuestion({
        orgId,
        listId: selectedList.id,
        questionText: newQuestionText,
        sortOrder: nextSort,
      });

      setNewQuestionText('');
      setQuestions((prev) => [...prev, created]);
    } catch (err) {
      console.error(
        'MeetingSatisfactionSettingsCard handleAddQuestion error',
        err,
      );
    } finally {
      setNewQuestionSaving(false);
    }
  }

  async function handleUpdateQuestion(
    questionId: string,
    patch: Partial<Pick<MeetingSatisfactionQuestion, 'question_text' | 'sort_order' | 'is_active'>>,
  ) {
    const existing = questions.find((q) => q.id === questionId);
    if (!existing) return;

    // Optimistic local update
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, ...patch } : q,
      ),
    );

    try {
      const updated = await updateSatisfactionQuestion({
        questionId,
        patch: {
          question_text: patch.question_text ?? existing.question_text,
          sort_order: patch.sort_order ?? existing.sort_order,
          is_active:
            typeof patch.is_active === 'boolean'
              ? patch.is_active
              : existing.is_active,
        },
      });

      setQuestions((prev) =>
        prev.map((q) => (q.id === updated.id ? updated : q)),
      );
    } catch (err) {
      console.error(
        'MeetingSatisfactionSettingsCard handleUpdateQuestion error',
        err,
      );
      // On error, reload from server to avoid stale state
      if (selectedListId) {
        void loadQuestions(selectedListId);
      }
    }
  }

  return (
    <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Memnuniyet Soruları
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Görüşme memnuniyet anketlerinde kullanılacak soru listelerini
            ve soruları yönetin. Listeleri aktif/pasif yapabilir, her liste
            için soruları düzenleyebilirsiniz.
          </p>
        </div>
      </div>

      {listsStatus === 'loading' && (
        <p className="text-xs text-slate-500">
          Listeler yükleniyor...
        </p>
      )}

      {listsError && (
        <p className="text-xs text-red-600">{listsError}</p>
      )}

      <div className="mt-2 grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        {/* Left: Lists */}
        <div className="space-y-3 border-r border-slate-100 pr-0 md:pr-3">
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">
                Soru Listeleri
              </p>
              <p className="text-[11px] text-slate-500">
                Örn: Genel Kontrol, Teslimat Sonrası, Deneme Hastası vb.
              </p>
            </div>

            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {lists.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-slate-500">
                  Henüz tanımlı bir liste yok. Aşağıdan yeni liste
                  oluşturabilirsiniz.
                </div>
              )}

              {lists.map((list) => {
                const isSelected = list.id === selectedListId;
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] ${
                      isSelected
                        ? 'bg-primary-50 text-primary-800'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{list.name}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
                        list.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {list.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleCreateList}
            className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3"
          >
            <label className="block text-[11px] font-medium text-slate-700">
              Yeni Liste Oluştur
            </label>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Örn: Genel Kontrol"
            />
            <button
              type="submit"
              disabled={newListSaving || !newListName.trim()}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {newListSaving ? 'Oluşturuluyor...' : 'Liste Oluştur'}
            </button>
          </form>
        </div>

        {/* Right: Selected list details + questions */}
        <div className="space-y-4">
          {!selectedList && (
            <p className="text-xs text-slate-500">
              Sağ tarafta düzenlemek için soldan bir liste seçin veya yeni
              bir liste oluşturun.
            </p>
          )}

          {selectedList && (
            <>
              {/* Selected list header / edit */}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-700">
                      Liste Adı
                    </label>
                    <input
                      type="text"
                      value={selectedList.name}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        setLists((prev) =>
                          prev.map((l) =>
                            l.id === selectedList.id
                              ? { ...l, name: nextName }
                              : l,
                          ),
                        );
                      }}
                      onBlur={() =>
                        void handleSaveSelectedList({
                          name: selectedList.name,
                        })
                      }
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-300"
                        checked={selectedList.is_active}
                        onChange={(e) =>
                          void handleSaveSelectedList({
                            is_active: e.target.checked,
                          })
                        }
                      />
                      Aktif liste
                    </label>

                    <button
                      type="button"
                      disabled={selectedListSaving}
                      onClick={() =>
                        void handleSaveSelectedList({
                          name: selectedList.name,
                          is_active: selectedList.is_active,
                        })
                      }
                      className="inline-flex items-center rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {selectedListSaving ? 'Kaydediliyor...' : 'Listeyi Kaydet'}
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-slate-500">
                  Bu listeyi memnuniyet anketinde kullanmak istediğiniz
                  durumda &quot;Aktif&quot; bırakın. İleride farklı listeler
                  arasında geçiş yapabilirsiniz.
                </p>
              </div>

              {/* Questions */}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Sorular
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Sıra numarasına göre anket formunda listelenecek.
                      Soruyu tamamen silmek yerine pasif bırakmanız tavsiye
                      edilir.
                    </p>
                  </div>
                  {questionsStatus === 'loading' && (
                    <p className="text-[11px] text-slate-500">
                      Sorular yükleniyor...
                    </p>
                  )}
                </div>

                {questionsError && (
                  <p className="mb-2 text-[11px] text-red-600">
                    {questionsError}
                  </p>
                )}

                <div className="space-y-2">
                  {questions.length === 0 && (
                    <p className="text-[11px] text-slate-500">
                      Bu listede henüz soru yok. Aşağıdan yeni soru
                      ekleyebilirsiniz.
                    </p>
                  )}

                  {questions.map((q) => (
                    <div
                      key={q.id}
                      className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_80px_90px]"
                    >
                      <div className="space-y-1">
                        <label className="block text-[10px] font-medium text-slate-700">
                          Soru Metni
                        </label>
                        <textarea
                          value={q.question_text}
                          onChange={(e) => {
                            const nextText = e.target.value;
                            setQuestions((prev) =>
                              prev.map((row) =>
                                row.id === q.id
                                  ? { ...row, question_text: nextText }
                                  : row,
                              ),
                            );
                          }}
                          onBlur={() =>
                            void handleUpdateQuestion(q.id, {
                              question_text: q.question_text,
                            })
                          }
                          rows={2}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-medium text-slate-700">
                          Sıra
                        </label>
                        <input
                          type="number"
                          value={q.sort_order}
                          onChange={(e) => {
                            const parsed = Number(e.target.value) || 0;
                            setQuestions((prev) =>
                              prev.map((row) =>
                                row.id === q.id
                                  ? { ...row, sort_order: parsed }
                                  : row,
                              ),
                            );
                          }}
                          onBlur={() =>
                            void handleUpdateQuestion(q.id, {
                              sort_order: q.sort_order,
                            })
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      <div className="flex flex-col items-start justify-between gap-1">
                        <label className="inline-flex items-center gap-1 text-[10px] text-slate-700">
                          <input
                            type="checkbox"
                            className="h-3 w-3 rounded border-slate-300"
                            checked={q.is_active}
                            onChange={(e) =>
                              void handleUpdateQuestion(q.id, {
                                is_active: e.target.checked,
                              })
                            }
                          />
                          Aktif
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateQuestion(q.id, {
                              is_active: false,
                            })
                          }
                          className="mt-1 inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Pasif Yap
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleAddQuestion}
                  className="mt-3 space-y-2 rounded-md border border-dashed border-slate-300 p-3"
                >
                  <label className="block text-[11px] font-medium text-slate-700">
                    Yeni Soru Ekle
                  </label>
                  <textarea
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Örn: Genel olarak cihazlardan memnun musunuz?"
                  />
                  <button
                    type="submit"
                    disabled={
                      newQuestionSaving || !newQuestionText.trim()
                    }
                    className="inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {newQuestionSaving
                      ? 'Soru ekleniyor...'
                      : 'Soru Ekle'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
