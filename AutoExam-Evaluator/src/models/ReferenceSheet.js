import { DataTypes } from "sequelize";
import { sequelize } from "../connections/database.js";

// 1) ReferenceSheet: the teacher-uploaded answer key
export const ReferenceSheet = sequelize.define(
  "ReferenceSheet",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    school: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    standard: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    test_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    original_pdf_url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ocr_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    conversion_json: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Parsed questions + answers + marks from OpenAI",
    },
    cost_of_conversion_to_evaluable_json: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
  },
  {
    tableName: "reference_sheets",
    underscored: true, // ✅ maps createdAt → created_at, etc.
    timestamps: true,
  }
);
