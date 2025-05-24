import express from "express";
import { parseS3Url, s3 } from "../config/s3.js";
import {
  convertToOCR,
  getSignedUrl,
  safeCall,
  uploadAndReplaceImages,
  uploadFileToMistral,
} from "../utils.js";
import path from "path";
import { ReferenceSheet } from "../models/ReferenceSheet.js";
import { generateStudentEvaluationFromExtractedTextMistral } from "../controllers/studentAnswerSheetController.js";
import { compareStudentAndReferenceAnswersheetJson } from "../controllers/comparingAnswerSheetController.js";

const studentReferenceSheetRouter = express.Router();

studentReferenceSheetRouter.post(
  "/parse-student-answer-sheet-and-save-details",
  async (req, res) => {
    const { studentSheetUrls, referenceSheetId, ...data } = req.body;
    const referenceSheet = await ReferenceSheet.findByPk(referenceSheetId);
    const referenceSheetConversionJson = referenceSheet.conversion_json;
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
          "Missing required parameters: studentSheetUrls/referenceSheetId/Test_date/Standard",
      });
    }
    try {
      for (let pdfUrl of studentSheetUrls) {
        const { Bucket, Key } = parseS3Url(pdfUrl);
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
        const ocrResponseForStudentSheet = await safeCall(
          "upload and replace images",
          () => uploadAndReplaceImages({ ocrResponse, prefix })
        );
        const [
          generatedStudentAnswersheetJson,
          costOfPreparingStudentAnswerSheetJson,
        ] = await safeCall("generate answer json and calculate marks", () =>
          generateStudentEvaluationFromExtractedTextMistral({
            ocrResponse: ocrResponseForStudentSheet,
            referenceAnswerSheet: referenceSheetConversionJson,
          })
        );
        if (generatedStudentAnswersheetJson.success) {
          const studentAnswerSheetToEvaluate =
            generatedStudentAnswersheetJson.data;
          //compare those two (studentanswersheet and referenceanswersheet)
          const [finalStudentEvaluation, costOfEvaluatingStudent] =
            await compareStudentAndReferenceAnswersheetJson({
              studentAnswerSheetJson: studentAnswerSheetToEvaluate,
              referenceAnswerSheetJson: referenceSheetConversionJson,
            });
        }
      }
    } catch (e) {
      console.log("Error in parse-student-answer-sheet-and-save-details", e);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);
