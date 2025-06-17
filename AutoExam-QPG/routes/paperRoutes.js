import express from "express";
import { QuestionPaper } from "../models/questionPaper";
const paperRouter = express.Router();

paperRouter.get("/paper", async (req, res) => {
  const { id } = req.query;
  const paper = await QuestionPaper.findOne({ where: { id } });
  if (!paper || !paper.questionPaperLink) {
    return res.status(404).send("Paper not found");
  }
  return res.redirect(paper.questionPaperLink);
});

paperRouter.get("/solution", async (req, res) => {
  const { id } = req.query;
  const paper = await QuestionPaper.findOne({ where: { id } });
  if (!paper || !paper.solutionLink) {
    return res.status(404).send("Solution sheet not found");
  }
  return res.redirect(paper.solutionLink);
});

export { paperRouter };
