export function getStudentAnswerSheetResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "student_answer_mapping_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          mappedAnswers: {
            type: "object",
            description:
              "Contains the mapped student answers to reference questions",
            properties: {
              mappedQuestions: {
                type: "array",
                description:
                  "A list of all student answers mapped to reference questions",
                items: {
                  type: "object",
                  properties: {
                    questionText: {
                      type: "string",
                      description:
                        "The exact question text from the reference sheet",
                    },
                    questionType: {
                      type: "string",
                      enum: ["MCQ", "Descriptive"],
                      description:
                        "Type of the question from the reference sheet",
                    },
                    referenceAnswer: {
                      type: "string",
                      description:
                        "The correct answer from the reference sheet",
                    },
                    studentAnswer: {
                      type: "string",
                      description:
                        "The answer provided by the student, or 'SKIPPED' if not answered, or 'ILLEGIBLE' if unreadable",
                    },
                    matchConfidence: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                      description:
                        "Confidence level in the mapping between student answer and reference question",
                    },
                    matchingMethod: {
                      type: "string",
                      enum: [
                        "explicit_numbering",
                        "content_based",
                        "contextual",
                        "uncertain",
                      ],
                      description:
                        "The method used to match this student answer to the reference question",
                    },
                  },
                  required: [
                    "questionText",
                    "questionType",
                    "referenceAnswer",
                    "studentAnswer",
                    "matchConfidence",
                    "matchingMethod",
                  ],
                  additionalProperties: false,
                },
              },
              unmappableAnswers: {
                type: "array",
                description:
                  "Student answers that couldn't be mapped to any reference question",
                items: {
                  type: "object",
                  properties: {
                    answerText: {
                      type: "string",
                      description:
                        "The text of the student answer that couldn't be mapped",
                    },
                    questionText: {
                      type: "string",
                      description:
                        "The question text from the reference sheet that this answer was intended for, if known",
                    },
                    notes: {
                      type: "string",
                      description:
                        "Any notes about why this answer couldn't be mapped",
                    },
                  },
                  required: ["answerText", "questionText", "notes"],
                  additionalProperties: false,
                },
              },
            },
            required: ["mappedQuestions", "unmappableAnswers"],
            additionalProperties: false,
          },
        },
        required: ["mappedAnswers"],
        additionalProperties: false,
      },
    },
  };
}
