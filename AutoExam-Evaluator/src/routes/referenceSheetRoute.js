import express from "express";
import { parseS3UrlForEvaluation, s3 } from "../config/s3.js";
import {
  convertToOCR,
  getSignedUrl,
  safeCall,
  uploadAndReplaceImages,
  uploadFileToMistral,
} from "../utils.js";
import { generateReferenceSheetFromExtractedTextMistral } from "../controllers/referenceAnswerSheetController.js";
import path from "path";
import { ReferenceSheet } from "../models/ReferenceSheet.js";
import { AUTOEXAM_EVALUATION_BUCKET } from "../constants.js";
const referenceSheetRouter = express.Router();

referenceSheetRouter.post(
  "/parse-reference-sheet-and-save-details",
  async (req, res) => {
    const { referenceSheetLink, school, standard, subject, test_date } =
      req.body;
    // 1) Validate all required inputs in one place
    if (!referenceSheetLink || !school || !standard || !subject || !test_date) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required parameters: referenceSheetUrl, school, standard, subject, test_date",
      });
    }

    try {
      const Bucket = AUTOEXAM_EVALUATION_BUCKET;
      const { Key } = parseS3UrlForEvaluation(referenceSheetLink);
      // 3) Run each async step through safeCall to auto-wrap errors
      const s3Object = await safeCall("retrieve file from S3", () =>
        s3.getObject({ Bucket, Key }).promise()
      );
      const fileBuffer = s3Object.Body;

      const uploadedFile = await safeCall("upload file to Mistral", () =>
        uploadFileToMistral({ Key, fileBuffer })
      );
      const signedUrl = await safeCall("get signed URL", () =>
        getSignedUrl({ uploadedFile })
      );
      const ocrResponse = await safeCall("convert to OCR", () =>
        convertToOCR({ signedUrl })
      );

      const { name: prefix } = path.parse(Key);
      const updatedOcrResponse = await safeCall(
        "upload and replace images",
        () => uploadAndReplaceImages({ ocrResponse, prefix })
      );

      const [generatedResult, cost] = await safeCall(
        "generate reference sheet",
        () =>
          generateReferenceSheetFromExtractedTextMistral({
            ocrResponse: updatedOcrResponse,
            prefix,
          })
      );

      // 4) Persist to DB
      const referenceSheetDoc = await safeCall(
        "save reference sheet to DB",
        () =>
          ReferenceSheet.create({
            school,
            standard,
            subject,
            test_date,
            original_pdf_url: referenceSheetLink,
            ocr_text: JSON.stringify(updatedOcrResponse),
            conversion_json: generatedResult,
            cost_of_conversion_to_evaluable_json: cost,
          })
      );

      // 5) Final response
      return res.status(200).json({
        success: true,
        data: generatedResult?.data,
        referenceSheetId: referenceSheetDoc?.id,
      });
    } catch (err) {
      console.error("Error in reference sheet route:", err);
      // unified error handler
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.message,
        details: err.details,
      });
    }
  }
);

referenceSheetRouter.put(
  "/update-reference-sheet-details",
  async (req, res) => {
    const { referenceSheetId, totalMarks, questions } = req.body;

    // 1) Validate all required inputs in one place
    if (!referenceSheetId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter: referenceSheetId",
      });
    }

    if (!totalMarks || totalMarks === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter: totalMarks",
      });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid questions array",
      });
    }

    // 2) Validate questions structure
    const invalidQuestions = questions.filter(
      (q, index) =>
        !q.questionNumber ||
        !q.content ||
        !q.correctAnswer ||
        typeof q.marks !== "number" ||
        q.marks < 0 ||
        !q.type ||
        !["mcq", "descriptive"].includes(q.type)
    );

    if (invalidQuestions.length > 0) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid question structure. Each question must have: questionNumber, content, correctAnswer, marks (number >= 0), and type (mcq/descriptive)",
        details: `${invalidQuestions.length} invalid questions found`,
      });
    }

    try {
      // 3) Check if reference sheet exists
      const existingReferenceSheet = await safeCall(
        "find reference sheet in DB",
        () => ReferenceSheet.findByPk(referenceSheetId)
      );

      if (!existingReferenceSheet) {
        return res.status(404).json({
          success: false,
          error: "Reference sheet not found",
        });
      }

      // 4) Parse existing conversion_json to update it
      let existingConversionJson;
      try {
        existingConversionJson =
          typeof existingReferenceSheet.conversion_json === "string"
            ? JSON.parse(existingReferenceSheet.conversion_json)
            : existingReferenceSheet.conversion_json;
      } catch (parseError) {
        console.error("Error parsing existing conversion_json:", parseError);
        return res.status(500).json({
          success: false,
          error: "Failed to parse existing reference sheet data",
        });
      }

      // 5) Update the conversion JSON with new data
      const updatedConversionJson = {
        ...existingConversionJson,
        data: {
          ...existingConversionJson.data,
          totalMarks: totalMarks,
          questions: questions.map((question, index) => ({
            questionNumber: question.questionNumber,
            content: question.content.trim(),
            correctAnswer: question.correctAnswer.trim(),
            marks: question.marks,
            type: question.type,
          })),
        },
      };

      // 6) Update the reference sheet in database
      const updatedReferenceSheet = await safeCall(
        "update reference sheet in DB",
        () =>
          existingReferenceSheet.update({
            conversion_json: updatedConversionJson,
            updated_at: new Date(),
          })
      );

      // 7) Log the update for audit trail
      console.log(`Reference sheet ${referenceSheetId} updated successfully:`, {
        totalMarks,
        questionsCount: questions.length,
        updatedAt: new Date().toISOString(),
      });

      // 8) Final response
      return res.status(200).json({
        success: true,
        message: "Reference sheet updated successfully",
        data: {
          referenceSheetId: updatedReferenceSheet.id,
          totalMarks: totalMarks,
          questionsCount: questions.length,
          updatedAt: updatedReferenceSheet.updated_at,
        },
      });
    } catch (err) {
      console.error("Error in update reference sheet route:", err);
      // unified error handler
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Internal server error",
        details: err.details,
      });
    }
  }
);

export { referenceSheetRouter };
