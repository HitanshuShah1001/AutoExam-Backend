export function getStudentGradingResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "student_grading_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          gradingResult: {
            type: "object",
            description:
              "Contains the grading results for the student's answer sheet",
            properties: {
              totalMarksScored: {
                type: "number",
                description:
                  "The total marks earned by the student across all questions",
              },
              totalPossibleMarks: {
                type: "number",
                description:
                  "The total possible marks from the reference answer sheet",
              },
              percentage: {
                type: "number",
                description:
                  "The percentage score (totalMarksScored / totalPossibleMarks * 100)",
              },
              gradedQuestions: {
                type: "array",
                description:
                  "A list of all graded questions with detailed feedback",
                items: {
                  type: "object",
                  properties: {
                    questionNumber: {
                      type: "string",
                      description:
                        "The question number from the reference sheet",
                    },
                    questionText: {
                      type: "string",
                      description: "The question text from the reference sheet",
                    },
                    questionType: {
                      type: "string",
                      enum: ["mcq", "descriptive"],
                      description: "Type of the question",
                    },
                    marksScored: {
                      type: "number",
                      description:
                        "Marks earned by the student for this question (in increments of 0.5)",
                    },
                    totalMarks: {
                      type: "number",
                      description: "Total possible marks for this question",
                    },
                    studentAnswer: {
                      type: "string",
                      description: "The answer provided by the student",
                    },
                    referenceAnswer: {
                      type: "string",
                      description:
                        "The correct answer from the reference sheet",
                    },
                    feedback: {
                      type: "string",
                      description:
                        "Constructive feedback on the student's answer",
                    },
                    gradingNotes: {
                      type: "string",
                      description:
                        "Explanation of how marks were calculated for this question",
                    },
                  },
                  required: [
                    "questionNumber",
                    "questionText",
                    "questionType",
                    "marksScored",
                    "totalMarks",
                    "studentAnswer",
                    "referenceAnswer",
                    "feedback",
                    "gradingNotes",
                  ],
                  additionalProperties: false,
                },
              },
              overallFeedback: {
                type: "string",
                description:
                  "General feedback on the student's performance across all questions",
              },
              strengths: {
                type: "array",
                description:
                  "Key strengths identified in the student's answers",
                items: {
                  type: "string",
                },
              },
              areasForImprovement: {
                type: "array",
                description: "Areas where the student could improve",
                items: {
                  type: "string",
                },
              },
            },
            required: [
              "totalMarksScored",
              "totalPossibleMarks",
              "percentage",
              "gradedQuestions",
              "overallFeedback",
            ],
            additionalProperties: false,
          },
        },
        required: ["gradingResult"],
        additionalProperties: false,
      },
    },
  };
}
