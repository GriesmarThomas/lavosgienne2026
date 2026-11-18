import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { hasSameOrigin, isAuthenticated } from '../../server/admin-auth.js';
import {
  loadQuestionBank,
  loadQuestions,
  parseQuestion,
  parseRequestBody,
  saveQuestions
} from '../../server/question-store.js';
import {
  deleteQuestionImages,
  parseQuestionImageUploads,
  questionImageIdFromUrl,
  uploadQuestionImages
} from '../../server/question-images.js';
import {
  hasExactlyOneCorrectChoice,
  resolveCategoryName,
  type Question
} from '../../src/app/core/models/question.model.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  }
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (!isAuthenticated(request)) {
    return response.status(401).json({ error: 'Authentification requise.' });
  }

  if (request.method !== 'GET' && !hasSameOrigin(request)) {
    return response.status(403).json({ error: 'Origine de requête invalide.' });
  }

  try {
    if (request.method === 'GET') {
      return response.status(200).json(await loadQuestions());
    }

    if (request.method === 'POST') {
      const bank = await loadQuestionBank();
      const body = parseRequestBody(request.body);
      if (!body) {
        return response.status(400).json({ error: 'Question invalide.' });
      }

      const photoUploads = parseQuestionImageUploads(body.photoUploads);
      if (!photoUploads) {
        return response.status(400).json({ error: 'Les photos sélectionnées sont invalides ou trop volumineuses.' });
      }

      const questionBody = { ...body };
      delete questionBody.photoUploads;
      const id = Math.max(0, ...bank.questions.map((question) => question.id)) + 1;
      const question = parseQuestion({ ...questionBody, id });
      if (!question || !hasExactlyOneCorrectChoice(question)) {
        return response.status(400).json({ error: 'Les champs de la question sont invalides.' });
      }
      question.category = resolveCategoryName(
        question.category,
        bank.questions.map((existingQuestion) => existingQuestion.category)
      );

      const uploadedImages = await uploadQuestionImages(photoUploads);
      if (uploadedImages.urls.length) {
        question.images = [...(question.images ?? []), ...uploadedImages.urls];
      }

      const updatedQuestions = [...bank.questions, question];
      try {
        await saveQuestions(updatedQuestions, bank.etag);
      } catch (error) {
        try {
          await deleteQuestionImages(uploadedImages.ids);
        } catch (cleanupError) {
          console.error('Unable to clean up images after a failed question save:', cleanupError);
        }

        throw error;
      }

      return response.status(201).json(question);
    }

    if (request.method === 'PUT') {
      const bank = await loadQuestionBank();
      const body = parseRequestBody(request.body);
      const question = parseQuestion(body);
      if (!question || !hasExactlyOneCorrectChoice(question)) {
        return response.status(400).json({ error: 'Les champs de la question sont invalides.' });
      }
      question.category = resolveCategoryName(
        question.category,
        bank.questions
          .filter((existingQuestion) => existingQuestion.id !== question.id)
          .map((existingQuestion) => existingQuestion.category)
      );

      const questionIndex = bank.questions.findIndex((item) => item.id === question.id);
      if (questionIndex < 0) {
        return response.status(404).json({ error: 'Question introuvable.' });
      }

      const updatedQuestions = [...bank.questions];
      updatedQuestions[questionIndex] = question;
      await saveQuestions(updatedQuestions, bank.etag);
      return response.status(200).json(question);
    }

    if (request.method === 'DELETE') {
      const bank = await loadQuestionBank();
      const id = Number(request.query.id);
      if (!Number.isInteger(id) || id < 1) {
        return response.status(400).json({ error: 'Identifiant de question invalide.' });
      }

      const updatedQuestions = bank.questions.filter((question) => question.id !== id);
      if (updatedQuestions.length === bank.questions.length) {
        return response.status(404).json({ error: 'Question introuvable.' });
      }

      await saveQuestions(updatedQuestions, bank.etag);
      const removedQuestion = bank.questions.find((question) => question.id === id);
      if (removedQuestion) {
        const remainingImageIds = new Set(
          updatedQuestions.flatMap((question) =>
            questionImages(question).map(questionImageIdFromUrl).filter(isNotNull)
          )
        );
        const imageIdsToDelete = questionImages(removedQuestion)
          .map(questionImageIdFromUrl)
          .filter(isNotNull)
          .filter((imageId) => !remainingImageIds.has(imageId));

        try {
          await deleteQuestionImages(imageIdsToDelete);
        } catch (cleanupError) {
          console.error('Unable to clean up images for a deleted question:', cleanupError);
        }
      }

      return response.status(200).json({ deletedId: id });
    }

    function questionImages(question: Question): string[] {
      const images = question.images ?? [];
      return images.length ? images : question.image ? [question.image] : [];
    }

    function isNotNull<T>(value: T | null): value is T {
      return value !== null;
    }

    response.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return response.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      return response.status(409).json({
        error: 'La banque de questions a changé en parallèle. Recharge la liste et réessaie.'
      });
    }

    console.error('Unable to update quiz questions:', error);
    return response.status(500).json({ error: 'Impossible de modifier les questions.' });
  }
}
