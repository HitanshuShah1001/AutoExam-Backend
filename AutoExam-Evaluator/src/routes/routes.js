import express from "express";
import { referenceSheetRouter } from "./referenceSheetRoute.js";
import { studentReferenceSheetRouter } from "./answerSheetsRoute.js";

const router = express.Router();

// Health Check Endpoint
router.get("/health", (req, res) => {
  res.status(200).send({ status: "healthy" });
});

router.use("/evaluate", referenceSheetRouter);
router.use("/answerSheetEvaluate", studentReferenceSheetRouter);
export default router;
