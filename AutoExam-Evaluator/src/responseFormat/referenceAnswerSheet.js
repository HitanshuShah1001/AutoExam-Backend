export function getReferenceAnswerSheetResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "simplified_quiz_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          answer: {
            type: "object",
            description:
              "Contains the question answers and the total marks of the question paper",
            properties: {
              totalMarks: {
                type: "number",
                description: "The sum of marks for all the questions.",
              },
              questions: {
                type: "array",
                description: "A list of all the questions in the quiz.",
                items: {
                  type: "object",
                  properties: {
                    questionNumber: {
                      type: "string",
                      description:
                        "The number of the question in the quiz. This should be a unique identifier for each question.",
                    },
                    type: {
                      type: "string",
                      enum: ["mcq", "descriptive"],
                      description: "Type of the question.",
                    },
                    content: {
                      type: "string",
                      description: "The actual content/text of the question.",
                    },
                    correctAnswer: {
                      type: "string",
                      description:
                        "The correct answer. If type is 'mcq', this should match the correct option key or if it is descriptive it should match the answer of the descriptive question.",
                    },
                    marks: {
                      type: "number",
                      description: "Marks assigned for the question.",
                    },
                  },
                  required: ["type", "content", "correctAnswer", "marks","questionNumber"],
                  additionalProperties: false,
                },
              },
            },
            required: ["totalMarks", "questions"],
            additionalProperties: false,
          },
        },
        required: ["answer"],
        additionalProperties: false,
      },
    },
  };
}
