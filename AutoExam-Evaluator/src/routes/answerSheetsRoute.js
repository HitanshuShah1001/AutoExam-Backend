import express from "express";
import { parseS3Url, parseS3UrlForEvaluation, s3 } from "../config/s3.js";
import {
  convertToOCR,
  extractStudentNameFromUrl,
  getSignedUrl,
  safeCall,
  uploadAndReplaceImages,
  uploadFileToMistral,
} from "../utils.js";
import path from "path";
import { ReferenceSheet } from "../models/ReferenceSheet.js";
import { generateStudentEvaluationFromExtractedTextMistral } from "../controllers/studentAnswerSheetController.js";
import { compareStudentAndReferenceAnswersheetJson } from "../controllers/comparingAnswerSheetController.js";
import { StudentAnswerSheet } from "../models/StudentAnswerSheet.js";
import { AUTOEXAM_EVALUATION_BUCKET } from "../constants.js";

const studentReferenceSheetRouter = express.Router();

studentReferenceSheetRouter.post(
  "/parse-student-answer-sheet-and-save-details",
  async (req, res) => {
    const { studentSheetUrls, referenceSheetId, ...data } = req.body;
    if (
      !studentSheetUrls ||
      !Array.isArray(studentSheetUrls) ||
      studentSheetUrls.length === 0 ||
      !referenceSheetId ||
      !data.test_date ||
      !data.standard
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required parameters: studentSheetUrls, referenceSheetId, test_date, standard",
      });
    }

    const referenceSheet = await ReferenceSheet.findByPk(referenceSheetId);
    if (!referenceSheet) {
      return res
        .status(404)
        .json({ success: false, error: "ReferenceSheet not found" });
    }
    const referenceJSON = referenceSheet.conversion_json;

    try {
      const rowsToInsert = [];

      for (const pdfUrl of studentSheetUrls) {
        // 1) fetch from S3
        const student_name = extractStudentNameFromUrl(pdfUrl);
        if (!student_name) {
          console.error(`Invalid student name extracted from URL: ${pdfUrl}`);
          continue; // skip this URL if name extraction fails
        }
        const Bucket = AUTOEXAM_EVALUATION_BUCKET;
        const { Key } = parseS3UrlForEvaluation(pdfUrl);
        const s3Obj = await safeCall("retrieve file from S3", () =>
          s3.getObject({ Bucket, Key }).promise()
        );
        const fileBuffer = s3Obj.Body;

        // 2) OCR prep + conversion
        const uploadedFile = await safeCall("upload file to Mistral", () =>
          uploadFileToMistral({ Key, fileBuffer })
        );
        const signedUrl = await safeCall("get signed URL", () =>
          getSignedUrl({ uploadedFile })
        );
        const ocr = await safeCall("convert to OCR", () =>
          convertToOCR({ signedUrl })
        );
        const prefix = path.parse(Key).name;
        const fixedOcr = await safeCall("upload and replace images", () =>
          uploadAndReplaceImages({ ocrResponse: ocr, prefix })
        );

        // 3) generate student JSON + cost
        const [genJsonResult, cost_of_conversion_to_evaluable_json] =
          await safeCall("generate answer json and calculate marks", () =>
            generateStudentEvaluationFromExtractedTextMistral({
              ocrResponse: fixedOcr,
              referenceAnswerSheet: referenceJSON,
            })
          );

        if (!genJsonResult.success) {
          // skip failed ones
          continue;
        }

        // 4) compare + cost
        const [finalEval, cost_of_evaluation] =
          await compareStudentAndReferenceAnswersheetJson({
            studentAnswerSheetJson: genJsonResult.data,
            referenceAnswerSheetJson: referenceJSON,
          });

        // 5) queue up the row
        rowsToInsert.push({
          referenceSheetId,
          standard: data.standard,
          test_date: data.test_date,
          original_pdf_url: pdfUrl,
          student_answers_json: genJsonResult.data,
          evaluation_json: finalEval.data,
          final_marks: finalEval.data.totalMarks ?? null,
          cost_of_conversion_to_evaluable_json,
          cost_of_evaluation,
          student_name,
        });
      }

      // 6) insert all at once
      const creationPromises = rowsToInsert.map((row) =>
        StudentAnswerSheet.create(row)
      );
      const savedSheets = await Promise.all(creationPromises);

      return res.status(200).json({ success: true, data: savedSheets });
    } catch (err) {
      console.error(
        "Error in parse-student-answer-sheet-and-save-details",
        err
      );
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export { studentReferenceSheetRouter };
