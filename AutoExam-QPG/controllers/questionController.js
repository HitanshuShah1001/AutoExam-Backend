import { Op, Sequelize, fn, col } from "sequelize";
import { Question } from "../models/question.js";
import { QuestionPaperQuestion } from "../models/questionPaperQuestions.js";
import { QuestionPaper } from "../models/questionPaper.js";
import lodash from "lodash";
import { openai } from "./paperController.js";
import {
  getOpenAIMessagesForQuestionMetadataUpdate,
  getResponseFormatForQuestionMetadataUpdate,
} from "../utils/generateQuestionPaper.util.js";
import { sequelize } from "../connections/database.js";
import { examSyllabus } from "../utils/mapings/examNameToChapters.js";

class QuestionController {
  async getPaginatedQuestions(req, res) {
    try {
      const { cursor, limit = 10 } = req.query;
      const {
        grades,
        subjects,
        examDays,
        examMonths,
        examYears,
        shifts,
        streams,
        types,
        examNames,
        questionTypes,
        marks,
        difficulties,
        chapters,
        repositoryTypes,
      } = req.body;

      const questionPaperWhere = {};

      if (examDays && !lodash.isEmpty(examDays)) {
        const arr = Array.isArray(examDays) ? examDays : [examDays];
        questionPaperWhere.examDay = { [Op.in]: arr };
      }
      if (examMonths && !lodash.isEmpty(examMonths)) {
        const arr = Array.isArray(examMonths) ? examMonths : [examMonths];
        questionPaperWhere.examMonth = { [Op.in]: arr };
      }
      if (examYears && !lodash.isEmpty(examYears)) {
        const arr = Array.isArray(examYears) ? examYears : [examYears];
        questionPaperWhere.examYear = { [Op.in]: arr };
      }
      if (shifts && !lodash.isEmpty(shifts)) {
        const arr = Array.isArray(shifts) ? shifts : [shifts];
        questionPaperWhere.shift = { [Op.in]: arr };
      }
      if (streams && !lodash.isEmpty(streams)) {
        const arr = Array.isArray(streams) ? streams : [streams];
        questionPaperWhere.stream = { [Op.in]: arr };
      }
      if (types && !lodash.isEmpty(types)) {
        const arr = Array.isArray(types) ? types : [types];
        questionPaperWhere.type = { [Op.in]: arr };
      }
      if (examNames && !lodash.isEmpty(examNames)) {
        const arr = Array.isArray(examNames) ? examNames : [examNames];
        questionPaperWhere.examName = { [Op.in]: arr };
      }
      let distinctQuestionIds = [];
      if (!lodash.isEmpty(questionPaperWhere)) {
        const questionPapers = await QuestionPaper.findAll({
          where: questionPaperWhere,
          attributes: ["id"],
        });
        const questionPaperIds = questionPapers.map((p) => p.id);

        if (!questionPaperIds.length) {
          return res.status(200).send({
            success: true,
            totalCount: 0,
            questions: [],
            hasNextPage: false,
            nextCursor: null,
          });
        }

        const questionPaperQuestions = await QuestionPaperQuestion.findAll({
          where: {
            questionPaperId: { [Op.in]: questionPaperIds },
          },
          attributes: ["questionId"],
        });

        distinctQuestionIds = [
          ...new Set(questionPaperQuestions.map((qpq) => qpq.questionId)),
        ];

        if (!distinctQuestionIds.length) {
          return res.status(200).send({
            success: true,
            totalCount: 0,
            questions: [],
            hasNextPage: false,
            nextCursor: null,
          });
        }
      }

      const where = {};
      where.questionSource = { [Op.ne]: "imported" };

      if (questionTypes && !lodash.isEmpty(questionTypes)) {
        const arr = Array.isArray(questionTypes)
          ? questionTypes
          : [questionTypes];
        const lowerCaseTypes = arr.map((val) => val.toLowerCase());
        where.type = Sequelize.where(fn("lower", col("type")), {
          [Op.in]: lowerCaseTypes,
        });
      }
      if (difficulties && !lodash.isEmpty(difficulties)) {
        const arr = Array.isArray(difficulties) ? difficulties : [difficulties];
        const lowerCaseDifficulties = arr.map((val) => val.toLowerCase());
        where.difficulty = Sequelize.where(fn("lower", col("difficulty")), {
          [Op.in]: lowerCaseDifficulties,
        });
      }

      if (chapters && !lodash.isEmpty(chapters)) {
        const arr = Array.isArray(chapters) ? chapters : [chapters];
        const lowerCaseChapters = arr.map((val) => val.toLowerCase());
        where.chapter = Sequelize.where(fn("lower", col("chapter")), {
          [Op.in]: lowerCaseChapters,
        });
      }

      if (repositoryTypes && !lodash.isEmpty(repositoryTypes)) {
        const arr = Array.isArray(repositoryTypes)
          ? repositoryTypes
          : [repositoryTypes];
        const lowerCaseRepoTypes = arr.map((val) => val.toLowerCase());
        where.repositoryType = Sequelize.where(
          fn("lower", col("repositoryType")),
          {
            [Op.in]: lowerCaseRepoTypes,
          }
        );
      }

      if (marks && !lodash.isEmpty(marks)) {
        const arr = Array.isArray(marks) ? marks : [marks];
        where.marks = { [Op.in]: arr };
      }
      if (grades && !lodash.isEmpty(grades)) {
        // handle multi-select or single value
        const arr = Array.isArray(grades) ? grades : [grades];
        where.grade = { [Op.in]: arr };
      }

      if (subjects && !lodash.isEmpty(subjects)) {
        const arr = Array.isArray(subjects) ? subjects : [subjects];
        const lowerCaseSubjects = arr.map((val) => val.toLowerCase());
        where.subject = Sequelize.where(fn("lower", col("subject")), {
          [Op.in]: lowerCaseSubjects,
        });
      }

      if (distinctQuestionIds && !lodash.isEmpty(distinctQuestionIds)) {
        where.id = { [Op.in]: distinctQuestionIds };
      }

      if (cursor) {
        where.updatedAt = { [Op.lt]: cursor };
      }

      const { rows: questions, count: totalCount } =
        await Question.findAndCountAll({
          where,
          order: [["updatedAt", "DESC"]],
          limit: parseInt(limit, 10),
        });

      const hasNextPage = questions.length === parseInt(limit, 10);
      const nextCursor = hasNextPage
        ? questions[questions.length - 1].updatedAt
        : null;

      return res.status(200).send({
        success: true,
        totalCount,
        questions,
        hasNextPage,
        nextCursor,
      });
    } catch (error) {
      console.error("Error in getPaginatedQuestions:", error);
      return res
        .status(500)
        .send({ success: false, message: "Failed to fetch questions" });
    }
  }

  async upsertQuestion(req, res) {
    try {
      const {
        id,
        type,
        questionText,
        marks,
        options,
        difficulty,
        imageUrls,
        questionPaperId,
        section,
        orderIndex,
        chapter,
        subject,
        grade,
        textBook,
        repositoryType,
      } = req.body;

      if (!type || !questionText || marks === undefined || !difficulty) {
        return res.status(400).send({
          success: false,
          message:
            "Missing required fields: type, questionText, marks, and difficulty are required.",
        });
      }

      let question;

      if (id) {
        question = await Question.findByPk(id);
        if (!question) {
          return res
            .status(404)
            .send({ success: false, message: "Question not found" });
        }
        question = await question.update({
          type,
          questionText,
          marks,
          options,
          difficulty,
          imageUrls,
          chapter,
          subject,
          grade,
          repositoryType,
          textBook,
        });
      } else {
        question = await Question.create({
          type,
          questionText,
          marks,
          options,
          difficulty,
          imageUrls,
          chapter,
          subject,
          grade,
          repositoryType,
          textBook,
        });
        if (questionPaperId) {
          await QuestionPaperQuestion.create({
            questionPaperId,
            questionId: question.id,
            orderIndex,
            section,
            customMarks: marks,
          });
        }
      }

      const output = {
        type,
        questionText,
        marks,
        options,
        difficulty,
        imageUrls,
        chapter,
        subject,
        grade,
        repositoryType,
        textBook,
      };

      res.status(200).send({ success: true, question: output });
    } catch (error) {
      console.error("Error in upsertQuestion:", error);
      res
        .status(500)
        .send({ success: false, message: "Failed to upsert question" });
    }
  }

  async deleteQuestion(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res
          .status(400)
          .send({ success: false, message: "Question id is required" });
      }

      const question = await Question.findByPk(id);
      if (!question) {
        return res
          .status(404)
          .send({ success: false, message: "Question not found" });
      }

      await Question.destroy({ where: { id } });

      res
        .status(200)
        .send({ success: true, message: "Question deleted successfully" });
    } catch (error) {
      console.error("Error in deleteQuestion:", error);
      res
        .status(500)
        .send({ success: false, message: "Failed to delete question" });
    }
  }

  async createQuestions(req, res) {
    try {
      const { questions } = req.body;
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).send({
          success: false,
          message: "No questions provided.",
        });
      }

      const questionsToCreate = [];
      const questionPaperLinks = [];

      questions.forEach((q, idx) => {
        const {
          type,
          questionText,
          marks,
          options,
          difficulty,
          imageUrls,
          chapter,
          subject,
          questionPaperId,
          section,
          orderIndex,
          grade,
          repositoryType,
          exerciseName,
          textBook,
        } = q;

        // Validate required fields
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
          subject,
          grade,
          repositoryType,
          exerciseName,
          textBook,
        });

        if (questionPaperId) {
          questionPaperLinks.push({
            questionPaperId,
            index: idx,
            section,
            orderIndex,
            customMarks: marks,
          });
        }
      });

      const createdQuestions = await Question.bulkCreate(questionsToCreate, {
        returning: true,
      });

      if (questionPaperLinks.length > 0) {
        const questionPaperEntries = questionPaperLinks.map((link) => {
          return {
            questionPaperId: link.questionPaperId,
            questionId: createdQuestions[link.index].id,
            orderIndex: link.orderIndex,
            section: link.section,
            customMarks: link.customMarks,
          };
        });

        await QuestionPaperQuestion.bulkCreate(questionPaperEntries);
      }

      res.status(200).send({
        success: true,
        questions: createdQuestions.map((question) => question?.toJSON()),
      });
    } catch (error) {
      console.error("Error in createQuestions:", error);
      res.status(500).send({
        success: false,
        message: "Failed to create questions",
      });
    }
  }

  async updateQuestionsMetadataFromExam(req, res) {
    try {
      // 1. Extract examName from the request body.
      const { examName } = req.body;
      if (!examName) {
        return res
          .status(400)
          .json({ success: false, message: "examName is required" });
      }

      const questionsDocuments = await Question.findAll({
        attributes: ["id", "questionText", "options"],
        where: {
          [Op.or]: [
            { chapter: null },
            { subject: null },
            {
              chapter: {
                [Op.notIn]: [
                  "Physics and Measurement",
                  "Kinematics",
                  "Laws of Motion",
                  "Work, Energy and Power",
                  "Rotational Motion",
                  "Gravitation",
                  "Properties of Solids and Liquids",
                  "Thermodynamics",
                  "Kinetic Theory of Gases",
                  "Oscillations and Waves",
                  "Electrostatics",
                  "Current Electricity",
                  "Magnetic Effects of Current and Magnetism",
                  "Electromagnetic Induction and Alternating Currents",
                  "Electromagnetic Waves",
                  "Optics",
                  "Dual Nature of Matter and Radiation",
                  "Atoms and Nuclei",
                  "Electronic Devices",
                  "Communication Systems",
                  "Experimental Skills",
                  "Some Basic Concepts of Chemistry",
                  "States of Matter: Gases and Liquids",
                  "Atomic Structure",
                  "Chemical Bonding and Molecular Structure",
                  "Chemical Thermodynamics",
                  "Solutions",
                  "Equilibrium",
                  "Redox Reactions and Electrochemistry",
                  "Chemical Kinetics",
                  "Surface Chemistry",
                  "Classification of Elements and Periodicity in Properties",
                  "General Principles and Processes of Isolation of Metals",
                  "Hydrogen",
                  "S-Block Elements (Alkali and Alkaline Earth Metals)",
                  "P-Block Elements (Group 13 to Group 18)",
                  "d and f Block Elements",
                  "Coordination Compounds",
                  "Environmental Chemistry",
                  "Purification and Characterization of Organic Compounds",
                  "Some Basic Principles of Organic Chemistry",
                  "Hydrocarbons",
                  "Organic Compounds Containing Halogens",
                  "Organic Compounds Containing Oxygen",
                  "Organic Compounds Containing Nitrogen",
                  "Polymers",
                  "Biomolecules",
                  "Chemistry in Everyday Life",
                  "Principles Related to Practical Chemistry",
                  "Sets, Relations and Functions",
                  "Inverse Trigonometric Functions",
                  "Complex Numbers and Quadratic Equations",
                  "Matrices and Determinants",
                  "Permutations and Combinations",
                  "Mathematical Induction",
                  "Binomial Theorem and Its Simple Applications",
                  "Sequences and Series",
                  "Limit, Continuity and Differentiability",
                  "Integral Calculus",
                  "Differential Equations",
                  "Coordinate Geometry",
                  "Three Dimensional Geometry",
                  "Vector Algebra",
                  "Statistics and Probability",
                  "Trigonometry",
                  "Mathematical Reasoning",
                  "Linear Programming",
                ],
              },
            },
            {
              subject: {
                [Op.notIn]: ["maths", "physics", "chemistry"],
              },
            },
          ],
        },
        include: [
          {
            model: QuestionPaper,
            as: "papers", // Use the alias defined in the association
            attributes: [],
            through: {
              attributes: [], // Exclude join table attributes
            },
            required: true,
            where: { examName },
          },
        ],
      });

      if (!questionsDocuments.length) {
        return res.status(404).json({
          success: false,
          message: "No questions available to update",
        });
      }

      const questions = questionsDocuments.map((q) => q.toJSON());

      console.log(`Starting to populate ${questions.length} questions`);

      // 5. Chunk questions into groups of 250.
      const questionChunks = lodash.chunk(questions, 50);

      res.status(200).json({ success: true });

      // Process each chunk.
      let chunkIndex = 0;
      for (const chunk of questionChunks) {
        // Prepare input: pick only id, question (from questionText), and options.
        console.log(
          `Populating chunk ${++chunkIndex}\tQuestion ${
            (chunkIndex - 1) * 50
          }-${chunkIndex * 50}\tTimestamp ${new Date().toISOString()}`
        );
        const inputData = chunk.map((q) => ({
          id: q.id.toString(), // Convert id to string if needed.
          question: q.questionText,
          options: q.options,
        }));
        const inputJSONString = JSON.stringify(inputData);

        // 6. Prepare messages and response format for the OpenAI API.
        // Assumes existence of helper functions:
        // - getOpenAIMessagesForQuestionMetadataUpdate(inputJSONString)
        // - getResponseFormatForQuestionMetadataUpdate()
        const messages =
          getOpenAIMessagesForQuestionMetadataUpdate(inputJSONString);
        const responseFormat = getResponseFormatForQuestionMetadataUpdate();

        // 7. Call OpenAI to get updated metadata.
        const response = await openai.beta.chat.completions.parse({
          model: "gpt-4o",
          messages,
          response_format: responseFormat,
        });
        const result = response.choices[0].message.parsed;
        // Expected structure: { answer: [ { id, chapter, subject }, ... ] }
        const answers = result.answer;
        if (answers && Array.isArray(answers) && answers.length) {
          const values = answers
            .map(
              (answer) =>
                `(${answer.id}, '${answer.chapter.replace(
                  /'/g,
                  "''"
                )}', '${answer.subject.replace(/'/g, "''")}')`
            )
            .join(",");

          const query = `
            UPDATE "Questions" AS q SET
              "chapter" = data.chapter,
              "subject" = data.subject
            FROM (VALUES ${values}) AS data(id, chapter, subject)
            WHERE q.id = data.id;
          `;

          await sequelize.query(query);
        }

        // Optional: wait between chunks to avoid hitting rate limits.
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }

      return;
    } catch (error) {
      console.error("Error updating question metadata:", error);
      return;
    }
  }

  async getChapters(req, res) {
    const { grade, subject, examName, repositoryType } = req.body;

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required to get chapters",
      });
    }

    if (examName) {
      const examSyllabusBySubject = examSyllabus[`${examName}`];
      const subjectSyllabus = examSyllabusBySubject[`${subject}`];
      return res.status(200).json({ success: true, chapters: subjectSyllabus });
    }

    if (grade) {
      const questions = await Question.findAll({
        where: {
          grade,
          subject,
        },
        attributes: [
          // "chapter" as the alias, so each row returns { chapter: 'someChapter' }
          [Sequelize.fn("DISTINCT", Sequelize.col("chapter")), "chapter"],
        ],
        raw: true,
      });

      // questions will be an array of objects like [{ chapter: 'Chapter1' }, { chapter: 'Chapter2' }, ...]
      // Map to just the chapter names
      const distinctChapters = questions
        .map((item) => item.chapter)
        .filter((ch) => !!ch); // remove null/empty if any

      return res
        .status(200)
        .json({ success: true, chapters: distinctChapters });
    }

    res.status(400).json({
      success: false,
      message: "subject and (grade/examName) are required to get chapters",
    });
  }

  async getQuestionsForChapters(req, res) {
    const { chapters } = req.body;
    if (!Array.isArray(chapters)) {
      return res
        .status(400)
        .json({ error: "`chapters` must be an array of strings" });
    }

    try {
      const results = await Promise.all(
        chapters.map(async (chapter) => {
          // 1. Normalize input into words for ILIKE matching
          const words = chapter
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean);
          // 2. Build base WHERE clause: chapter ILIKE '%word1%' AND ILIKE '%word2%' ...
          const baseWhere = {
            [Op.and]: words.map((w) => ({ chapter: { [Op.iLike]: `%${w}%` } })),
          };

          // 3. Fetch up to 10 descriptive and up to 10 MCQ separately
          const [descriptiveRows, mcqRows] = await Promise.all([
            Question.findAll({
              where: { ...baseWhere, type: "descriptive" },
              attributes: ["questionText"],
              raw: true,
              order: [["updatedAt", "DESC"]],
              limit: 10,
            }),
            Question.findAll({
              where: { ...baseWhere, type: "mcq" },
              attributes: ["questionText", "options"],
              raw: true,
              order: [["updatedAt", "DESC"]],
              limit: 10,
            }),
          ]);

          // 4. Determine how many of each to take
          const haveDesc = descriptiveRows.length;
          const haveMcq = mcqRows.length;
          let takeDesc = Math.min(5, haveDesc);
          let takeMcq = Math.min(5, haveMcq);
          let slotsLeft = 10 - (takeDesc + takeMcq);

          // 5. Compensate from the other type if one ran short
          if (slotsLeft > 0) {
            const extraFromMcq = Math.min(slotsLeft, haveMcq - takeMcq);
            takeMcq += extraFromMcq;
            slotsLeft -= extraFromMcq;
          }
          if (slotsLeft > 0) {
            const extraFromDesc = Math.min(slotsLeft, haveDesc - takeDesc);
            takeDesc += extraFromDesc;
            slotsLeft -= extraFromDesc;
          }

          // 6. Slice and map to plain strings
          const finalDescriptive = descriptiveRows
            .slice(0, takeDesc)
            .map((r) => r.questionText);

          const finalMcq = mcqRows.slice(0, takeMcq).map((r) => ({
            questionText: r.questionText,
            options: (r?.options || []).map((opt) => ({
              key: opt.key,
              option: opt.option,
            })), // include the full array here
          }));

          // 7. Return under the original chapter key
          return { [chapter]: finalDescriptive.concat(finalMcq) };
        })
      );

      res.json(results);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const questionController = new QuestionController();
