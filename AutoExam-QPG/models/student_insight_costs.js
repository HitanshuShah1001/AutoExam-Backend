import { Sequelize } from "sequelize";
import { sequelize } from "../connections/database.js";

export const Student = sequelize.define(
  "Student",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      comment: "Auto-incrementing primary key for the student record",
    },
    studentName: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: "The name of the student",
    },
    schoolName: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: "The name of the student's school",
    },
    standard: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: "The grade or standard of the student",
    },
    worksheet_s3_link:{
      type: Sequelize.STRING,
      allowNull: false,
      comment: "The grade or standard of the student",
    },
    cost: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: "Associated cost",
    },
  },
  {
    tableName: "Students",
    timestamps: true,
    indexes: [
      { fields: ["studentName"] },
      { fields: ["standard"] },
    ],
  }
);
