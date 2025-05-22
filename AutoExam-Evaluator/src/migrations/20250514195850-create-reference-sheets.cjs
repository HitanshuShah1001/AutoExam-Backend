'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reference_sheets', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      school: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      standard: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      subject: {
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
      ocr_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      conversion_json: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      cost_of_conversion_to_evaluable_json: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reference_sheets');
  },
};
