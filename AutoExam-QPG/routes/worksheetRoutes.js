import express from "express";
import { workSheetController } from "../controllers/worksheetController.js";
const worksheetRouter = express.Router();

worksheetRouter.post("/getWorksheetHTML", workSheetController.createWorksheet);

export { worksheetRouter };
