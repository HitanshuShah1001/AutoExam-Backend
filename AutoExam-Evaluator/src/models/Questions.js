import { DataTypes } from "sequelize";
import { sequelize } from "../connections/database.js";

// 2) ReferenceQuestion: one per question in the answer key
export const ReferenceQuestion = sequelize.define(
  "ReferenceQuestion",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    referenceSheetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    questionText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    expectedAnswer: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    marks: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "reference_questions",
    underscored: true,
  }
);
