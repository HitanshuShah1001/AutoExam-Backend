import express from "express";
import { parseS3Url, s3 } from "../config/s3.js";
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
      const { Bucket, Key } = parseS3Url(referenceSheetLink);

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

export { referenceSheetRouter };
