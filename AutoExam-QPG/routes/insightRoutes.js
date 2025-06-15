import express from "express";
import { studentController } from "../controllers/insightController.js";

const studentStatRouter = express.Router();

studentStatRouter.post(
  "/save-student-cost-per-worksheet",
  studentController.createStudent
);
studentStatRouter.post(
  "/download-worksheet-from-s3-link",
  studentController.downloadWorksheetFromPdf
);

studentStatRouter.get(
  "/get-previous-months-data",
  studentController.getStudentPreviousMarks
);
export { studentStatRouter };
