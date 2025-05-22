import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { DataTypes, Sequelize } from "sequelize";
import { sequelize } from "../connections/database.js";
dotenv.config();

export const User = sequelize.define(
  "User",
  {
    name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    createdPapers: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: false,
      defaultValue: [],
    },
    countryCode: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    mobileNumber: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    currentOtp: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    currentOtpExpiresAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    tokens: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "Users",
    indexes: [
      { unique: true, fields: ["mobileNumber"] },
      { fields: ["tokens"] },
    ],
  }
);

