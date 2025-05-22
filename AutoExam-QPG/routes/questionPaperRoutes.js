import express from "express";
import { questionPaperController } from "../controllers/paperController.js";

const questionPaperRouter = express.Router();

/**
 * @openapi
 * /questionPaper/generate:
 *   post:
 *     tags:
 *       - questionPaper
 *     summary: Generate a new question paper
 *     description: Creates a question paper based on a provided blueprint and other required details. Returns immediately with a status message, then processes the generation asynchronously.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - blueprint
 *               - grade
 *               - subject
 *               - academyName
 *               - timeDuration
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name/title of the question paper.
 *               blueprint:
 *                 type: array
 *                 description: An array of blueprint items, each containing at least a questionId and topic.
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: number
 *                       description: Unique question identifier.
 *                     topic:
 *                       type: string
 *                       description: Topic/heading under which the question falls.
 *               grade:
 *                 type: string
 *                 description: The grade or class level (e.g., "Grade 10").
 *               subject:
 *                 type: string
 *                 description: Subject of the exam (e.g., "Mathematics").
 *               totalMarks:
 *                 type: number
 *                 description: Total marks for the question paper. (Optional; defaults to sum of generated questions' marks)
 *               numberOfSets:
 *                 type: number
 *                 description: Number of distinct sets to generate. (Optional; defaults to 1)
 *               academyName:
 *                 type: string
 *                 description: Name of the academy/institution.
 *               timeDuration:
 *                 type: number
 *                 description: Duration (in hours or another unit) for the exam.
 *     responses:
 *       200:
 *         description: Generation process started successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Question paper generation started"
 *                 questionPaper:
 *                   type: object
 *                   description: Basic info about the newly created QuestionPaper record.
 *       400:
 *         description: Missing or invalid input fields.
 *       500:
 *         description: Internal server error.
 */
questionPaperRouter.post(
  "/generate",
  questionPaperController.generateQuestionPaper
);

/**
 * @openapi
 * /questionPaper/getPaginatedQuestionPapers:
 *   post:
 *     tags:
 *       - questionPaper
 *     summary: Fetch question papers with pagination
 *     description: Returns a list of question papers filtered by optional name, topics, grade, or subject. Supports cursor-based pagination via query parameters.
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         required: false
 *         description: ID to start fetching records before this value (for pagination).
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *         description: Number of records to fetch (default 10).
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Filter papers by name (partial match).
 *               topics:
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items:
 *                       type: string
 *                 description: Filter papers by one or more topics.
 *               grade:
 *                 type: string
 *                 description: Filter papers by grade level.
 *               subject:
 *                 type: string
 *                 description: Filter papers by subject.
 *     responses:
 *       200:
 *         description: Successfully fetched a paginated list of question papers.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 questionPapers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Question paper object with sections array.
 *                 hasNextPage:
 *                   type: boolean
 *                   description: Indicates if more results are available.
 *                 nextCursor:
 *                   type: number
 *                   nullable: true
 *                   description: The ID to use as `cursor` for fetching next page.
 *       500:
 *         description: Internal server error.
 */
questionPaperRouter.post(
  "/getPaginatedQuestionPapers",
  questionPaperController.getPaginatedQuestionPapers
);

/**
 * @openapi
 * /questionPaper/generatePaperFromExtractedText:
 *   post:
 *     tags:
 *       - questionPaper
 *     summary: Generate a question paper from extracted text
 *     description: Invokes the controller with a hardcoded AWS job ID for demonstration/testing. No request body is required or used.
 *     responses:
 *       200:
 *         description: Returns a plain success message after invoking the generation process.
 *       500:
 *         description: Internal server error.
 */

/**
 * @openapi
 * /questionPaper/{id}:
 *   delete:
 *     tags:
 *       - questionPaper
 *     summary: Delete a question paper
 *     description: Permanently removes the specified question paper by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the question paper to delete.
 *     responses:
 *       200:
 *         description: Question paper deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Question paper deleted successfully"
 *       404:
 *         description: Question paper not found.
 *       500:
 *         description: Internal server error.
 */
questionPaperRouter.delete("/:id", questionPaperController.deleteQuestionPaper);

/**
 * @openapi
 * /questionPaper/{id}:
 *   get:
 *     tags:
 *       - questionPaper
 *     summary: Get a question paper by ID
 *     description: Retrieves the question paper, including all associated questions organized by section.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the question paper to retrieve.
 *     responses:
 *       200:
 *         description: Successfully retrieved the question paper.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 questionPaper:
 *                   type: object
 *                   description: The question paper object, including a sections array.
 *       404:
 *         description: Question paper not found.
 *       500:
 *         description: Internal server error.
 */
questionPaperRouter.get("/:id", questionPaperController.getQuestionPaper);

/**
 * @openapi
 * /questionPaper/create:
 *   post:
 *     tags:
 *       - questionPaper
 *     summary: Create a new question paper (with one default question)
 *     description: Creates a new question paper with `status=completed` and attaches a single default MCQ question to it.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - grade
 *               - subject
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name/title of the question paper.
 *               grade:
 *                 type: string
 *                 description: The grade or class level (e.g., "Grade 10").
 *               subject:
 *                 type: string
 *                 description: Subject of the exam (e.g., "Mathematics").
 *     responses:
 *       200:
 *         description: Returns the created question paper with a default MCQ.
 *       500:
 *         description: Failed to create question paper.
 */
questionPaperRouter.post(
  "/create",
  questionPaperController.createQuestionPaper
);

/**
 * @openapi
 * /questionPaper/update:
 *   post:
 *     tags:
 *       - questionPaper
 *     summary: Update question paper ordering/sections
 *     description: Updates the order and section of questions within a specific question paper.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - sections
 *             properties:
 *               id:
 *                 type: number
 *                 description: The ID of the question paper to update.
 *               sections:
 *                 type: array
 *                 description: An array of section objects with updated question ordering.
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: Section name (e.g., "A").
 *                     questions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                             description: The question ID to reorder.
 *     responses:
 *       200:
 *         description: Question paper questions updated successfully.
 *       400:
 *         description: Invalid input (missing `id` or `sections`).
 *       500:
 *         description: Failed to update question paper questions.
 */
questionPaperRouter.post(
  "/update",
  questionPaperController.updateQuestionPaper
);

/**
 * @openapi
 * /questionPaper/removeQuestion:
 *   post:
 *     tags:
 *       - questionPaper
 *     summary: Remove a question from a question paper
 *     description: Deletes the relationship between a question and a question paper.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionPaperId
 *               - questionId
 *             properties:
 *               questionPaperId:
 *                 type: number
 *                 description: The ID of the question paper.
 *               questionId:
 *                 type: number
 *                 description: The ID of the question to remove.
 *     responses:
 *       200:
 *         description: Question removed from the question paper successfully.
 *       404:
 *         description: Question not found in the specified question paper.
 *       500:
 *         description: Failed to remove the question.
 */
questionPaperRouter.post(
  "/removeQuestion",
  questionPaperController.removeQuestionFromQuestionPaper
);

questionPaperRouter.post(
  "/generateHtml",
  questionPaperController.generateQuestionPaperHtml
);

questionPaperRouter.post(
  "/addQuestions",
  questionPaperController.addQuestionsToQuestionPaper
);

questionPaperRouter.post(
  "/updateQuestionPaperDetails",
  questionPaperController.updateQuestionPaperDetails
);

export { questionPaperRouter };
