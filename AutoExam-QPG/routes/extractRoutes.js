// extractRoutes.js

import express from "express";
import AWS from "aws-sdk";
import { Job } from "../models/job.js";
import s3 from "../utils/s3.js";
import { parseMetadataFromUrl } from "../utils/extract/parseS3Urls.util.js";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";
import { Mistral } from "@mistralai/mistralai";
import { uploadAndReplaceImages } from "../utils/extract/imageBase64ToS3.util.js";
import path from "path";
import { questionPaperController } from "../controllers/paperController.js";

export const textract = new AWS.Textract({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export const documentAiClient = new DocumentProcessorServiceClient();
// Initialize GCS client
export const storage = new Storage();

const extractRouter = express.Router();

extractRouter.post("/pdf/batch", async (req, res) => {
  try {
    const { pdfUrls } = req.body;
    if (!pdfUrls || !Array.isArray(pdfUrls) || pdfUrls.length === 0) {
      return res
        .status(400)
        .json({ message: "pdfUrls is required and must be a non-empty array" });
    }

    const jobPromises = pdfUrls.map(async (pdfUrl) => {
      try {
        // Extract metadata from the URL.
        const metadata = parseMetadataFromUrl(pdfUrl);
        if (!metadata) {
          throw new Error("Failed to parse metadata from URL");
        }

        // Create a new job record in the DB with status "inProcess"
        const newJob = await Job.create({
          inputUrl: pdfUrl,
          status: "inProcess",
          jobType: "awsTextExtraction",
          metadata, // save the parsed metadata
        });

        // Assume parseS3Url is a helper that returns { Bucket, Key }
        const { Bucket, Key } = parseS3Url(pdfUrl);

        const startParams = {
          DocumentLocation: {
            S3Object: {
              Bucket,
              Name: Key,
            },
          },
          // Setup SNS notifications on job completion
          NotificationChannel: {
            RoleArn: process.env.TEXTRACT_SNS_ROLE_ARN,
            SNSTopicArn: process.env.TEXTRACT_SNS_TOPIC_ARN,
          },
        };

        // Wrap the callback-based Textract call in a Promise.
        const result = await new Promise((resolve, reject) => {
          textract.startDocumentTextDetection(
            startParams,
            async (err, data) => {
              if (err) {
                console.error(`Textract error for ${pdfUrl}:`, err);
                // Update job status as failed
                await newJob.update({ status: "failed" });
                return reject(err);
              }
              // Update the job with the AWS job ID and keep status "inProcess"
              await newJob.update({ awsJobId: data.JobId });
              resolve({
                pdfUrl,
                jobId: newJob.id,
                awsJobId: data.JobId,
                status: "inProcess",
                metadata, // include parsed metadata in the response
              });
            }
          );
        });

        return result;
      } catch (jobError) {
        console.error(`Error processing ${pdfUrl}:`, jobError);
        return { pdfUrl, error: jobError.message, status: "failed" };
      }
    });

    // Wait for all job promises to settle.
    const settledResults = await Promise.allSettled(jobPromises);
    const jobResults = settledResults.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { status: "failed", error: result.reason?.message || result.reason }
    );

    return res.status(200).json({
      message: "Batch extraction jobs processed",
      jobs: jobResults,
    });
  } catch (error) {
    console.error("Error creating batch extraction jobs:", error);
    return res.status(500).json({
      message: "Error creating batch extraction jobs",
      error: error.message,
    });
  }
});

// 2) GET /extract/pdf/:jobId: Returns the job status and text URL (if done)
extractRouter.get("/pdf/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // If the job is already completed, we can just return
    if (job.status === "completed" || job.status === "failed") {
      return res.json({
        id: job.id,
        status: job.status,
        pdfUrl: job.inputUrl,
        outputUrl: job.outputUrl,
      });
    }

    // Otherwise, we do getDocumentTextDetection calls
    let allBlocks = [];
    let nextToken = null;
    let params = { JobId: job.awsJobId };

    const initialData = await textract
      .getDocumentTextDetection(params)
      .promise();
    if (initialData.Blocks) {
      allBlocks.push(...initialData.Blocks);
    }
    nextToken = initialData.NextToken;

    // Keep fetching until NextToken is empty
    while (nextToken) {
      params.NextToken = nextToken;
      const nextData = await textract
        .getDocumentTextDetection(params)
        .promise();
      if (nextData.Blocks) {
        allBlocks.push(...nextData.Blocks);
      }
      nextToken = nextData.NextToken;
    }

    // Check final JobStatus
    const finalStatus = initialData.JobStatus;
    if (finalStatus === "SUCCEEDED") {
      // Combine text
      let extractedText = allBlocks
        .filter((block) => block.BlockType === "LINE")
        .map((block) => block.Text)
        .join("\n");

      // Upload to S3
      const textFileKey = `extractions/${job.id}-${Date.now()}.txt`;
      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: textFileKey,
        Body: extractedText,
        ContentType: "text/plain",
      };
      const uploadResult = await s3.upload(uploadParams).promise();
      const textFileUrl = uploadResult.Location;

      // Update job record
      await job.update({
        status: "completed",
        outputUrl: textFileUrl,
      });

      return res.json({
        id: job.id,
        status: job.status,
        pdfUrl: job.inputUrl,
        outputUrl: job.outputUrl,
      });
    } else if (finalStatus === "FAILED") {
      await job.update({ status: "failed" });
      return res.json({
        id: job.id,
        status: job.status,
        pdfUrl: job.inputUrl,
        outputUrl: job.outputUrl,
      });
    } else {
      // Possibly IN_PROGRESS or partial
      return res.json({
        id: job.id,
        status: job.status,
        pdfUrl: job.inputUrl,
        outputUrl: job.outputUrl,
      });
    }
  } catch (error) {
    console.error("Error fetching extraction job:", error);
    return res
      .status(500)
      .json({ message: "Error fetching extraction job", error: error.message });
  }
});

extractRouter.post("/pdf-mistral", async (req, res) => {
  try {
    const { pdfUrl, metadata } = req.body;
    if (!pdfUrl) {
      return res.status(400).json({ message: "pdfUrl is required" });
    }

    // 1. Download the PDF from S3 (if not publicly accessible)
    const { Bucket, Key } = parseS3Url(pdfUrl);
    const s3Object = await s3.getObject({ Bucket, Key }).promise();
    const fileBuffer = s3Object.Body; // PDF file data as a Buffer

    // 2. Create a Mistral client instance with your API key
    const apiKey = process.env.MISTRAL_API_KEY; // e.g. "dfasdasdfafdsadsfadfs"
    const client = new Mistral({ apiKey });

    // 3. Upload the PDF file to Mistral’s file store
    const uploadedFile = await client.files.upload({
      file: {
        fileName: Key, // or any filename you like
        content: fileBuffer,
      },
      purpose: "ocr",
    });

    // 4. Get a signed URL from Mistral
    const signedUrl = await client.files.getSignedUrl({
      fileId: uploadedFile.id,
    });

    // 5. Perform the OCR by passing the signed URL
    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      includeImageBase64: true,
      document: {
        type: "document_url",
        documentUrl: signedUrl.url, // The URL from Mistral’s file store
      },
    });

    const { name: prefix } = path.parse(Key);
    const updatedResponse = await uploadAndReplaceImages({
      ocrResponse,
      prefix,
    });

    await questionPaperController.generateQuestionPaperFromExtractedTextMistral(
      { ocrResponse, prefix }
    );

    // 6. Respond to the caller
    return res.json({
      message: "OCR extraction completed successfully",
      metadata,
      ocrResponse: updatedResponse,
    });
  } catch (error) {
    console.error("Error during OCR extraction:", error);
    return res.status(500).json({
      message: "Error during OCR extraction",
      error: error.message,
    });
  }
});

extractRouter.post("/pdf-mistral-batch", async (req, res) => {
  try {
    const { pdfUrls, metadata } = req.body;

    // Validate pdfUrls
    if (!Array.isArray(pdfUrls) || pdfUrls.length === 0) {
      return res.status(400).json({
        message: "pdfUrls is required and must be a non-empty array",
      });
    }

    // Respond immediately so the client knows the batch process started
    res.json({
      message: "Batch started",
      pdfCount: pdfUrls.length,
    });

    // Then process each PDF in sequence (so we can sleep after each).
    for (const pdfUrl of pdfUrls) {
      try {
        console.log(`Processing PDF: ${pdfUrl}`);

        // 1. Download the PDF from S3 (if not publicly accessible)
        const { Bucket, Key } = parseS3Url(pdfUrl);
        const s3Object = await s3.getObject({ Bucket, Key }).promise();
        const fileBuffer = s3Object.Body; // PDF file data as a Buffer

        // 2. Create a Mistral client instance with your API key
        const apiKey = process.env.MISTRAL_API_KEY;
        const client = new Mistral({ apiKey });

        // 3. Upload the PDF file to Mistral’s file store
        const uploadedFile = await client.files.upload({
          file: {
            fileName: Key,
            content: fileBuffer,
          },
          purpose: "ocr",
        });

        // 4. Get a signed URL from Mistral
        const signedUrl = await client.files.getSignedUrl({
          fileId: uploadedFile.id,
        });

        // 5. Perform the OCR by passing the signed URL
        const ocrResponse = await client.ocr.process({
          model: "mistral-ocr-latest",
          includeImageBase64: true,
          document: {
            type: "document_url",
            documentUrl: signedUrl.url,
          },
        });

        // 6. Upload images to S3 & replace base64 with S3 URLs
        const { name: prefix } = path.parse(Key);
        const updatedOcrResponse = await uploadAndReplaceImages({
          ocrResponse,
          prefix,
        });

        // 7. **Write updatedOcrResponse to S3** so we can skip re-upload if OpenAI fails
        const resultsBucket = process.env.S3_BUCKET_NAME;
        const s3Key = `mistralExtractions/${prefix}`;
        await s3
          .putObject({
            Bucket: resultsBucket,
            Key: s3Key,
            Body: JSON.stringify(updatedOcrResponse),
            ContentType: "application/json",
          })
          .promise();

        // 8. Now generate question paper from the extracted text
        await questionPaperController.generateQuestionPaperFromExtractedTextMistral(
          {
            ocrResponse: updatedOcrResponse,
            prefix,
          }
        );

        console.log(`Successfully processed PDF: ${pdfUrl}`);

        // 9. Sleep for 2 minutes before processing the next PDF
        console.log("Sleeping for 2 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 120000)); // 120000 ms = 2 minutes
      } catch (err) {
        // Catch errors for this PDF, log them, and continue to next
        console.error(`Error processing PDF: ${pdfUrl}`, err);
      }
    }

    console.log("All PDFs in the batch have been processed (or attempted).");
  } catch (error) {
    console.error("Error in /pdf-mistral-batch route:", error);
  }
});

extractRouter.post("/pdf-mistral-from-image", async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        message: "pdfUrls is required and must be a non-empty array",
      });
    }
    const { Bucket, Key } = parseS3UrlForTextExtract(imageUrl);
    const s3Object = await s3.getObject({ Bucket, Key }).promise();
    const fileBuffer = s3Object.Body;
    const apikey = process.env.MISTRAL_API_KEY;
    const client = new Mistral({ apikey });
    const uploadedFile = await client.files.upload({
      file: {
        fileName: `image-${Date.now()}`,
        content: fileBuffer,
      },
      purpose: "ocr",
    });
    const signedUrl = await client.files.getSignedUrl({
      fileId: uploadedFile.id,
    });
    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      includeImageBase64: true,
      document: {
        type: "image_url",
        imageUrl: signedUrl.url,
      },
    });
    const { name: prefix } = path.parse(Key);
    const updatedOcrResponse = await uploadAndReplaceImages({
      ocrResponse,
      prefix,
    });
    const questionsGenerated =
      await questionPaperController.generateQuestionFromExtractedTextMistral({
        ocrResponse: updatedOcrResponse,
        prefix,
      });
    if (questionsGenerated.success == false) {
      return res.status(400).json({
        success: false,
        message: "Some error occured",
      });
    }
    return res.status(200).json({
      success: true,
      questions: questionsGenerated,
    });
  } catch (e) {
    console.log(e, "error");
    return res.status(500).json({
      success: false,
      message: `Some error occured ${JSON.stringify(e)}`,
    });
  }
});

extractRouter.post(
  "/pdf-mistral-batch-exercise-questions",
  async (req, res) => {
    try {
      const { pdfUrls } = req.body;

      // Validate pdfUrls
      if (!Array.isArray(pdfUrls) || pdfUrls.length === 0) {
        return res.status(400).json({
          message: "pdfUrls is required and must be a non-empty array",
        });
      }

      // Respond immediately so the client knows the batch process started
      res.json({
        message: "Batch started",
        pdfCount: pdfUrls.length,
      });

      // Then process each PDF in sequence (so we can sleep after each).
      for (const pdfUrl of pdfUrls) {
        try {
          console.log(`Processing PDF: ${pdfUrl}`);

          // 1. Download the PDF from S3 (if not publicly accessible)
          const { Bucket, Key } = parseS3Url(pdfUrl);
          const s3Object = await s3.getObject({ Bucket, Key }).promise();
          const fileBuffer = s3Object.Body; // PDF file data as a Buffer
          // 2. Create a Mistral client instance with your API key
          const apiKey = process.env.MISTRAL_API_KEY;
          const client = new Mistral({ apiKey });

          // 3. Upload the PDF file to Mistral’s file store
          const uploadedFile = await client.files.upload({
            file: {
              fileName: Key,
              content: fileBuffer,
            },
            purpose: "ocr",
          });

          // 4. Get a signed URL from Mistral
          const signedUrl = await client.files.getSignedUrl({
            fileId: uploadedFile.id,
          });

          // 5. Perform the OCR by passing the signed URL
          const ocrResponse = await client.ocr.process({
            model: "mistral-ocr-latest",
            includeImageBase64: true,
            document: {
              type: "document_url",
              documentUrl: signedUrl.url,
            },
          });

          // 6. Upload images to S3 & replace base64 with S3 URLs
          const { name: prefix } = path.parse(Key);
          const updatedOcrResponse = await uploadAndReplaceImages({
            ocrResponse,
            prefix,
          });

          // 7. **Write updatedOcrResponse to S3** so we can skip re-upload if OpenAI fails
          const resultsBucket = process.env.S3_BUCKET_NAME;
          const s3Key = `mistralExtractions/${prefix}`;
          await s3
            .putObject({
              Bucket: resultsBucket,
              Key: s3Key,
              Body: JSON.stringify(updatedOcrResponse),
              ContentType: "application/json",
            })
            .promise();

          // 8. Now generate question paper from the extracted text
          await questionPaperController.generateExerciseQuestionsFromExtractedTextMistral(
            {
              ocrResponse: updatedOcrResponse,
              prefix,
            }
          );

          console.log(`Successfully processed PDF: ${pdfUrl}`);

          // 9. Sleep for 2 minutes before processing the next PDF
          console.log("Sleeping for 2 minutes...");
          await new Promise((resolve) => setTimeout(resolve, 120000)); // 120000 ms = 2 minutes
        } catch (err) {
          // Catch errors for this PDF, log them, and continue to next
          console.error(`Error processing PDF: ${pdfUrl}`, err);
        }
      }

      console.log("All PDFs in the batch have been processed (or attempted).");
    } catch (error) {
      console.error("Error in /pdf-mistral-batch route:", error);
    }
  }
);

export function parseS3Url(s3Url) {
  let Bucket, Key;

  if (s3Url.startsWith("s3://")) {
    const withoutPrefix = s3Url.replace("s3://", "");
    const [bucket, ...rest] = withoutPrefix.split("/");
    Bucket = bucket;
    Key = rest.join("/");
  } else if (s3Url.startsWith("https://")) {
    const match = s3Url.match(
      /^https:\/\/([^.]+)\.s3\.([^.]*)\.amazonaws\.com\/(.+)$/
    );
    if (match) {
      Bucket = match[1];
      Key = match[3];
    }
  }

  return { Bucket, Key };
}

export function parseS3UrlForTextExtract(s3Url) {
  let Bucket, Key;

  if (s3Url.startsWith("s3://")) {
    const withoutPrefix = s3Url.replace("s3://", "");
    const [bucket, ...rest] = withoutPrefix.split("/");
    Bucket = bucket;
    Key = rest.join("/");
  } else if (s3Url.startsWith("https://")) {
    const match = s3Url.match(
      /^https:\/\/([^.]+)\.s3(?:\.[^.]*)?\.amazonaws\.com\/(.+)$/
    );
    if (match) {
      Bucket = match[1];
      Key = match[2];
    }
  }

  return { Bucket, Key };
}

export { extractRouter };
