import fs from "fs";
import Mustache from "mustache";
import s3 from "./s3.js";
import { plivoClient } from "./plivoClient.js";

export function structureQuestionPaper({
  questionPaper,
  grade,
  academyName,
  totalMarks,
  subject,
  timeDuration,
}) {
  const hasmcq = questionPaper.some((q) => q.type === "mcq");
  const mcqQuestions = questionPaper.filter((q) => q.type === "mcq");
  const descriptiveQuestions = questionPaper.filter((q) => q.type !== "mcq");
  const distinctMarksSet = new Set(descriptiveQuestions.map((q) => q.marks));
  const distinctMarks = Array.from(distinctMarksSet).sort((a, b) => a - b);
  let nextSectionCharCode = "A".charCodeAt(0);
  if (hasmcq) {
    nextSectionCharCode++;
  }

  const marksToSection = {};
  distinctMarks.forEach((mark) => {
    marksToSection[mark] = String.fromCharCode(nextSectionCharCode);
    nextSectionCharCode++;
  });

  const newQuestionPaper = [];

  // Process mcq questions first
  if (hasmcq) {
    let mcqCounter = 1;
    mcqQuestions.forEach((q) => {
      newQuestionPaper.push({
        ...q,
        section: "A",
        questionNumber: mcqCounter++,
      });
    });
  }

  // Use this map to keep track of optional groups that have been inserted.
  const optionalGroupMap = new Map();
  const sectionToCounter = {};

  // Iterate descriptive questions in the original order.
  descriptiveQuestions.forEach((q) => {
    const section = marksToSection[q.marks];
    if (!section) return;

    if (q.optionalGroupId) {
      // If this is the first time we see this optional group, create and push the group object.
      if (!optionalGroupMap.has(q.optionalGroupId)) {
        const questionNumber = sectionToCounter[section] ? sectionToCounter[section] : 1;
        sectionToCounter[section] = questionNumber + 1;
        const group = {
          optionalGroup: true,
          section,
          questionNumber,
          questions: [],
        };
        optionalGroupMap.set(q.optionalGroupId, group);
        newQuestionPaper.push(group); // Insert at the moment of first encounter.
      }
      // Append the question to the existing optional group.
      optionalGroupMap.get(q.optionalGroupId).questions.push(q);
    } else {
      // For non-optional questions, assign question number and push immediately.
      if (!sectionToCounter[section]) {
        sectionToCounter[section] = 1;
      }
      newQuestionPaper.push({
        ...q,
        section,
        questionNumber: sectionToCounter[section],
      });
      sectionToCounter[section]++;
    }
  });

  // Group questions by section for further processing.
  const sectionMap = {};
  newQuestionPaper.forEach((q) => {
    const s = q.section;
    if (!sectionMap[s]) {
      sectionMap[s] = [];
    }
    sectionMap[s].push(q);
  });

  const sections = Object.keys(sectionMap)
    .sort()
    .map((sectionName) => {
      const questionsInSection = sectionMap[sectionName];

      const sectionMarks =
        questionsInSection.length > 0 ? questionsInSection[0].marks : 0;

      const sectionTotalMarks = questionsInSection.reduce(
        (acc, q) =>
          acc +
          (q.optionalGroup
            ? q.questions.reduce((sum, optQ) => sum + (optQ.marks || 0), 0) /
            q.questions.length
            : q.marks || 0),
        0
      );

      const simpleQuestions = questionsInSection.map((q) => {
        if (q.optionalGroup) {
          return {
            optionalGroup: true,
            questionNumber: q.questionNumber,
            questions: q.questions.map((optQ, idx) => {
              const questionNumberStr = String(q.questionNumber);
              const basePadding = questionNumberStr.length + 1;

              return {
                ...optQ,
                question: optQ.questionText,
                isMCQ: optQ.type === "mcq",
                options:
                  optQ.type === "mcq" && optQ.options
                    ? optQ.options.map((opt) => ({
                      key: opt.key,
                      option: opt.optionText ?? opt.option,
                      imageUrl: opt.imageUrl,
                    }))
                    : [],
                subQuestionPadding: basePadding,
                isFirst: idx === 0,
                last: idx === q.questions.length - 1,
              };
            }),
          };
        }

        return {
          ...q,
          questionNumber: q.questionNumber,
          question: q.questionText,
          isMCQ: q.type === "mcq",
          options:
            q.type === "mcq" && q.options
              ? q.options.map((opt) => ({
                key: opt.key,
                option: opt.optionText ?? opt.option,
                imageUrl: opt.imageUrl,
              }))
              : [],
        };
      });

      return {
        name: sectionName,
        sectionNumberOfQuestions: simpleQuestions.length,
        sectionMarks,
        sectionTotalMarks,
        questions: simpleQuestions,
      };
    });

  return {
    sections,
    grade,
    academyName,
    totalMarks,
    subject,
    timeDuration,
  };
}

export function structureSectionedQuestionPapers({
  questionPaper,
  grade,
  academyName,
  totalMarks,
  subject,
  timeDuration,
}) {
  // Group questions by their existing "section"
  const sectionMap = {};
  questionPaper.forEach((q) => {
    if (!sectionMap[q.section]) {
      sectionMap[q.section] = [];
    }
    sectionMap[q.section].push(q);
  });

  // Sort each section's questions by "orderIndex"
  Object.keys(sectionMap).forEach((sectionName) => {
    sectionMap[sectionName].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  });

  // Build a new question list, preserving optional-group logic, but using existing sections and orderIndex.
  const newQuestionPaper = [];
  const sortedSectionNames = Object.keys(sectionMap).sort();

  sortedSectionNames.forEach((sectionName) => {
    let questionCounter = 1;
    const optionalGroupMap = new Map();

    sectionMap[sectionName].forEach((q) => {
      if (q.optionalGroupId) {
        // If this is the first time we see this optional group in the section, create the group object.
        if (!optionalGroupMap.has(q.optionalGroupId)) {
          const group = {
            optionalGroup: true,
            section: sectionName,
            questionNumber: questionCounter++,
            questions: [],
          };
          optionalGroupMap.set(q.optionalGroupId, group);
          newQuestionPaper.push(group);
        }
        // Append the question to the existing optional group.
        optionalGroupMap.get(q.optionalGroupId).questions.push(q);
      } else {
        // Normal question
        newQuestionPaper.push({
          ...q,
          section: sectionName,
          questionNumber: questionCounter++,
        });
      }
    });
  });

  // Now, group the newly formed list by section again for the final transformation (same as in the original function).
  const finalSectionMap = {};
  newQuestionPaper.forEach((q) => {
    const s = q.section;
    if (!finalSectionMap[s]) {
      finalSectionMap[s] = [];
    }
    finalSectionMap[s].push(q);
  });

  const sections = Object.keys(finalSectionMap)
    .sort()
    .map((sectionName) => {
      const questionsInSection = finalSectionMap[sectionName];

      // Same logic for sectionMarks:
      const sectionMarks =
        questionsInSection.length > 0
          ? questionsInSection[0].optionalGroup
            ? questionsInSection[0].questions[0]?.marks || 0
            : questionsInSection[0].marks || 0
          : 0;

      // Same logic for sectionTotalMarks:
      const sectionTotalMarks = questionsInSection.reduce((acc, q) => {
        if (q.optionalGroup) {
          const groupSum = q.questions.reduce((sum, optQ) => sum + (optQ.marks || 0), 0);
          return acc + groupSum / (q.questions.length || 1);
        }
        return acc + (q.marks || 0);
      }, 0);

      // Transform to the same "simpleQuestions" format:
      const simpleQuestions = questionsInSection.map((q) => {
        if (q.optionalGroup) {
          return {
            optionalGroup: true,
            questionNumber: q.questionNumber,
            questions: q.questions.map((optQ, idx) => {
              const questionNumberStr = String(q.questionNumber);
              const basePadding = questionNumberStr.length + 1;

              return {
                ...optQ,
                question: optQ.questionText,
                isMCQ: optQ.type === "mcq",
                options:
                  optQ.type === "mcq" && optQ.options
                    ? optQ.options.map((opt) => ({
                      key: opt.key,
                      option: opt.optionText ?? opt.option,
                      imageUrl: opt.imageUrl,
                    }))
                    : [],
                subQuestionPadding: basePadding,
                isFirst: idx === 0,
                last: idx === q.questions.length - 1,
              };
            }),
          };
        }

        return {
          ...q,
          questionNumber: q.questionNumber,
          question: q.questionText,
          isMCQ: q.type === "mcq",
          options:
            q.type === "mcq" && q.options
              ? q.options.map((opt) => ({
                key: opt.key,
                option: opt.optionText ?? opt.option,
                imageUrl: opt.imageUrl,
              }))
              : [],
        };
      });

      return {
        name: sectionName,
        sectionNumberOfQuestions: simpleQuestions.length,
        sectionMarks,
        sectionTotalMarks,
        questions: simpleQuestions,
      };
    });

  return {
    sections,
    grade,
    academyName,
    totalMarks,
    subject,
    timeDuration,
  };
}

function addStepIndexes(calculationSteps) {
  return calculationSteps?.map((step, idx) => ({
    ...step,
    stepIndex: idx + 1, // "1)", "2)", ...
  }));
}

export function structureSolution({
  questionPaper,
  grade,
  academyName,
  totalMarks,
  subject,
  timeDuration,
}) {
  const hasmcq = questionPaper.some((q) => q.type === "mcq");

  const mcqQuestions = questionPaper.filter((q) => q.type === "mcq");
  const descriptiveQuestions = questionPaper.filter((q) => q.type !== "mcq");

  const distinctMarksSet = new Set(descriptiveQuestions.map((q) => q.marks));
  const distinctMarks = Array.from(distinctMarksSet).sort((a, b) => a - b);

  let nextSectionCharCode = "A".charCodeAt(0);
  if (hasmcq) {
    nextSectionCharCode++; // 'A' reserved for mcq
  }

  const marksToSection = {};
  distinctMarks.forEach((mark) => {
    marksToSection[mark] = String.fromCharCode(nextSectionCharCode);
    nextSectionCharCode++;
  });

  const newQuestionPaper = [];

  if (hasmcq) {
    let mcqCounter = 1;
    mcqQuestions.forEach((q) => {
      newQuestionPaper.push({
        ...q,
        section: "A",
        questionNumber: mcqCounter++,
      });
    });
  }

  const sectionToCounter = {};
  descriptiveQuestions.forEach((q) => {
    const sec = marksToSection[q.marks];
    if (!sec) return;

    if (sectionToCounter[sec] == null) {
      sectionToCounter[sec] = 1;
    }

    newQuestionPaper.push({
      ...q,
      section: sec,
      questionNumber: sectionToCounter[sec],
    });

    sectionToCounter[sec]++;
  });

  const sectionMap = {};
  newQuestionPaper.forEach((q) => {
    if (!sectionMap[q.section]) {
      sectionMap[q.section] = [];
    }
    sectionMap[q.section].push(q);
  });

  const sections = Object.keys(sectionMap)
    .sort()
    .map((sectionName) => {
      const questionsInSection = sectionMap[sectionName];

      const sectionMarks =
        questionsInSection.length > 0 ? questionsInSection[0].marks : 0;

      const sectionTotalMarks = questionsInSection.reduce(
        (acc, q) => acc + (q.marks || 0),
        0
      );

      const structuredQuestions = questionsInSection.map((q) => {
        let correctAnswerLabel = q.correctAnswer;
        let correctAnswerOption = q.correctAnswer;

        if (q.type === "mcq" && Array.isArray(q.options)) {
          const found = q.options.find((opt) => opt.key === q.correctAnswer);
          if (found) {
            correctAnswerOption = found.option;
          }
        }

        const orderedCalculationSteps = addStepIndexes(q.calculationSteps);

        return {
          questionNumber: q.questionNumber,
          question: q.question,
          marks: q.marks,
          topic: q.topic,
          difficulty: q.difficulty,
          isMCQ: q.type === "mcq",
          correctAnswer: q.correctAnswer,
          correctAnswerLabel,
          correctAnswerOption,
          calculationSteps: orderedCalculationSteps || [],
        };
      });

      return {
        name: sectionName,
        sectionNumberOfQuestions: structuredQuestions.length,
        sectionMarks,
        sectionTotalMarks,
        questions: structuredQuestions,
      };
    });

  // 8. Return final object with top-level fields
  return {
    academyName,
    subject,
    grade,
    totalMarks,
    timeDuration,
    sections,
  };
}

export function generateHTML(structuredQuestionPaper, templatePath) {
  const template = fs.readFileSync(templatePath, "utf-8");
  return Mustache.render(template, structuredQuestionPaper);
}

export function getOpenAIMessages(blueprint, prompts, standard) {
  const systemPrompt = prompts.generateQuestionPaper.system;
  const userPrompt = prompts.generateQuestionPaper.user
    // Replace "Standard 8" with the provided standard value.
    .replace("Standard 8", `Standard ${standard}`)
    // Replace the blueprint JSON placeholder with the actual blueprint.
    .replace(
      '```json\n{\n    "blueprint": []\n}\n```',
      `\`\`\`json\n${JSON.stringify({ blueprint }, null, 4)}\n\`\`\``
    );
  console.log("user prompt after", userPrompt);
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

export function getOpenAIMessagesForExtractedTextToQuestions(extractedText) {
  const systemPrompt = `
      Context and General Instructions:
      1. You are a middleware that converts unstructured raw text of question papers into structured responses following the specified response format.
      2. You must not change or omit any content from the paper.
      3. If difficulty and marks are not provided, default the difficulty to "medium" and marks to 1.
      4. Ignore intermittent text between the questions like Answer #3 etc. Remember to only process the questions.
         For Example: if the questions are like.
         I. Answer these questions in a few words or a couple of sentences each.
            1. How old are Margie and Tommy?
            2. What did Margie write in her diary?
            3. Sure they had a teacher, but it wasn’t a regular teacher. It was a man.
                (i) Who does ‘they’ refer to?
                (ii) What does ‘regular’ mean here?
                (iii) What is it contrasted with?
        Then, there are 2 descriptive questions and 1 MCQ Question
        Descriptive will be => How old are Margie and Tommy? and How old are Margie and Tommy?
        MCQ will be => Sure they had a teacher, but it wasn’t a regular teacher. It was a man. with options as Who does ‘they’ refer to?, What does ‘regular’ mean here? and What is it contrasted with?
      5. You need to be very discerning about classifying a question as descriptive or mcq. Do no mis judge a section heading with 8 descriptive questions below it as an MCQ question with 8 options. They will be 8 different descriptive questions and you can ignore the section heading.
          For Example: These are 8 Descriptive questions while the question heading is just an instruction which should be ignored.
          2. Now use these adverbs to fill in the blanks in the sentences below.
              (i) The report must be read ______ so that the performance can be improved.
              (ii) At the interview, Sameer answered our questions ,
              shrugging his shoulders.
              (iii) We all behave (iv) The teacher shook her head (v) I forgot about it.
              (vi) When I complimented Revathi on her success, she just smiled
              and turned away.
              (vii) The President of the Company is be able to meet you.
              (viii) I finished my work busy and will not
so that I could go out to play.
      6. Do not include any Question number like 1.) or Q1) or Question 1) in the question itself.
      7. Ignore Section heading in the questions. Only focus on the actual questions

      Instructions:
      1. In every question text and option text, ensure that all math expressions are explicitly wrapped with $ signs.
        - For example, if the question is “What is 2+2?”, it must be rendered as “What is $2+2$?”.
        - Example for a fraction: if the text contains “3/4”, it must be rendered as “$\\frac{3}{4}$”.
        - Example for an integral: if the text contains “∫₀¹ x dx”, it must be rendered as “$\\int_0^1 x\\,dx$”.
      2. Ignore all text from watermarks (e.g., "mathongo") or similar irrelevant content.
      

      Important: A paper wont be accepted unless it has  all questions in the text. Even if more tokens are being used, ensure that each paper has all questions that are found in the text. No more no less. Otherwise your task will be considered a failure
      Important: Ignore watermarks that you find irrelevant to the context. Alsow make sure that you dont include any answers as this is strictly a question paper.
      
      Few-Shot Examples for Math Equations:
      - Example 1: Simple Equation
        - Raw: "Solve 2+2."
        - Expected: "Solve $2+2$."
      - Example 2: Fraction
        - Raw: "Express the fraction 3/4 in simplest form."
        - Expected: "Express the fraction $\\frac{3}{4}$ in simplest form."
      - Example 3: Multiple Equations
        - Raw: "If a=1, what is a+2? And evaluate 3/4."
        - Expected: "If $a=1$, what is $a+2$? And evaluate $\\frac{3}{4}$."

      Remember: Do not skip or modify any content from the original paper. Follow all instructions exactly as provided.
`;
  const userPrompt = `Extract questions from the following question paper text in the required responseFormat:
\`\`\`text
${extractedText}
\`\`\``;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

export function getOpenAIMessagesForMistralExtractedTextToQuestions(extractedText) {
  const systemPrompt = `
      Context and General Instructions:
      1. You are a middleware that converts unstructured raw text of question papers into structured responses following the specified response format.
      2. You must not change or omit any content from the paper.
      3. Every math equation in the question text and option text MUST be wrapped in KaTeX syntax delimiters: a starting $ and an ending $. If an equation is not wrapped, it is considered incorrect.
      4. If difficulty and marks are not provided, default the difficulty to "medium" and marks to 4.

      Instructions:
      1. In every question text and option text, ensure that all math expressions are explicitly wrapped with $ signs.
        - For example, if the question is “What is 2+2?”, it must be rendered as “What is $2+2$?”.
        - Example for a fraction: if the text contains “3/4”, it must be rendered as “$\\frac{3}{4}$”.
        - Example for an integral: if the text contains “∫₀¹ x dx”, it must be rendered as “$\\int_0^1 x\\,dx$”.
      2. Each question should be assigned a subject from the following: maths, physics, chemistry.
      3. Each paper must contain EXACTLY 90 questions. A question with options will be an mcq question otherwise it will be a descriptive question.
      4. Ignore all text from watermarks (e.g., "mathongo") or similar irrelevant content.
      5. Identify the chapter to which each question belongs. The chapter must be selected from the exhaustive list provided for each subject below.
      6. Exhaustive List:
        6. "Exhaustive List": {
            "physics": [
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
              "Experimental Skills"
            ],
            "chemistry": [
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
              "Principles Related to Practical Chemistry"
            ],
            "maths": [
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
              "Linear Programming"
            ]
          }

      Important: A paper wont be accepted unless it has 90 questions. Even if more tokens are being used, ensure that each paper has atleast 90 questions. No more no less. Otherwise your task will be considered a failure

      Few-Shot Examples for Math Equations:
      - Example 1: Simple Equation
        - Raw: "Solve 2+2."
        - Expected: "Solve $2+2$."
      - Example 2: Fraction
        - Raw: "Express the fraction 3/4 in simplest form."
        - Expected: "Express the fraction $\\frac{3}{4}$ in simplest form."
      - Example 3: Multiple Equations
        - Raw: "If a=1, what is a+2? And evaluate 3/4."
        - Expected: "If $a=1$, what is $a+2$? And evaluate $\\frac{3}{4}$."

      Remember: Do not skip or modify any content from the original paper. Follow all instructions exactly as provided.
`;
  const userPrompt = `Extract questions from the following question paper text in the required responseFormat:
\`\`\`text
${extractedText}
\`\`\``;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

export async function uploadToS3(content, name, fileType) {
  const fileKey = `questionPapers/${name}.${fileType}`;
  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileKey,
    Body: content,
    ContentType: fileType === "html" ? "text/html" : "application/pdf",
  };

  await s3.upload(uploadParams).promise();
  const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
  return fileUrl;
}

export function getQuestionPaperWithSolutionResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "quiz_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          answer: {
            type: "array",
            description:
              "A collection of answers, each can be a multiple choice or descriptive question. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["mcq", "descriptive"],
                  description: "The type of the question.",
                },
                questionId: {
                  type: "string",
                  description:
                    "The questionId of the question corresponding to the description of the question in the prompt.",
                },
                question: {
                  type: "string",
                  description:
                    "The question being asked. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                },
                marks: {
                  type: "number",
                  description: "The marks assigned for the question.",
                },
                options: {
                  anyOf: [
                    {
                      type: "array",
                      description:
                        "Options for multiple choice questions. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                      items: {
                        type: "object",
                        properties: {
                          key: {
                            type: "string",
                            description:
                              "The key for the option, e.g., A, B, C, D.",
                          },
                          option: {
                            type: "string",
                            description:
                              "The text of the option. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                          },
                        },
                        required: ["key", "option"],
                        additionalProperties: false,
                      },
                    },
                    {
                      type: "null",
                      description:
                        "Null for descriptive questions without options.",
                    },
                  ],
                },
                difficulty: {
                  type: "string",
                  enum: ["easy", "medium", "hard"],
                  description: "The difficulty level of the question.",
                },
                topic: {
                  type: "string",
                  description: "The topic related to the question.",
                },
                correctAnswer: {
                  type: "string",
                  description:
                    "The correct answer for the question. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                },
                calculationSteps: {
                  type: "array",
                  description:
                    "Steps to arrive at the solution. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                  items: {
                    type: "object",
                    properties: {
                      chainOfThoughtExplanation: {
                        type: "string",
                        description:
                          "Explanation of the thought process. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                      },
                      equation: {
                        type: "string",
                        description:
                          "The equation or result at this step. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                      },
                    },
                    required: ["chainOfThoughtExplanation", "equation"],
                    additionalProperties: false,
                  },
                },
              },
              required: [
                "type",
                "questionId",
                "question",
                "marks",
                "options",
                "difficulty",
                "topic",
                "correctAnswer",
                "calculationSteps",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["answer"],
        additionalProperties: false,
      },
    },
  };
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    // Generate a random index between 0 and i
    const j = Math.floor(Math.random() * (i + 1));
    // Swap elements at indices i and j
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function createQuestionPaperSets(questionPaper, numberOfSets) {
  const sets = [];

  for (let setIndex = 0; setIndex < numberOfSets; setIndex++) {
    // Deep clone the original question paper to avoid mutations
    const clonedPaper = deepClone(questionPaper);

    // Shuffle questions within each section
    clonedPaper.sections.forEach((section) => {
      if (section.questions && section.questions.length > 1) {
        shuffleArray(section.questions);
      }
    });

    sets.push(clonedPaper);
  }

  return sets;
}

export const sendMessageOfCompletion = async ({
  countryCode,
  mobileNumber,
  name,
}) => {
  const URL_TO_REDIRECT_TO = `https://www.gotutorless.com/question-paper-list`;
  try {
    if (!mobileNumber || !countryCode) {
      console.error("Mobile number and country code are not present");
      return;
    }

    const response = await plivoClient.messages.create(
      process.env.PLIVO_PHONE_NUMBER,
      `${countryCode}${mobileNumber}`,
      `${name} question paper was generated successfully.
      You can check the generated question paper here: ${URL_TO_REDIRECT_TO}.
      Thank you`
    );

    if (response) {
      console.log("Message sent succesfully");
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

export const sendMessageOfFailure = async ({
  countryCode,
  mobileNumber,
  name,
}) => {
  try {
    if (!mobileNumber || !countryCode) {
      console.error("Mobile number and country code are not present");
      return;
    }

    const response = await plivoClient.messages.create(
      process.env.PLIVO_PHONE_NUMBER,
      `${countryCode}${mobileNumber}`,
      `${name} question paper FAILED to generate.
      This might happen due to some technical issue at our end. We apologize for the inconvenience caused.
      You can retry generating the question paper.
      If the problem persists, please reach out to our support team.`
    );

    if (response) {
      console.log("Message sent succesfully");
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

export function getQuestionPaperFromExtractedTextResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "quiz_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          answer: {
            type: "array",
            description:
              "A collection of answers, each can be a multiple choice or descriptive question. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["mcq", "descriptive"],
                  description: "The type of the question.",
                },
                questionId: {
                  type: "string",
                  description:
                    "The questionId of the question corresponding to the description of the question in the prompt.",
                },
                question: {
                  type: "string",
                  description:
                    "The question being asked. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                },
                subject: {
                  type: "string",
                  description:
                    "The subject of the question being asked. subject should be either one of [maths/physics/chemistry]",
                },
                chapter: {
                  type: "string",
                  description:
                    "The chapter to which the question belongs. Chapter should be picked from the exhaustive list provided in the system prompt according to the subject",
                },
                marks: {
                  type: "number",
                  description: "The marks assigned for the question.",
                },
                imageUrls: {
                  type: "array",
                  description:
                    "An array of image URLs relevant to the question. If no images, provide an empty array.",
                  items: {
                    type: "string",
                    description: "A URL (e.g. S3 link) to an image."
                  }
                },
                options: {
                  anyOf: [
                    {
                      type: "array",
                      description:
                        "Options for multiple choice questions. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                      items: {
                        type: "object",
                        properties: {
                          key: {
                            type: "string",
                            description:
                              "The key for the option, e.g., A, B, C, D.",
                          },
                          option: {
                            type: "string",
                            description:
                              "The text of the option. All math equations must be wrapped between $ and $. Especially the ones containing left right and frac",
                          },
                          imageUrl: {
                            type: "string",
                            description:
                              "An optional image URL for this option. If none, set to an empty string."
                          }
                        },
                        required: ["key", "option", "imageUrl"],
                        additionalProperties: false
                      },
                    },
                    {
                      type: "null",
                      description:
                        "Null for descriptive questions without options.",
                    },
                  ],
                },
                difficulty: {
                  type: "string",
                  enum: ["easy", "medium", "hard"],
                  description: "The difficulty level of the question.",
                },
              },
              required: [
                "type",
                "questionId",
                "question",
                "marks",
                "options",
                "difficulty",
                "imageUrls",
                "chapter",
                "subject"
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["answer"],
        additionalProperties: false,
      },
    },
  };
}

export function getResponseFormatForQuestionMetadataUpdate() {
  return {
    type: "json_schema",
    json_schema: {
      name: "question_update_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          answer: {
            type: "array",
            description: "An array of question updates. Each object includes id, chapter, and subject.",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "The unique identifier of the question."
                },
                chapter: {
                  type: "string",
                  description: "The chapter to which the question belongs."
                },
                subject: {
                  type: "string",
                  description: "The subject of the question."
                }
              },
              required: ["id", "chapter", "subject"],
              additionalProperties: false
            }
          }
        },
        required: ["answer"],
        additionalProperties: false
      }
    }
  };
}

export function getOpenAIMessagesForQuestionMetadataUpdate(questions) {
  const systemPrompt = `
      Context and General Instructions:
      1. You are a smart question analyzer that classifies each input question into a respective subject and chapter. The chapter and subject should be selected froma given list of exhaustive subjects and exhaustive chapters.
      Data:
        [
          "physics": [
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
               "Experimental Skills"
             ],
          "chemistry": [
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
               "Principles Related to Practical Chemistry"
             ],
          "maths": [
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
               "Linear Programming"
             ]
           }
        ]

      Input: You will be given an array of questions containing the following
      1. id: Id of the question
      2. question: The text of the question from which you will classify the question into its respective subject and chapter
      3. options: In case the question is an MCQ question, the options will also be given for more information you that you can analyse better.

      Output: Output will be according to the response format. Remember to map the chapter and subject of each question with its id as you wont be providing the question back in the response. Mapping will be solely throught the id of the question.

      Important: There are 50 questions in the input. The response should have 50 questions. Otherwise your task will be  failure. Do not try to save tokens.
`;
  const userPrompt = `Classify the given questions and assign each question a subject and chapter as required in the required responseFormat:
\`\`\`text
${questions}
\`\`\``;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}