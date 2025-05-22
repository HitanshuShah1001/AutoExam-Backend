import { ReferenceSheet } from "./ReferenceSheet";

// 3) StudentAnswerSheet: one per student, tied to ReferenceSheet
export const StudentAnswerSheet = sequelize.define(
  "StudentAnswerSheet",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    referenceSheetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ReferenceSheet,
        key: "id",
      },
    },
    student_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    standard: {
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
    student_answers_json: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Parsed student answers from OpenAI",
    },
    evaluation_json: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "AI grading output (per-question feedback)",
    },
    final_marks: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cost_of_conversion_to_evaluable_json: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    cost_of_evaluation: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
  },
  {
    tableName: "student_answer_sheets",
    underscored: true,
  }
);

ReferenceSheet.hasMany(StudentAnswerSheet, { foreignKey: "referenceSheetId" });
StudentAnswerSheet.belongsTo(ReferenceSheet, {
  foreignKey: "referenceSheetId",
});
