import { DataTypes, Sequelize } from "sequelize";
import { sequelize } from "../connections/database.js";

export const Question = sequelize.define(
    "Question",
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
            comment:
                "The questionId of the question corresponding to the description of the question in the prompt",
        },
        type: {
            type: Sequelize.ENUM("mcq", "descriptive"),
            allowNull: false,
            comment: "The type of the question.",
        },
        questionText: {
            type: Sequelize.TEXT,
            allowNull: false,
            comment: "The question being asked.",
        },
        marks: {
            type: Sequelize.INTEGER,
            allowNull: false,
            comment: "The marks assigned for the question.",
        },
        options: {
            type: Sequelize.JSONB,
            allowNull: true,
            comment:
                "Options for multiple choice questions. Null for descriptive questions.",
        },
        difficulty: {
            type: Sequelize.ENUM("easy", "medium", "hard"),
            allowNull: false,
            comment: "The difficulty level of the question.",
        },
        imageUrl: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "The URL of the image associated with the question.",
        },
        imageUrls: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: [],
        },
        chapter: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "The chapter associated with the question",
        },
        subject: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "The subject associated with the question",
        },
        grade: {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: "The grade to which the question belongs",
        },
        repositoryType: {
            type: Sequelize.ENUM("exercise", "illustration", "archive"),
            allowNull: true,
            comment: "The repository type the question belongs to.",
        },
        textBook: {
            type: Sequelize.ENUM("gseb", "ncert"),
            allowNull: true,
            comment: "The textbook to which the question belongs",
        },
        exerciseName: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "The exercise to which the question belongs",
        },
        questionSource: {
            type: Sequelize.ENUM("custom", "imported", "archive"),
            allowNull: false,
            defaultValue: "custom",
            comment:
                'Indicates the source of the question: "custom" for user-created questions, "imported" for duplicated (non-editable) questions, and "archive" for archived questions.',
        },
        originalQuestionId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment:
                "References the original question ID if this question was imported from the question bank.",
        },
    },
    {
        tableName: "Questions",
        timestamps: true,
        indexes: [
            { fields: ["type"] },
            { fields: ["difficulty"] },
            { fields: ["marks"] },
            { fields: ["updatedAt"], order: [["updatedAt", "DESC"]] },
        ],
    }
);