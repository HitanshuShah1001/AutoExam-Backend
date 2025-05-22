import express from "express";
import { questionController } from "../controllers/questionController.js";

const questionRouter = express.Router();

/**
 * @openapi
 * /question/upsert:
 *   post:
 *     tags:
 *       - question
 *     summary: Create or update a question
 *     description: If `id` is provided, updates the existing question; otherwise, creates a new one. Also optionally links the question to a question paper if `questionPaperId` is provided.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: number
 *                 description: The question ID. If provided, the question is updated. If not, a new question is created.
 *               type:
 *                 type: string
 *                 description: The question type (e.g. "mcq", "descriptive").
 *               questionText:
 *                 type: string
 *                 description: The text or body of the question.
 *               marks:
 *                 type: number
 *                 description: The mark(s) allocated to the question.
 *               difficulty:
 *                 type: string
 *                 description: The difficulty level (e.g., "easy", "medium", "hard").
 *               options:
 *                 type: array
 *                 description: An optional array of answer options (for MCQ or similar).
 *                 items:
 *                   type: string
 *               imageUrl:
 *                 type: string
 *                 description: Optional URL of an image associated with the question.
 *               questionPaperId:
 *                 type: number
 *                 description: If provided (and a new question is created), the question is linked to this paper.
 *               section:
 *                 type: string
 *                 description: If linking to a question paper, the section name (e.g., "A", "B").
 *               orderIndex:
 *                 type: number
 *                 description: If linking to a question paper, the display order for this question.
 *             required:
 *               - type
 *               - questionText
 *               - marks
 *               - difficulty
 *     responses:
 *       200:
 *         description: Successfully created or updated the question.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 question:
 *                   type: object
 *                   description: The newly created or updated question data.
 *       400:
 *         description: Missing required fields.
 *       404:
 *         description: Question to update was not found.
 *       500:
 *         description: Failed to upsert question due to server error.
 */
questionRouter.post("/upsert", questionController.upsertQuestion);

/**
 * @openapi
 * /question/getPaginatedQuestions:
 *   post:
 *     tags:
 *       - question
 *     summary: Fetch questions with pagination
 *     description: Returns a list of questions filtered by optional type, difficulty, or marks. Supports pagination via `cursor` (based on `updatedAt`) and `limit`.
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         required: false
 *         description: Fetch questions updated before this timestamp (ISO string). Used for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         required: false
 *         description: Maximum number of questions to fetch. Defaults to 10.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: Filter questions by their type (e.g., "MCQ").
 *               difficulty:
 *                 type: string
 *                 description: Filter questions by difficulty (e.g., "easy").
 *               marks:
 *                 type: number
 *                 description: Filter questions by exact marks value.
 *     responses:
 *       200:
 *         description: Successfully fetched paginated questions.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Question model data.
 *                 hasNextPage:
 *                   type: boolean
 *                   description: Indicates if more results are available.
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *                   description: The `updatedAt` timestamp to use as the next cursor (if `hasNextPage` is true).
 *       500:
 *         description: Internal server error while fetching questions.
 */
questionRouter.post(
  "/getPaginatedQuestions",
  questionController.getPaginatedQuestions
);

/**
 * @openapi
 * /question/delete:
 *   delete:
 *     tags:
 *       - question
 *     summary: Delete a question
 *     description: Removes the specified question from the database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: number
 *                 description: The ID of the question to delete.
 *     responses:
 *       200:
 *         description: Successfully deleted the question.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Question deleted successfully"
 *       400:
 *         description: No question ID provided.
 *       404:
 *         description: The specified question was not found.
 *       500:
 *         description: Failed to delete question due to server error.
 */
questionRouter.delete("/delete", questionController.deleteQuestion);

questionRouter.post("/create-bulk", questionController.createQuestions);

questionRouter.post(
  "/populate-question-metadata",
  questionController.updateQuestionsMetadataFromExam
);

questionRouter.post("/get-chapters", questionController.getChapters);

questionRouter.get(
  "/get-questions-for-chapters",
  questionController.getQuestionsForChapters
);

export { questionRouter };
