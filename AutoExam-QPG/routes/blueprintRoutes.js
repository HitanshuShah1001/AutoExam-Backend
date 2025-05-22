import express from 'express';
import { blueprintController } from '../controllers/blueprintController.js';

const blueprintRouter = express.Router();

/**
 * @openapi
 * /blueprint/getPaginatedBlueprints:
 *   get:
 *     tags:
 *       - blueprint
 *     summary: Fetch blueprint data with pagination
 *     description: Returns a list of blueprints filtered by optional query parameters (name, grade, subject, totalMarks). Supports cursor-based pagination using an `id` cursor.
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by exact blueprint name.
 *       - in: query
 *         name: grade
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by grade level.
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by subject.
 *       - in: query
 *         name: totalMarks
 *         schema:
 *           type: number
 *         required: false
 *         description: Filter by total marks.
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: number
 *         required: false
 *         description: Fetch records with an `id` less than this value (for pagination).
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         required: false
 *         description: Maximum number of records to return. Defaults to 10.
 *     responses:
 *       200:
 *         description: Successfully fetched blueprint data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 blueprints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Blueprint model data.
 *                 hasNextPage:
 *                   type: boolean
 *                   description: Indicates if more records are available.
 *                 nextCursor:
 *                   type: number
 *                   nullable: true
 *                   description: The `id` of the last record in the current page (use as `cursor` for the next page).
 *       500:
 *         description: Internal server error while fetching blueprints.
 */
blueprintRouter.get('/getPaginatedBlueprints', blueprintController.getPaginatedBlueprints);

/**
 * @openapi
 * /blueprint/create:
 *   put:
 *     tags:
 *       - blueprint
 *     summary: Create a new blueprint
 *     description: Creates a new blueprint entry in the database using the provided blueprint data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - blueprint
 *             properties:
 *               blueprint:
 *                 type: object
 *                 description: The blueprint data to create. Structure depends on your Blueprint model fields.
 *     responses:
 *       201:
 *         description: Successfully created the blueprint.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 blueprint:
 *                   type: object
 *                   description: The newly created blueprint record.
 *       400:
 *         description: Missing blueprint data.
 *       500:
 *         description: Internal server error while creating blueprint.
 */
blueprintRouter.put('/create', blueprintController.createBlueprint);

/**
 * @openapi
 * /blueprint/update:
 *   put:
 *     tags:
 *       - blueprint
 *     summary: Update an existing blueprint
 *     description: Updates an existing blueprint record identified by `id` with new data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - blueprint
 *             properties:
 *               id:
 *                 type: number
 *                 description: The ID of the blueprint to update.
 *               blueprint:
 *                 type: object
 *                 description: The new data to update the blueprint with. Structure depends on your Blueprint model fields.
 *     responses:
 *       200:
 *         description: Successfully updated the blueprint.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 blueprint:
 *                   type: object
 *       400:
 *         description: Missing `id` or `blueprint` data in the request body.
 *       404:
 *         description: The specified blueprint was not found.
 *       500:
 *         description: Internal server error while updating blueprint.
 */
blueprintRouter.put('/update', blueprintController.updateBlueprint);

export { blueprintRouter };