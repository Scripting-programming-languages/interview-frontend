import { createChannel, createClient } from 'nice-grpc-web';
import { storage } from './axios';
import { QuestionStreamServiceDefinition } from '../grpc/interview';

const channel = createChannel('http://localhost:8080');
const client = createClient(QuestionStreamServiceDefinition, channel);

function getUserId() {
  const raw = localStorage.getItem('userId');
  const userId = Number(raw);
  return Number.isFinite(userId) ? userId : null;
}

export async function streamNextQuestion({ attemptId, onDelta }) {
  const accessToken = storage.get('accessToken');
  const userId = getUserId();

  if (!accessToken) {
    throw new Error('Не найден access token');
  }

  if (!userId) {
    throw new Error('Не найден userId в localStorage');
  }

  const request = {
    attemptId: Number(attemptId),
    userId,
  };

  const metadata = {
    authorization: `Bearer ${accessToken}`,
  };

  let fullText = '';
  let finalQuestion = null;
  let hasAnyChunk = false;

  try {
    const responseStream = client.streamNextQuestion(request, { metadata });

    for await (const chunk of responseStream) {
      hasAnyChunk = true;

      if (chunk.textDelta) {
        fullText += chunk.textDelta;
        onDelta?.(fullText, chunk.textDelta);
        continue;
      }

      if (chunk.finalData) {
        finalQuestion = {
          question_id: Number(chunk.finalData.questionId),
          full_text: chunk.finalData.fullText || fullText,
          complexity: chunk.finalData.complexity ?? null,
        };
      }
    }

    if (finalQuestion) {
      return finalQuestion;
    }

    if (fullText) {
      return {
        question_id: null,
        full_text: fullText,
        complexity: null,
      };
    }

    if (!hasAnyChunk) {
      return null;
    }

    return null;
  } catch (err) {
    throw new Error(err?.message || 'Ошибка при получении вопроса');
  }
}