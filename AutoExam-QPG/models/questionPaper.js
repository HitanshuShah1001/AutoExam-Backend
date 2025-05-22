// models/QuestionPaper.js

import { DataTypes } from "sequelize";
import { sequelize } from "../connections/database.js";

export const QuestionPaper = sequelize.define(
  "QuestionPaper",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    grade: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    topics: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    questionPaperLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    solutionLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    questionPapersLinks: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    subjects: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "inProgress",
    },
    type: {
      type: DataTypes.ENUM("custom", "archive", "aiGenerated"),
      allowNull: false,
      defaultValue: "custom",
    },
    examName: {
      type: DataTypes.ENUM("ncert", "gseb", "jee", "gujcet", "neet"),
      allowNull: true,
    },
    examMonth: {
      type: DataTypes.ENUM(
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december"
      ),
      allowNull: true,
    },
    examYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    examDay: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    shift: {
      type: DataTypes.ENUM("shift1", "shift2", "shift3"),
      allowNull: true,
    },
    stream: {
      type: DataTypes.ENUM("science", "commerce", "arts"),
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Users", // must match the table name exactly
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "QuestionPapers",
    indexes: [
      { fields: ["name"] },
      { fields: ["grade"] },
      { fields: ["subject"] },
      { fields: ["topics"] },
    ],
  }
);
