import { get } from "http";
import { openai } from "../config/openai.js";
import { getStudentGradingResponseFormat } from "../responseFormat/studentGrading.js";
import { getOpenAiResponseForStudentGrading } from "../messages/getOpenAiMessagesForStudentGrading.js";
import { MAX_RETRIES } from "../constants.js";
import { costOfOpenAiCall } from "../utils.js";

export async function compareStudentAndReferenceAnswersheetJson({
  studentAnswerSheetJson,
  referenceAnswerSheetJson,
}) {
  try {
    const response_format = await getStudentGradingResponseFormat();
    const messages = await getOpenAiResponseForStudentGrading({
      studentAnswerSheetJson,
      referenceAnswerSheetJson,
    });

    let retries = 0;
    let result;
    let generatedEvaluationJson = [];
    let cost = 0;
    while (retries < MAX_RETRIES) {
      try {
        const response = await openai.beta.chat.completions.parse({
          model: "o4-mini",
          messages,
          response_format,
        });
        let result = response.choices[0].message.parsed;
        generatedStudentEvaluationJson = result?.answer || [];
        if (generatedEvaluationJson.length === 0) {
          retries++;
          console.log("Retrying again");
          continue;
        }
        cost = costOfOpenAiCall({
          i_t: response.usage.prompt_tokens,
          o_t: response.usage.completion_tokens,
        });
        break;
      } catch (apiError) {
        console.error(`API error on attempt ${retries + 1}:`, apiError);
        retries++;

        if (retries >= MAX_RETRIES) {
          throw new Error(
            `Maximum retries (${MAX_RETRIES}) reached: ${apiError.message}`
          );
        }

        // Wait a bit before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, retries))
        );
      }
    }
    return [
      {
        success: true,
        data: generatedEvaluationJson,
      },
    ];
  } catch (e) {
    console.error("An error occured", e);
  }
}
