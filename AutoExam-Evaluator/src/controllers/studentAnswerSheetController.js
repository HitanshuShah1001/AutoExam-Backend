import { openai } from "../config/openai.js";
import { MAX_RETRIES } from "../constants.js";
import { getOpenAiResponseForStudentAnswerSheet } from "../messages/getOpenAiMessagesForStudentAnswerSheet.js";
import { getStudentAnswerSheetResponseFormat } from "../responseFormat/studentAnswersheet.js";
import { costOfOpenAiCall } from "../utils.js";

export async function generateStudentEvaluationFromExtractedTextMistral({
  ocrResponse,
  referenceAnswerSheet,
}) {
  try {
    const responseFormat = getStudentAnswerSheetResponseFormat();
    const ocrResponseToString = JSON.stringify(ocrResponse);
    const referenceAnswerSheetToString = JSON.stringify(referenceAnswerSheet);
    const messages = getOpenAiResponseForStudentAnswerSheet({
      ocrResponse: ocrResponseToString,
      referenceAnswerSheetJson: referenceAnswerSheetToString,
    });
    let retries = 0;
    let result;
    let generatedStudentAnswerSheetJson = [];
    let cost = 0;
    while (retries < MAX_RETRIES) {
      try {
        const response = await openai.beta.chat.completions.parse({
          model: "o4-mini",
          messages,
          response_format: responseFormat,
        });

        result = response.choices[0].message.parsed;
        generatedStudentAnswerSheetJson = result?.answer || [];

        if (generatedStudentAnswerSheetJson.length === 0) {
          retries++;
          console.log(`Retrying... Attempt ${retries}`);
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
        data: generatedStudentAnswerSheetJson,
      },
      cost,
    ];
  } catch (e) {}
}
