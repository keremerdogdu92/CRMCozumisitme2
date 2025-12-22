// src/features/meetings/MeetingSatisfactionSurveySection.tsx
// Summary: 5-question satisfaction survey section for meetings.
// - Pulls active question lists and questions.
// - Lets user pick a list and answer 1-5 with fixed labels.
// - On submit, calls saveMeetingSatisfaction() with all answers.

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import {
  fetchActiveSatisfactionLists,
  fetchQuestionsForList,
  fetchAnswersForMeeting,
  saveMeetingSatisfaction,
} from './api.satisfaction';
import {
  SATISFACTION_OPTIONS,
  type MeetingSatisfactionQuestion,
  type SatisfactionScore,
} from './meetingSatisfactionTypes';
import { useCurrentProfile } from '../auth/useCurrentProfile';

interface MeetingSatisfactionSurveySectionProps {
  meetingId: string | null; // null for brand new meetings (pre-save)
  patientId: string;
  /**
   * When creating a new meeting, parent form can call this after meeting is saved
   * to pass the new meetingId so this component can persist answers.
   */
  onRequireMeetingId?: () => void;
}

type QuestionWithAnswer = {
  question: MeetingSatisfactionQuestion;
  score: SatisfactionScore | null;
};

export function MeetingSatisfactionSurveySection(
  props: MeetingSatisfactionSurveySectionProps,
) {
  const { meetingId, patientId, onRequireMeetingId } = props;
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Fetch lists
  const { data: lists, isLoading: loadingLists } = useQuery({
    queryKey: ['meeting-satisfaction-lists', profile?.org_id],
    queryFn: fetchActiveSatisfactionLists,
  });

  // If we already have a meetingId, load existing answers to pre-fill.
  const { data: existingAnswers, isLoading: loadingExisting } = useQuery({
    queryKey: ['meeting-satisfaction-answers', meetingId],
    queryFn: () =>
      meetingId ? fetchAnswersForMeeting(meetingId) : Promise.resolve([]),
    enabled: !!meetingId,
  });

  // Load questions when list changes
  useEffect(() => {
    let cancelled = false;

    async function loadQuestions(listId: string) {
      setLoadingQuestions(true);
      try {
        const qs: MeetingSatisfactionQuestion[] =
          await fetchQuestionsForList(listId);

        if (cancelled) return;

        const mapped: QuestionWithAnswer[] = qs.map((q) => {
          const existing = existingAnswers?.find(
            (a) => a.question_id === q.id,
          );
          return {
            question: q,
            score: (existing?.score as SatisfactionScore | undefined) ?? null,
          };
        });

        // Limit to 5 questions (as requested)
        setQuestions(mapped.slice(0, 5));
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    }

    if (selectedListId) {
      loadQuestions(selectedListId);
    } else {
      setQuestions([]);
    }

    return () => {
      cancelled = true;
    };
  }, [selectedListId, existingAnswers]);

  const mutation = useMutation({
    mutationFn: saveMeetingSatisfaction,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['meeting-satisfaction-answers', variables.meetingId],
      });
    },
  });

  const averageScore = useMemo(() => {
    const filled = questions.filter((q) => q.score != null);
    if (filled.length === 0) return null;
    const sum = filled.reduce((acc, q) => acc + (q.score ?? 0), 0);
    return sum / filled.length;
  }, [questions]);

  function handleScoreChange(questionId: string, value: SatisfactionScore) {
    setQuestions((prev) =>
      prev.map((qa) =>
        qa.question.id === questionId ? { ...qa, score: value } : qa,
      ),
    );
  }

  async function handleSave() {
    if (!meetingId) {
      // Parent must first persist the meeting so we can use its id.
      if (onRequireMeetingId) {
        onRequireMeetingId();
      }
      return;
    }
    if (!selectedListId) return;

    const filledAnswers = questions.filter(
      (q) => q.score != null,
    ) as QuestionWithAnswer[];

    const payload = {
      meetingId,
      patientId,
      listId: selectedListId,
      answers: filledAnswers.map((q) => ({
        questionId: q.question.id,
        score: q.score as SatisfactionScore,
      })),
    };

    await mutation.mutateAsync(payload);
  }

  const disabled =
    loadingLists || loadingQuestions || loadingExisting || mutation.isPending;

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          Memnuniyet Anketi (5 soru)
        </h3>
        {averageScore != null && (
          <span className="text-xs text-gray-600">
            Ortalama skor: {averageScore.toFixed(2)} / 5
          </span>
        )}
      </div>

      {/* List selector */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">Anket tipi</label>
        <select
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={selectedListId ?? ''}
          onChange={(e) => setSelectedListId(e.target.value || null)}
          disabled={disabled || !lists || lists.length === 0}
        >
          <option value="">Seçiniz...</option>
          {lists?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {(!lists || lists.length === 0) && !loadingLists && (
          <p className="text-xs text-gray-500">
            Henüz tanımlı anket listesi yok. Önce yönetim panelinden ekleyin.
          </p>
        )}
      </div>

      {/* Questions */}
      {selectedListId && (
        <div className="space-y-3">
          {loadingQuestions && (
            <p className="text-xs text-gray-500">Sorular yükleniyor...</p>
          )}

          {!loadingQuestions &&
            questions.map((qa) => (
              <div key={qa.question.id} className="space-y-1">
                <p className="text-xs font-medium text-gray-800">
                  {qa.question.sort_order + 1}. {qa.question.question_text}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SATISFACTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={[
                        'rounded-md border px-2 py-1 text-xs',
                        qa.score === opt.value
                          ? 'border-blue-500 bg-blue-50 font-semibold'
                          : 'border-gray-300 bg-white',
                      ].join(' ')}
                      onClick={() =>
                        handleScoreChange(qa.question.id, opt.value)
                      }
                      disabled={disabled}
                    >
                      {opt.value}. {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

          {questions.length > 5 && (
            <p className="text-[10px] text-gray-400">
              Not: Şu anda yalnızca ilk 5 soru kullanılmaktadır.
            </p>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={disabled || !selectedListId}
          variant="primary"
        >
          Anket Cevaplarını Kaydet
        </Button>
      </div>
    </div>
  );
}
