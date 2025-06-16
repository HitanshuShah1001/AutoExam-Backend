import OpenAI from "openai";
import {
  structureQuestionPaper,
  structureSolution,
  generateHTML,
  getQuestionPaperWithSolutionResponseFormat,
  uploadToS3,
  createQuestionPaperSets,
  getQuestionPaperFromExtractedTextResponseFormat,
  getOpenAIMessagesForExtractedTextToQuestions,
  structureSectionedQuestionPapers,
} from "../utils/generateQuestionPaper.util.js";
import { QuestionPaper } from "../models/questionPaper.js";
import lodash from "lodash";
import { Op } from "sequelize";
import {
  sendMessageOfCompletion,
  sendMessageOfFailure,
} from "../utils/generateQuestionPaper.util.js";
import { Question } from "../models/question.js";
import { QuestionPaperQuestion } from "../models/questionPaperQuestions.js";
import { sequelize } from "../connections/database.js";
import { v4 as uuidv4 } from "uuid";
import { getMetadataFromSegments } from "../utils/paper.util.js";
import { makeFirstLetterCapitalOfEachWord } from "../utils/makeFirstLetterCapitalOfEachWord.js";
import { User } from "../models/user.js";
import { questionController } from "./questionController.js";
import { generateSystemPrompt, getUserPrompt } from "../utils/prompts.js";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_RETRY_COUNT = 4;

class QuestionPaperController {
  async generateQuestionPaper(req, res) {
    try {
      const {
        name,
        blueprint,
        grade,
        subject,
        totalMarks,
        numberOfSets = 1,
        academyName,
        timeDuration,
      } = req.body;
      const { user = null } = req;
      // Validate Input
      const requiredFields = [
        { field: blueprint, message: "blueprint is required in req.body" },
        { field: name, message: "name is required in req.body" },
        { field: grade, message: "grade is required in req.body" },
        { field: subject, message: "subject is required in req.body" },
        { field: academyName, message: "academyName is required in req.body" },
        {
          field: timeDuration,
          message: "timeDuration is required in req.body",
        },
      ];
      for (const { field, message } of requiredFields) {
        if (!field) {
          return res.status(400).json({ error: message });
        }
      }
      const blueprintQuestionIds = blueprint.map(
        (question) => question.questionId
      );

      if (
        blueprintQuestionIds.length !==
          lodash.uniq(blueprintQuestionIds).length ||
        blueprintQuestionIds.length !== blueprint.length
      ) {
        return res.status(400).json({
          error:
            "questionId not found in blueprint OR duplicate questionIds found in blueprint",
        });
      }

      // Create a new QuestionPaper entry with status 'inProgress'
      const generatedPaperDocument = await QuestionPaper.create({
        name,
        grade,
        topics: lodash.uniq(blueprint.map((question) => question.topic)),
        subjects: [subject],
        subject,
        status: "inProgress",
        type: "aiGenerated",
        createdBy: parseInt(user.id) ?? null,
      });

      // convert generatedPaper to JSON
      if (!generatedPaperDocument) {
        res.status(400).json({
          message: "Failed to generate question paper",
        });
      }
      const generatedPaper = generatedPaperDocument.toJSON();
      let TOPICSOFBLUEPRINT = new Set();
      for (let individualblueprint of blueprint) {
        TOPICSOFBLUEPRINT.add(individualblueprint.topic);
      }
      const questions =
        await questionController.getQuestionsForChaptersFunctionCall(
          Array.from(TOPICSOFBLUEPRINT)
        );
      res.status(200).json({
        message: "Question paper generation started",
        questionPaper: generatedPaper,
      });

      const responseFormat = getQuestionPaperWithSolutionResponseFormat();

      let retryCount = 0;
      let questionPaper = [];
      let leftoverBlueprint = blueprint; // blueprint for leftover questions to be generated. Will be all questions for the first try

      while (retryCount < MAX_RETRY_COUNT) {
        let messages = [
          { role: "system", content: generateSystemPrompt({ questions }) },
          {
            role: "user",
            content: getUserPrompt({ blueprint }),
          },
        ];
        const response = await openai.beta.chat.completions.parse({
          model: "gpt-4o",
          messages,
          response_format: responseFormat,
        });

        const result = response.choices[0].message.parsed;
        const generatedQuestionPaper = result.answer ?? [];
        questionPaper = [...questionPaper, ...generatedQuestionPaper]; // append leftover questions to the generated questions. Will be all questions for the first try

        // Identify missing questions
        const blueprintQuestionIds = leftoverBlueprint.map(
          (question) => question.questionId
        );
        const generatedQuestionIds = generatedQuestionPaper.map(
          (question) => question.questionId
        );
        const missingQuestionIds = lodash.difference(
          blueprintQuestionIds,
          generatedQuestionIds
        );

        // If missing questions are found, update leftoverBlueprint and retry generating the missing questions using leftoverBlueprint
        if (missingQuestionIds.length !== 0) {
          console.log(
            `Missing questions: ${JSON.stringify(missingQuestionIds)}`
          );
          leftoverBlueprint = blueprint.filter((question) =>
            missingQuestionIds.includes(question.questionId)
          );
          retryCount++;
          continue;
        }
        break;
      }

      if (retryCount === MAX_RETRY_COUNT) {
        console.error("Failed to generate question paper");
        generatedPaper.update({ status: "failed" });
        await sendMessageOfFailure({
          countryCode: "+91",
          mobileNumber: req.user.mobileNumber,
          name,
        });
        return;
      }

      // Remove all extra responses from the generated questions (if any)
      questionPaper = questionPaper.filter((question) =>
        blueprintQuestionIds.includes(question.questionId)
      );
      const derivedMarks = questionPaper.reduce(
        (acc, question) => acc + question.marks,
        0
      );

      const questionsToCreate = questionPaper.map((question) => {
        const {
          type,
          question: questionText,
          marks,
          options,
          difficulty,
          chapter,
          subject,
        } = question;
        return {
          type,
          questionText,
          marks,
          options,
          difficulty,
          chapter,
          subject,
          grade,
        };
      });
      const createdQuestionsDocuments = await Question.bulkCreate(
        questionsToCreate,
        { returning: true }
      );

      if (!createdQuestionsDocuments) {
        // Update the QuestionPaper entry with the S3 URLs and status 'failed'
        console.log("Failed to create questions");
        await generatedPaperDocument.update({
          status: "failed",
        });
        return;
      }

      const createdQuestions = createdQuestionsDocuments.map((doc) =>
        doc.toJSON()
      );

      // Structure Generated Question Paper according to sections
      const structuredQuestionPaper = structureQuestionPaper({
        questionPaper: createdQuestions,
        grade,
        academyName,
        totalMarks: totalMarks ?? derivedMarks,
        subject,
        timeDuration,
      });

      const { sections } = structuredQuestionPaper;

      let questionIndex = 1;
      const questionpaperQuestionsToCreate = [];
      for (const section of sections) {
        for (const question of section.questions) {
          const questionId = question.id;
          const orderIndex = questionIndex;
          const customMarks = question.marks;
          const sectionName = section.name;
          questionpaperQuestionsToCreate.push({
            questionPaperId: generatedPaper.id,
            questionId,
            orderIndex,
            customMarks,
            section: sectionName,
          });
          questionIndex++;
        }
      }
      await QuestionPaperQuestion.bulkCreate(questionpaperQuestionsToCreate);

      // Create multipleSets of question papers if numberOfSets > 1
      let allQuestionPapersSets = [structuredQuestionPaper];
      if (numberOfSets > 1) {
        allQuestionPapersSets = createQuestionPaperSets(
          structuredQuestionPaper,
          numberOfSets
        );
      }

      // Structure Generated Solution according to sections
      const structuredSolution = structureSolution({
        questionPaper,
        grade,
        academyName,
        totalMarks: totalMarks ?? derivedMarks,
        subject,
        timeDuration,
      });

      // Render HTML from the structured question paper
      const renderedQuestionPaperHTMLs = [];
      for (const questionPaper of allQuestionPapersSets) {
        const renderedQuestionPaperHTML = generateHTML(
          questionPaper,
          "./templates/aiQuestionPaperTemplate.mustache"
        );
        renderedQuestionPaperHTMLs.push(renderedQuestionPaperHTML);
      }

      // Render HTML from the structured solution
      const renderedSolutionHTML = generateHTML(
        structuredSolution,
        "./templates/solutionTemplate.mustache"
      );
      let fileName = name.split(" ").join("_");
      // TODO: use bluebird promise
      // Persist Question Paper HTMLs to S3
      const questionPaperHTMLUrls = [];
      let index = 0;
      for (const renderedQuestionPaperHTML of renderedQuestionPaperHTMLs) {
        const questionPaperHTMLUrl = await uploadToS3(
          renderedQuestionPaperHTML,
          `${fileName}-${++index}`,
          "html"
        );
        questionPaperHTMLUrls.push(questionPaperHTMLUrl);
      }

      // Persist Solution HTMLs to S3
      const solutionHTMLUrl = await uploadToS3(
        renderedSolutionHTML,
        `solution-${fileName}`,
        "html"
      );
      console.log(`Successfully uploaded question paper to S3`);

      // Update the QuestionPaper entry with the S3 URLs and status 'completed'
      await generatedPaperDocument.update({
        questionPaperLink: questionPaperHTMLUrls[0],
        questionPapersLinks: questionPaperHTMLUrls,
        solutionLink: solutionHTMLUrl,
        status: "completed",
      });

      // Notify User
      const mobileNumber = req.user.mobileNumber;
      await sendMessageOfCompletion({
        countryCode: "+91",
        mobileNumber,
        name,
        questionPaperUrl: questionPaperHTMLUrls[0],
        solutionSheetUrl: solutionHTMLUrl,
      });

      console.log("Successfully updated question status");
      return;
    } catch (error) {
      console.error("Error generating question paper:", error);
    }
  }

  async getPaginatedQuestionPapers(req, res) {
    try {
      const { cursor, limit = 10 } = req.query;
      const {
        name,
        topics,
        grades,
        subjects,
        examDays,
        examMonths,
        examYears,
        shifts,
        streams,
        types,
        examNames,
      } = req.body;

      const whereClause = {};
      const { userId } = req.body;

      if (userId) {
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          { createdBy: userId },
        ];
      }
      if (name) {
        whereClause.name = { [Op.regexp]: name };
      }
      if (topics) {
        const topicsArray = Array.isArray(topics) ? topics : [topics];
        whereClause.topics = { [Op.contains]: topicsArray };
      }

      if (grades) {
        const gradesArray = Array.isArray(grades) ? grades : [grades];
        whereClause.grade = { [Op.in]: gradesArray };
      }

      if (subjects) {
        const isSubjectsAnArray = Array.isArray(subjects);
        const subjectsArray = isSubjectsAnArray ? subjects : [subjects];

        // Create an OR condition to check both fields
        whereClause[Op.or] = [
          { subjects: { [Op.overlap]: subjectsArray } },
          // Always check the subject field regardless of array length
          { subject: { [Op.in]: subjectsArray } },
        ];
      }

      if (examDays) {
        const examDaysArray = Array.isArray(examDays) ? examDays : [examDays];
        whereClause.examDay = { [Op.in]: examDaysArray };
      }

      if (examNames) {
        const examNamesArray = Array.isArray(examNames)
          ? examNames
          : [examNames];
        whereClause.examName = { [Op.in]: examNamesArray };
      }

      if (examMonths) {
        const examMonthsArray = Array.isArray(examMonths)
          ? examMonths
          : [examMonths];
        whereClause.examMonth = { [Op.in]: examMonthsArray };
      }

      if (examYears) {
        const examYearsArray = Array.isArray(examYears)
          ? examYears
          : [examYears];
        whereClause.examYear = { [Op.in]: examYearsArray };
      }

      if (shifts) {
        const shiftsArray = Array.isArray(shifts) ? shifts : [shifts];
        whereClause.shift = { [Op.in]: shiftsArray };
      }

      if (streams) {
        const streamsArray = Array.isArray(streams) ? streams : [streams];
        whereClause.stream = { [Op.in]: streamsArray };
      }

      if (types) {
        const typesArray = Array.isArray(types) ? types : [types];
        whereClause.type = { [Op.in]: typesArray };
      }

      if (cursor) {
        whereClause.id = { [Op.lt]: cursor };
      }

      const { rows: papers, count: totalCount } =
        await QuestionPaper.findAndCountAll({
          where: whereClause,
          order: [["id", "DESC"]],
          limit: parseInt(limit) + 1,
        });

      const hasNextPage = papers.length > limit;
      const paginatedPapers = hasNextPage ? papers.slice(0, limit) : papers;
      const nextCursor = hasNextPage
        ? paginatedPapers[paginatedPapers.length - 1].id
        : null;

      const paperIds = paginatedPapers.map((paper) => paper.id);

      const questionPaperQuestions = await QuestionPaperQuestion.findAll({
        where: { questionPaperId: { [Op.in]: paperIds } },
      });
      const questionsByQuestionPaperId = lodash.groupBy(
        questionPaperQuestions,
        (questionPaperQuestion) => questionPaperQuestion.questionPaperId
      );

      const questionPaperQuestionsByQuestionIdQuestionPaperId = lodash.keyBy(
        questionPaperQuestions,
        (questionPaperQuestion) =>
          `${questionPaperQuestion.questionPaperId}_${questionPaperQuestion.questionId}`
      );

      // Fetch all questions of fetched question papers
      const questionIds = questionPaperQuestions.map((row) => row.questionId);
      const uniqueQuestionIds = lodash.uniq(questionIds);
      const questionDocs = await Question.findAll({
        where: { id: { [Op.in]: uniqueQuestionIds } },
      });
      const questions = questionDocs.map((doc) => doc.toJSON());
      const questionMap = lodash.keyBy(questions, (question) => question.id);

      // Group its questions by section
      const papersWithQuestions = paginatedPapers.map((paper) => {
        // Filter join rows for this paper and sort by orderIndex
        const questionsofQuestionPaper = questionsByQuestionPaperId[paper.id];
        if (
          !questionsofQuestionPaper ||
          lodash.isEmpty(questionsofQuestionPaper)
        ) {
          return paper.toJSON();
        }
        questionsofQuestionPaper.sort((a, b) => a.orderIndex - b.orderIndex);

        // Group the questions by section, defaulting to "A" if no section is provided
        const sectionsGrouped = {};
        questionsofQuestionPaper.forEach((row) => {
          const sectionName = row.section || "A";
          if (!sectionsGrouped[sectionName]) {
            sectionsGrouped[sectionName] = [];
          }
          const question = questionMap[row.questionId];
          if (question) {
            const questionPaperQuestion =
              questionPaperQuestionsByQuestionIdQuestionPaperId[
                `${paper.id}_${question.id}`
              ];
            if (questionPaperQuestion.optionalGroupId) {
              sectionsGrouped[sectionName].push({
                ...question,
                optionalGroupId: questionPaperQuestion.optionalGroupId,
              });
            } else {
              sectionsGrouped[sectionName].push(question);
            }
          }
        });

        const sectionsArray = Object.keys(sectionsGrouped).map(
          (sectionName) => ({
            name: sectionName,
            questions: sectionsGrouped[sectionName],
          })
        );

        return {
          ...paper.toJSON(),
          sections: sectionsArray,
        };
      });

      res.status(200).json({
        success: true,
        totalCount,
        questionPapers: papersWithQuestions,
        hasNextPage,
        nextCursor,
      });
    } catch (error) {
      console.error("Error fetching paginated question papers:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch paginated question papers",
      });
    }
  }

  async deleteQuestionPaper(req, res) {
    try {
      const { id } = req.params;
      const questionPaper = await QuestionPaper.findByPk(id);
      if (!questionPaper) {
        return res.status(404).json({ error: "Question paper not found" });
      }
      if (questionPaper.createdBy) {
        const user = await User.findByPk(questionPaper.createdBy);
        const userCreatedPapers = user.createdPapers.filter(
          (paper) => paper !== questionPaper.id
        );
        await user.update({ createdPapers: userCreatedPapers });
      }
      await questionPaper.destroy();
      res.status(200).json({ message: "Question paper deleted successfully" });
    } catch (error) {
      console.error("Error deleting question paper:", error);
      res.status(500).json({ error: "Failed to delete question paper" });
    }
  }

  async updateQuestionPaperDetails(req, res) {
    try {
      const { id, name, grade, subject } = req.body;

      // Make sure they passed at least one updatable field
      if (name == null && grade == null && subject == null) {
        return res.status(400).json({
          message: "At least one of name, grade or subject must be provided.",
        });
      }

      // Find the paper
      const questionPaper = await QuestionPaper.findByPk(id);
      if (!questionPaper) {
        return res.status(404).json({ message: "Question paper not found." });
      }

      // Apply only the fields they sent
      if (name != null) questionPaper.name = name;
      if (grade != null) questionPaper.grade = parseInt(grade, 10);
      if (subject != null) questionPaper.subject = subject;

      // Save and return
      await questionPaper.save();
      return res.status(200).json({
        message: "Question paper updated successfully.",
        data: questionPaper,
        success: true,
      });
    } catch (error) {
      console.error("Error updating question paper:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async createQuestionPaper(req, res) {
    try {
      // create
      const { name, grade, subject, mobileNumber } = req.body;
      let user = null;
      let createdBy = null;
      if (mobileNumber) {
        user = await User.findOne({ where: { mobileNumber } });
        if (user) {
          createdBy = user ? user.id : null;
        }
      }

      const questionPaper = await QuestionPaper.create({
        name,
        grade,
        subject,
        status: "completed",
        type: "custom",
        createdBy,
      });
      if (user) {
        const papers_created = [...user.createdPapers, questionPaper.id];
        await user.update({ createdPapers: papers_created });
      }
      const question = await Question.create({
        type: "descriptive",
        questionText: "Untitled Question",
        marks: 1,
        difficulty: "easy",
      });
      await QuestionPaperQuestion.create({
        questionId: question.id,
        questionPaperId: questionPaper.id,
        orderIndex: 1,
        customMarks: 1,
        section: "A",
      });
      const response = {
        ...questionPaper.toJSON(),
        sections: [{ name: "A", questions: [question.toJSON()] }],
      };

      res.status(200).json(response);
      return;
    } catch (error) {
      console.error("Error creating question paper", error);
      res.status(500).json({ error: "Failed to create question paper" });
    }
  }

  async getQuestionPaper(req, res) {
    try {
      const { id } = req.params;

      // Fetch the question paper by its primary key
      const paper = await QuestionPaper.findByPk(id);
      if (!paper) {
        return res
          .status(404)
          .json({ success: false, message: "Question paper not found" });
      }

      // First call: Get all join rows for this question paper
      const questionPaperQuestions = await QuestionPaperQuestion.findAll({
        where: { questionPaperId: id },
      });

      // Sort the join rows by orderIndex so that ordering is maintained
      questionPaperQuestions.sort((a, b) => a.orderIndex - b.orderIndex);

      // Extract all questionIds and deduplicate them
      const questionIds = questionPaperQuestions.map((row) => row.questionId);
      const uniqueQuestionIds = lodash.uniq(questionIds);

      // Second call: Fetch all corresponding questions from the Questions table
      const questionDocs = await Question.findAll({
        where: { id: { [Op.in]: uniqueQuestionIds } },
      });
      const questions = questionDocs.map((question) => question.toJSON());
      const questionMap = lodash.keyBy(questions, (question) => question.id);

      // Group the questions by section. If no section is specified, default to "A"
      const sectionsGrouped = {};
      questionPaperQuestions.forEach((row) => {
        const sectionName = row.section || "A";
        if (!sectionsGrouped[sectionName]) {
          sectionsGrouped[sectionName] = [];
        }
        const question = questionMap[row.questionId];
        if (question) {
          sectionsGrouped[sectionName].push({
            ...question,
            optionalGroupId: row.optionalGroupId,
          });
        }
      });

      // Convert the grouped sections into an array
      const sectionsArray = Object.keys(sectionsGrouped).map((sectionName) => ({
        name: sectionName,
        questions: sectionsGrouped[sectionName],
      }));

      // Combine the question paper data with the grouped questions
      const paperWithQuestions = {
        ...paper.toJSON(),
        sections: sectionsArray,
      };

      return res.status(200).json({
        success: true,
        questionPaper: paperWithQuestions,
      });
    } catch (error) {
      console.error("Error fetching question paper:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch question paper",
      });
    }
  }

  async removeQuestionFromQuestionPaper(req, res) {
    try {
      const { questionPaperId, questionId } = req.body;

      // Find the join row to delete
      const questionPaperQuestion = await QuestionPaperQuestion.findOne({
        where: { questionPaperId, questionId },
      });
      if (!questionPaperQuestion) {
        return res.status(404).json({
          success: false,
          message: "Question not found in question paper",
        });
      }

      // Delete the join row
      await questionPaperQuestion.destroy();
      return res.status(200).json({
        success: true,
        message: "Question removed from question paper",
      });
    } catch (error) {
      console.error("Error removing question from question paper:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to remove question from question paper",
      });
    }
  }

  async updateQuestionPaper(req, res) {
    // Expecting req.body to include a questionPaper id and sections with questions.
    const { id: questionPaperId, sections } = req.body;

    if (!questionPaperId || !sections || !Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input. Provide questionPaper id and sections.",
      });
    }

    // Build the CASE statements and collect questionIds.
    let casesOrderIndex = "";
    let casesSection = "";
    let casesOptionalGroup = "";
    let questionIds = [];
    let globalIndex = 0;
    const replacements = { questionPaperId: Number(questionPaperId) };

    for (const section of sections) {
      const sectionName = section.name;
      if (!Array.isArray(section.questions)) continue;

      section.questions.forEach((question) => {
        casesOrderIndex += ` 
                WHEN "questionPaperId" = :questionPaperId AND "questionId" = :qId_${globalIndex} 
                THEN :order_${globalIndex} `;

        casesSection += ` 
                WHEN "questionPaperId" = :questionPaperId AND "questionId" = :qId_${globalIndex} 
                THEN :section_${globalIndex} `;

        // If optionalGroupId is explicitly provided, update it; if missing, set to NULL
        casesOptionalGroup += ` 
                WHEN "questionPaperId" = :questionPaperId AND "questionId" = :qId_${globalIndex} 
                THEN COALESCE(:optionalGroupId_${globalIndex}, NULL::UUID) `;

        replacements[`qId_${globalIndex}`] = question.id;
        replacements[`order_${globalIndex}`] = globalIndex + 1;
        replacements[`section_${globalIndex}`] = sectionName;
        replacements[`optionalGroupId_${globalIndex}`] =
          question.optionalGroupId ?? null; // Handle NULL cases

        questionIds.push(question.id);
        globalIndex++;
      });
    }

    questionIds = lodash.uniq(questionIds);
    replacements.questionIds = questionIds;

    // Build the raw SQL query.
    const query = `
            UPDATE "QuestionPaperQuestions"
            SET 
            "orderIndex" = CASE ${casesOrderIndex} ELSE "orderIndex" END,
            "section" = CASE ${casesSection} ELSE "section" END,
            "optionalGroupId" = CASE 
                ${casesOptionalGroup} 
                ELSE "optionalGroupId" 
            END
            WHERE "questionPaperId" = :questionPaperId
            AND "questionId" IN (:questionIds)
        `;

    try {
      await sequelize.query(query, { replacements });
      res.status(200).json({
        success: true,
        message: "Question paper questions updated successfully.",
      });
    } catch (error) {
      console.error("Error updating question paper questions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update question paper questions.",
      });
    }
  }

  async generateQuestionPaperHtml(req, res) {
    const { questionPaperId } = req.body;
    if (!questionPaperId) {
      return res.status(400).json({
        success: false,
        message: "questionPaperId not found in input",
      });
    }

    const questionPaper = await QuestionPaper.findByPk(questionPaperId);
    if (!questionPaper) {
      return res
        .status(404)
        .json({ success: false, message: "Question paper not found" });
    }

    const numberOfSets =
      questionPaper.toJSON().questionPapersLinks?.length || 1;

    // Fetch all questions of the question paper
    const questionPaperQuestions = await QuestionPaperQuestion.findAll({
      where: { questionPaperId },
    });
    if (!questionPaperQuestions.length) {
      return res.status(404).json({
        success: false,
        message: "No questions found for question paper",
      });
    }
    const questionPaperQuestionsByQuestionId = lodash.keyBy(
      questionPaperQuestions,
      (questionPaperQuestion) => questionPaperQuestion.questionId
    );

    // Fetch all questions
    const questionIds = questionPaperQuestions.map((row) => row.questionId);
    const questionDocuments = await Question.findAll({
      where: { id: { [Op.in]: questionIds } },
    });
    if (!questionDocuments || questionDocuments.length == 0) {
      return res.status(404).json({
        success: false,
        message: "No questions found for question paper",
      });
    }
    const questions = questionDocuments.map((q) => q.toJSON());

    for (const question of questions) {
      const questionPaperQuestion =
        questionPaperQuestionsByQuestionId[question.id];
      question.section = questionPaperQuestion.section;
      question.orderIndex = questionPaperQuestion.orderIndex;
      if (questionPaperQuestion?.optionalGroupId) {
        question.optionalGroupId = questionPaperQuestion.optionalGroupId;
      }
    }

    const derivedMarks = questions.reduce(
      (acc, q) => {
        if (q.optionalGroupId) {
          // It's an optional question. Only count once per defaultGroupId.
          if (!acc.seenGroups.has(q.optionalGroupId)) {
            acc.total += q.marks;
            acc.seenGroups.add(q.optionalGroupId);
          }
        } else {
          // Not optional; count every time
          acc.total += q.marks;
        }
        return acc;
      },
      { total: 0, seenGroups: new Set() }
    ).total;
    const structuredQuestionPaper = structureSectionedQuestionPapers({
      questionPaper: questions,
      grade: questionPaper.grade,
      academyName: makeFirstLetterCapitalOfEachWord(questionPaper.name),
      totalMarks: derivedMarks,
      subject: questionPaper.subject
        ? questionPaper.subject.charAt(0).toUpperCase() +
          questionPaper.subject.slice(1).toLowerCase()
        : "",
      timeDuration:
        derivedMarks < 35
          ? "1 Hour"
          : derivedMarks < 70
          ? "2 Hours"
          : "3 Hours",
    });

    let allQuestionPapersSets = [structuredQuestionPaper];
    // if (numberOfSets > 1) {
    //   allQuestionPapersSets = createQuestionPaperSets(
    //     structuredQuestionPaper,
    //     numberOfSets
    //   );
    // }

    const renderedQuestionPaperHTMLs = [];
    for (const questionPaper of allQuestionPapersSets) {
      const renderedQuestionPaperHTML = generateHTML(
        questionPaper,
        "./templates/questionPaperTemplate.mustache"
      );
      renderedQuestionPaperHTMLs.push(renderedQuestionPaperHTML);
    }

    const questionPaperHTMLUrls = [];
    let index = 0;
    for (const renderedQuestionPaperHTML of renderedQuestionPaperHTMLs) {
      const questionPaperHTMLUrl = await uploadToS3(
        renderedQuestionPaperHTML,
        `${questionPaper.name.split(" ").join("-")}-${++index}`,
        "html"
      );
      questionPaperHTMLUrls.push(questionPaperHTMLUrl);
    }

    await questionPaper.update({
      questionPaperLink: questionPaperHTMLUrls[0],
      questionPapersLinks: questionPaperHTMLUrls,
    });

    //console.log("pre signed url",generatedQuestionPaperPresignedUrl)
    const questionPaperToReturn = {
      ...questionPaper.toJSON(),
      questionPaperLink: questionPaperHTMLUrls[0],
      questionPapersLinks: questionPaperHTMLUrls,
    };
    return res.status(200).json({
      success: true,
      message: "Question paper HTMLs generated successfully",
      questionPaper: questionPaperToReturn,
    });
  }

  async addQuestionsToQuestionPaper(req, res) {
    const { questionPaperId, questionDetails } = req.body;
    if (
      !questionPaperId ||
      !questionDetails ||
      lodash.isEmpty(questionDetails)
    ) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    // Extract the original question IDs from the details
    const originalQuestionIds = questionDetails.map((qd) => qd.questionId);
    if (lodash.isEmpty(originalQuestionIds)) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }
    const questionDetailsByQuestionId = lodash.keyBy(
      questionDetails,
      "questionId"
    );

    // Fetch the target question paper
    const questionPaper = await QuestionPaper.findByPk(questionPaperId);
    if (!questionPaper) {
      return res
        .status(404)
        .json({ success: false, message: "Question paper not found" });
    }

    // Fetch the original questions from the question bank
    const originalQuestionsDocs = await Question.findAll({
      where: { id: { [Op.in]: originalQuestionIds } },
    });
    if (!originalQuestionsDocs || lodash.isEmpty(originalQuestionsDocs)) {
      return res
        .status(404)
        .json({ success: false, message: "Questions not found" });
    }
    const originalQuestions = originalQuestionsDocs.map((q) => q.toJSON());
    const originalQuestionsById = lodash.keyBy(originalQuestions, "id");

    // Optionally: Check if these questions have already been imported into this question paper.
    // (Here we join the QuestionPaperQuestion with Question to look for duplicates based on originalQuestionId.)
    // const existingQuestionPaperQuestions = await QuestionPaperQuestion.findAll({
    //     where: { questionPaperId },
    //     include: [{
    //         model: Question,
    //         where: {
    //             originalQuestionId: { [Op.in]: originalQuestionIds },
    //             questionSource: 'imported'
    //         }
    //     }]
    // });
    // if (existingQuestionPaperQuestions.length > 0) {
    //     return res.status(400).json({ success: false, message: "One or more questions already exist in the question paper" });
    // }

    // Duplicate each original question as an "imported" question.
    // If a custom mark is provided, update the duplicated question's marks field.
    const importedQuestionsData = [];
    for (const originalQuestionId of originalQuestionIds) {
      const originalQuestion = originalQuestionsById[originalQuestionId];
      const { id: originalId, ...restOriginalQuestion } = originalQuestion;
      const importedQuestion = restOriginalQuestion;
      importedQuestion.questionSource = "imported";
      importedQuestion.originalQuestionId = originalQuestion.id;
      importedQuestionsData.push(importedQuestion);
    }

    // Create all imported questions in the Questions table
    const createdImportedQuestions = await Question.bulkCreate(
      importedQuestionsData,
      { returning: true }
    );
    // Map the originalQuestionId to the newly created question id
    const createdImportedQuestionsMap = {};
    createdImportedQuestions.forEach((q) => {
      createdImportedQuestionsMap[q.originalQuestionId] = q.id;
    });

    // Prepare the join table entries for QuestionPaperQuestion
    const questionPaperQuestionsToCreate = [];
    for (const originalQuestionId of originalQuestionIds) {
      const qDetail = questionDetailsByQuestionId[originalQuestionId];
      const newQuestionId = createdImportedQuestionsMap[originalQuestionId];
      if (!newQuestionId) continue;

      questionPaperQuestionsToCreate.push({
        questionPaperId,
        questionId: newQuestionId,
        orderIndex: qDetail.orderIndex,
        section: qDetail.section,
        customMarks:
          qDetail.customMarks !== undefined && qDetail.customMarks !== null
            ? qDetail.customMarks
            : originalQuestionsById[originalQuestionId].marks,
      });
    }

    // Bulk create the join table records
    await QuestionPaperQuestion.bulkCreate(questionPaperQuestionsToCreate);
    return res.status(200).json({
      success: true,
      message: "Questions imported and added to question paper",
    });
  }

  async generateQuestionPapersFromExtractedTextGCS({ gcsOutputUrls }) {
    for (let index = 0; index < gcsOutputUrls.length; index++) {
      const gcsOutputUrl = gcsOutputUrls[index];
      console.log(
        `Extracting text from ${gcsOutputUrl}\tNumber ${index} of ${
          gcsOutputUrls.length
        }\tTimestamp: ${Date.now()}`
      );
      let success = false;
      try {
        const { success: responseSuccess } =
          await this.generateQuestionPaperFromExtractedTextGCS({
            gcsOutputUrl,
          });
        success = responseSuccess;
        console.log(
          `Extracted text from ${gcsOutputUrl}\tNumber ${index} of ${
            gcsOutputUrls.length
          }\tTimestamp: ${Date.now()}`
        );
      } catch (error) {
        console.error(`Error while extracting text for ${gcsOutputUrl}`);
      }

      if (success === false) {
        console.log(`Waiting for 2 minutes before generating new paper`);
        await new Promise((resolve) => setTimeout(resolve, 2 * 60000));
      }
    }
  }

  async generateQuestionPaperFromExtractedTextMistral({
    ocrResponse,
    prefix,
    overwrite = false,
  }) {
    try {
      // 1. Parse metadata from the prefix (e.g. "JEE_27_JANUARY_2024_SHIFT1")
      const metadataSegments = prefix.split("_");
      if (metadataSegments.length < 5) {
        console.error(
          "Prefix does not contain enough segments for metadata:",
          prefix
        );
        return { success: false, message: "Prefix invalid" };
      }

      const pages = ocrResponse.pages;
      const pageChunks = lodash.chunk(pages, 6);

      // 4. Derive metadata from segments
      const {
        name,
        grade,
        stream,
        subject,
        examName,
        examMonth,
        examYear,
        examDay,
        shift,
        subjects,
      } = getMetadataFromSegments(metadataSegments);

      // 5. Check if a question paper with the same name already exists
      const existingQuestionPaper = await QuestionPaper.findOne({
        where: { name },
      });
      if (existingQuestionPaper && !overwrite) {
        console.error(
          `Question paper with id ${existingQuestionPaper.id} already exists for prefix: ${prefix}`
        );
        return {
          success: false,
          message: `Question paper already exists id ${existingQuestionPaper.id}`,
        };
      }

      // 6. Create a new QuestionPaper record
      const generatedPaperDocument = await QuestionPaper.create({
        name,
        grade,
        topics: [],
        subject: subject ?? subjects[0],
        status: "inProcess",
        examName,
        examYear,
        examMonth,
        type: "archive",
        stream,
        examDay,
        shift,
        subjects: subjects && !lodash.isEmpty(subjects) ? subjects : [subject],
      });
      if (!generatedPaperDocument) {
        console.error("Failed to create question paper record");
        return { success: false };
      }

      // 7. Prepare an OpenAI request
      //    Instead of passing extractedText, we pass the ENTIRE OCR JSON string
      const responseFormat = getQuestionPaperFromExtractedTextResponseFormat();
      let generatedQuestions = [];
      for (const pageChunk of pageChunks) {
        console.log(`Generating question paper for prefix: ${prefix}`);
        const ocrJsonString = JSON.stringify(pageChunk);
        const messages =
          getOpenAIMessagesForExtractedTextToQuestions(ocrJsonString);
        const response = await openai.beta.chat.completions.parse({
          model: "gpt-4o",
          messages,
          response_format: responseFormat,
        });
        const result = response.choices[0].message.parsed;
        const generatedQuestionsPartial = result?.answer ?? [];
        generatedQuestions.push(...generatedQuestionsPartial);
        // Sleep for 1 minute
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }

      if (generatedQuestions.length === 0) {
        console.error("Failed to generate questions from full OCR JSON");
        return { success: false, message: "OpenAI returned no questions" };
      }

      // 8. Create Question records in DB
      const questionsToCreate = generatedQuestions.map((q) => ({
        type: q.type,
        questionText: q.question,
        marks: q.marks,
        options: q.options,
        difficulty: q.difficulty,
        chapter: q.chapter,
        subject: q.subject,
        imageUrls: q.imageUrls,
      }));

      const createdQuestionsDocuments = await Question.bulkCreate(
        questionsToCreate,
        { returning: true }
      );
      if (!createdQuestionsDocuments) {
        console.log("Failed to create questions in database");
        await generatedPaperDocument.update({ status: "failed" });
        return { success: false, message: "Question creation failed" };
      }

      // 9. Handle optional groups if needed
      const createdSingularQuestions = createdQuestionsDocuments.map(
        (doc, idx) => ({
          ...doc.toJSON(),
          questionId: generatedQuestions[idx].questionId,
        })
      );

      const finalQuestions = [];
      const groupedQuestions = lodash.groupBy(
        createdSingularQuestions,
        (q) => q.questionId
      );
      for (const questionId in groupedQuestions) {
        const groupArray = groupedQuestions[questionId];
        if (groupArray.length > 1) {
          const optionalGroupId = uuidv4();
          for (const question of groupArray) {
            question.optionalGroupId = optionalGroupId;
            finalQuestions.push(question);
          }
        } else {
          finalQuestions.push(groupArray[0]);
        }
      }

      // 10. Calculate total marks
      // const derivedMarks = finalQuestions.reduce(
      //     (acc, q) => {
      //         if (q.optionalGroupId) {
      //             if (!acc.seenGroups.has(q.optionalGroupId)) {
      //                 acc.total += q.marks;
      //                 acc.seenGroups.add(q.optionalGroupId);
      //             }
      //         } else {
      //             acc.total += q.marks;
      //         }
      //         return acc;
      //     },
      //     { total: 0, seenGroups: new Set() }
      // ).total;

      const derivedMarks = 720;

      // 11. Structure the question paper
      console.log(
        `Structuring question paper with ${generatedQuestions.length} questions`
      );
      const structuredQuestionPaper = structureQuestionPaper({
        questionPaper: finalQuestions,
        grade,
        academyName: name
          .split("_")
          .map(
            (seg) => seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
          )
          .join(" "),
        totalMarks: derivedMarks,
        subject: subject
          ? subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase()
          : subjects
              ?.map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
              .join(", "),
        timeDuration:
          derivedMarks < 35
            ? "1 Hour"
            : derivedMarks < 70
            ? "2 Hours"
            : "3 Hours",
      });

      // 12. Create join table records linking questions to the paper
      const { sections } = structuredQuestionPaper;
      let questionIndex = 1;
      const questionpaperQuestionsToCreate = [];

      for (const section of sections) {
        for (const question of section.questions) {
          if (question.optionalGroup) {
            for (const optQ of question.questions) {
              questionpaperQuestionsToCreate.push({
                questionPaperId: generatedPaperDocument.id,
                questionId: optQ.id,
                orderIndex: questionIndex++,
                customMarks: optQ.marks,
                section: section.name,
                optionalGroupId: optQ.optionalGroupId,
              });
            }
          } else {
            questionpaperQuestionsToCreate.push({
              questionPaperId: generatedPaperDocument.id,
              questionId: question.id,
              orderIndex: questionIndex++,
              customMarks: question.marks,
              section: section.name,
            });
          }
        }
      }
      await QuestionPaperQuestion.bulkCreate(questionpaperQuestionsToCreate);

      // 13. Render HTML for the question paper
      const renderedQuestionPaperHTML = generateHTML(
        structuredQuestionPaper,
        "./templates/questionPaperTemplate.mustache"
      );

      // 14. Upload the HTML to S3
      const questionPaperHTMLUrl = await uploadToS3(
        renderedQuestionPaperHTML,
        `${name}`,
        "html"
      );

      // 15. Update the QuestionPaper record
      await generatedPaperDocument.update({
        questionPaperLink: questionPaperHTMLUrl,
        questionPapersLinks: [questionPaperHTMLUrl],
        solutionLink: undefined,
        status: "completed",
      });

      console.log("Successfully updated question paper status");
      return { success: true };
    } catch (error) {
      console.error("Error generating question paper from Mistral OCR:", error);
      return { success: false, error: error.message };
    }
  }

  async generateQuestionFromExtractedTextMistral({ ocrResponse, prefix }) {
    try {
      const fullOCRJsonString = JSON.stringify(ocrResponse);
      const responseFormat = getQuestionPaperFromExtractedTextResponseFormat();
      const messages =
        getOpenAIMessagesForExtractedTextToQuestions(fullOCRJsonString);
      let result;
      for (let i = 0; i < 3; i++) {
        try {
          console.log(
            `Generating question paper for prefix: ${prefix} | Retry ${i + 1}`
          );
          const response = await openai.beta.chat.completions.parse({
            model: "o3-mini",
            messages,
            response_format: responseFormat,
          });
          result = response.choices?.[0]?.message?.parsed;
          break;
        } catch (error) {
          console.error("Failed to generate questions from full OCR JSON", e);
        }
      }
      if (!result) {
        console.error(
          `Failed to generate questions from full OCR JSON after ${MAX_RETRIES} retries`
        );
        return { success: false, message: "OpenAI returned no questions" };
      }
      const generatedQuestions = result?.answer ?? [];
      if (generatedQuestions.length === 0) {
        console.error("Failed to generate questions from full OCR JSON");
        return { success: false, message: "OpenAI returned no questions" };
      }
      return generatedQuestions;
    } catch (e) {
      console.log(e, "an error occured");
    }
  }
  // TODO @Aakash: Figure out a way to implement idempotence .Maybe => (exerciseName, grade, subject, textBook)
  async generateExerciseQuestionsFromExtractedTextMistral({
    ocrResponse,
    prefix,
    overwrite = false,
  }) {
    try {
      const metadataSegments = prefix.split("_");
      const { grade, textBook, subject, chapter, exerciseName } =
        getMetadataFromSegments(metadataSegments);
      const MAX_RETRIES = 3;

      const fullOcrJsonString = JSON.stringify(ocrResponse);
      const responseFormat = getQuestionPaperFromExtractedTextResponseFormat();
      const messages =
        getOpenAIMessagesForExtractedTextToQuestions(fullOcrJsonString);

      let result;
      console.log(fullOcrJsonString);
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          console.log(
            `Generating question paper for prefix: ${prefix} | Retry ${i + 1}`
          );
          const response = await openai.beta.chat.completions.parse({
            model: "o3-mini",
            messages,
            response_format: responseFormat,
          });
          result = response.choices?.[0]?.message?.parsed;
          break;
        } catch (error) {
          console.error(
            "Failed to generate questions from full OCR JSON",
            error
          );
        }
      }
      if (!result) {
        console.error(
          `Failed to generate questions from full OCR JSON after ${MAX_RETRIES} retries`
        );
        return { success: false, message: "OpenAI returned no questions" };
      }
      const generatedQuestions = result?.answer ?? [];
      if (generatedQuestions.length === 0) {
        console.error("Failed to generate questions from full OCR JSON");
        return { success: false, message: "OpenAI returned no questions" };
      }
      const questionsToCreate = [];
      generatedQuestions.forEach((q, idx) => {
        const {
          question: questionText,
          marks,
          options,
          difficulty,
          imageUrls,
          type,
        } = q;
        if (!type || !questionText || marks === undefined || !difficulty) {
          throw new Error(
            `Missing required fields in question at index ${idx}`
          );
        }
        questionsToCreate.push({
          type,
          questionText,
          marks,
          options,
          difficulty,
          imageUrls,
          chapter,
          subject: subject.toLowerCase(),
          grade,
          exerciseName,
          textBook,
        });
      });

      const createdQuestions = await Question.bulkCreate(questionsToCreate, {
        returning: true,
      });
      console.log(createdQuestions, "Created questions");
    } catch (e) {
      console.error("Error in createQuestions:", e);
    }
  }
}

export const questionPaperController = new QuestionPaperController();
