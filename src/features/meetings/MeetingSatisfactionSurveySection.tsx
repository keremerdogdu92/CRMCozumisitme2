import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import {
  fetchMeetingSatisfactionPrompts,
  fetchSuggestedSatisfactionQuestions,
  saveMeetingSatisfaction,
} from './api.satisfaction';
import {
  SATISFACTION_OPTIONS,
  type MeetingSatisfactionDraft,
  type MeetingSatisfactionPromptQuestion,
  type SatisfactionScore,
} from './meetingSatisfactionTypes';

interface MeetingSatisfactionSurveySectionProps {
  meetingId?: string | null;
  patientId: string;
  mode?: 'draft' | 'edit';
  disabled?: boolean;
  onDraftChange?: (draft: MeetingSatisfactionDraft) => void;
  onSaved?: () => void;
}

type ScoresByQuestion = Record<string, SatisfactionScore | null>;

function buildDraft(
  questions: MeetingSatisfactionPromptQuestion[],
  scores: ScoresByQuestion,
): MeetingSatisfactionDraft {
  return {
    questionIds: questions.map((question) => question.question_id),
    answers: questions
      .map((question) => ({
        questionId: question.question_id,
        score: scores[question.question_id],
      }))
      .filter(
        (answer): answer is { questionId: string; score: SatisfactionScore } =>
          answer.score != null,
      ),
  };
}

export function MeetingSatisfactionSurveySection({
  meetingId = null,
  patientId,
  mode = 'edit',
  disabled = false,
  onDraftChange,
  onSaved,
}: MeetingSatisfactionSurveySectionProps) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<ScoresByQuestion>({});

  const query = useQuery({
    queryKey: ['meeting-satisfaction-prompts', mode, meetingId, patientId],
    enabled: !!patientId,
    queryFn: async () => {
      if (meetingId) {
        const existing = await fetchMeetingSatisfactionPrompts(meetingId);
        if (existing.length > 0) return existing;
      }

      return fetchSuggestedSatisfactionQuestions(patientId);
    },
  });

  const questions = useMemo(
    () => (query.data ?? []) as MeetingSatisfactionPromptQuestion[],
    [query.data],
  );

  useEffect(() => {
    const next: ScoresByQuestion = {};
    questions.forEach((question) => {
      next[question.question_id] = question.score ?? null;
    });
    setScores(next);
  }, [questions]);

  useEffect(() => {
    if (mode !== 'draft' || !onDraftChange) return;
    onDraftChange(buildDraft(questions, scores));
  }, [mode, onDraftChange, questions, scores]);

  const mutation = useMutation({
    mutationFn: saveMeetingSatisfaction,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['meeting-satisfaction-prompts', mode, variables.meetingId, patientId],
      });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === 'meetings',
      });
      onSaved?.();
    },
  });

  const averageScore = useMemo(() => {
    const filled = Object.values(scores).filter(
      (score): score is SatisfactionScore => score != null,
    );
    if (filled.length === 0) return null;
    const sum = filled.reduce((acc, score) => acc + score, 0);
    return sum / filled.length;
  }, [scores]);

  function handleScoreChange(questionId: string, value: SatisfactionScore) {
    setScores((current) => ({
      ...current,
      [questionId]: current[questionId] === value ? null : value,
    }));
  }

  async function handleSave() {
    if (!meetingId || questions.length === 0) return;

    await mutation.mutateAsync({
      meetingId,
      patientId,
      ...buildDraft(questions, scores),
    });
  }

  const isBusy = query.isLoading || mutation.isPending || disabled;
  const canSave = mode === 'edit' && !!meetingId && questions.length > 0 && !isBusy;

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Memnuniyet Anketi
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Sistem aktif soru listelerinden 5 soruyu otomatik secer. Bos
            birakilan sorular kaydi engellemez.
          </p>
        </div>

        {averageScore != null && (
          <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
            Ortalama: {averageScore.toFixed(2)} / 5
          </span>
        )}
      </div>

      {query.isLoading && (
        <p className="text-xs text-slate-500">Sorular yukleniyor...</p>
      )}

      {query.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {(query.error as Error)?.message ?? 'Sorular yuklenemedi.'}
        </p>
      )}

      {!query.isLoading && !query.isError && questions.length === 0 && (
        <p className="text-xs text-slate-500">
          Aktif memnuniyet sorusu bulunamadi. Ayarlar ekranindan soru listesi
          ekleyebilirsiniz.
        </p>
      )}

      {questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div
              key={question.question_id}
              className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-xs font-medium text-slate-800">
                  {index + 1}. {question.question_text}
                </p>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {question.list_name}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {SATISFACTION_OPTIONS.map((option) => {
                  const selected = scores[question.question_id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={[
                        'rounded-md border px-2 py-1 text-xs',
                        selected
                          ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                      onClick={() =>
                        handleScoreChange(question.question_id, option.value)
                      }
                      disabled={isBusy}
                    >
                      {option.value}. {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {mutation.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {(mutation.error as Error).message}
        </p>
      )}

      {mode === 'edit' && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            variant="primary"
          >
            {mutation.isPending ? 'Kaydediliyor...' : 'Memnuniyeti Kaydet'}
          </Button>
        </div>
      )}
    </div>
  );
}
