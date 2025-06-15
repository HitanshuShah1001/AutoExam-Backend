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
      type: Sequelize.ENUM(
        "Surya_International_School",
        "The_Western_English_Medium_School"
      ),
      allowNull: false,
      comment: "The name of the student's school",
    },
    standard: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: "The grade or standard of the student",
    },
    worksheet_s3_link: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: "S3 link for this month's worksheet",
    },
    cost: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: "Associated cost",
    },
    prevTests: {
      type: Sequelize.JSONB, // or JSONB if you’re on Postgres
      allowNull: false,
      defaultValue: [],
      comment: `Array of objects like:
        [{
          subject: "Math",
          marks: 85,
          topics: ["Algebra","Fractions"],
          month: "2025-05"
        }, …]
      `,
    },
  },
  {
    tableName: "Students",
    timestamps: true,
    indexes: [{ fields: ["studentName"] }, { fields: ["standard"] }],
  }
);
