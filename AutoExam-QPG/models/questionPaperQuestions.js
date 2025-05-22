import { DataTypes } from "sequelize";
import { sequelize } from "../connections/database.js";

export const QuestionPaperQuestion = sequelize.define(
    "QuestionPaperQuestion",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
        },
        questionPaperId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "QuestionPapers", // should match the table name of your QuestionPaper model
                key: "id",
            },
        },
        questionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Questions", // should match the table name of your Question model
                key: "id",
            },
        },
        orderIndex: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "The sequential order of the question in the paper",
        },
        customMarks: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "Optional marks override for this question in the paper",
        },
        section: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Optional section identifier if the paper is divided into sections",
        },
        optionalGroupId: {
            type: DataTypes.UUIDV4,
            allowNull: true,
            comment: "Optional group identifier if the question is optional with other questions",
        },
    },
    {
        tableName: "QuestionPaperQuestions",
        timestamps: true,
        indexes: [
            { fields: ["questionPaperId"] },
            { fields: ["questionId"] },
        ],
    }
);