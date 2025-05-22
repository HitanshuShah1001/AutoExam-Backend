import express from 'express';
import { userController } from '../controllers/userController.js';

const userRouter = express.Router();

/**
 * @openapi
 * /user/update:
 *   post:
 *     tags:
 *       - user
 *     summary: Update a user's details
 *     description: Updates the specified user's information. Requires the `id` in the request body to match the authenticated user's ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: number
 *                 description: The ID of the user to update.
 *               name:
 *                 type: string
 *                 description: The user's updated name (optional).

 *               tokens:
 *                 type: number
 *                 description: The user's updated token balance (optional).
 *             required:
 *               - id
 *     responses:
 *       200:
 *         description: Successfully updated the user.
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
 *                   example: "User updated successfully"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     name:
 *                       type: string
 *                     tokens:
 *                       type: number
 *                     mobileNumber:
 *                       type: string
 *       400:
 *         description: Missing or invalid fields, or email already registered.
 *       403:
 *         description: The provided user ID does not match the authenticated user (forbidden).
 *       404:
 *         description: The user was not found.
 *       500:
 *         description: Internal server error while updating user.
 */
userRouter.post('/update', userController.updateUser);

export { userRouter };