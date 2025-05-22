import { Question } from "./question.js";
import { QuestionPaper } from "./questionPaper.js";
import { QuestionPaperQuestion } from "./questionPaperQuestions.js";
import { User } from "./user.js";

// Establish many-to-many relationship using the join model
Question.belongsToMany(QuestionPaper, {
  through: QuestionPaperQuestion,
  foreignKey: "questionId",
  otherKey: "questionPaperId",
  as: "papers", // Optional alias; allows you to use question.getPapers()
});

// Define many-to-many association from QuestionPaper to Question
QuestionPaper.belongsToMany(Question, {
  through: QuestionPaperQuestion,
  foreignKey: "questionPaperId",
  otherKey: "questionId",
  as: "questions", // Optional alias; allows you to use paper.getQuestions()
});

// Optional: Define associations on the join table for convenience.
QuestionPaperQuestion.belongsTo(Question, {
  foreignKey: "questionId",
  as: "question",
});

QuestionPaperQuestion.belongsTo(QuestionPaper, {
  foreignKey: "questionPaperId",
  as: "paper",
});

// ✅ 3. New association between User and QuestionPaper
User.hasMany(QuestionPaper, {
  foreignKey: "createdBy",
  as: "createdPapersList",
});

QuestionPaper.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator",
});
