"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("student_answer_sheets", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      reference_sheet_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "reference_sheets", // table name in DB (not model file name)
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      student_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      standard: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      test_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      original_pdf_url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      student_answers_json: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Parsed student answers from OpenAI",
      },
      evaluation_json: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "AI grading output (per-question feedback)",
      },
      final_marks: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      cost_of_conversion_to_evaluable_json: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      cost_of_evaluation: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("student_answer_sheets");
  },
};
