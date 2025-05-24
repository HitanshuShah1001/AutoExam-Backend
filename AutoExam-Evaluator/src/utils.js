import { client } from "./config/mistral.js";
import { s3 } from "./config/s3.js";
import {
  DOLLAR_TO_INR_RATE,
  INPUT_PER_1M_COST,
  OUTPUT_PER_1M_COST,
} from "./constants.js";

export const uploadFileToMistral = async ({ Key, fileBuffer }) => {
  const file = await client.files.upload({
    file: {
      fileName: Key,
      content: fileBuffer,
    },
    purpose: "ocr",
  });
  return file;
};

export const getSignedUrl = async ({ uploadedFile }) => {
  const signedUrl = await client.files.getSignedUrl({
    fileId: uploadedFile.id,
  });
  return signedUrl;
};

export const convertToOCR = async ({ signedUrl }) => {
  const ocrString = await client.ocr.process({
    model: "mistral-ocr-latest",
    includeImageBase64: true,
    document: {
      type: "document_url",
      documentUrl: signedUrl.url, // The URL from Mistral’s file store
    },
  });
  return ocrString;
};

export async function uploadAndReplaceImages({ ocrResponse, prefix }) {
  // The S3 bucket and prefix (folder) where images will be stored
  const bucketName = process.env.S3_BUCKET_NAME || "autoexam-images-and-pdfs";

  // Safety check in case `ocrResponse.pages` is missing or not an array
  if (!ocrResponse || !Array.isArray(ocrResponse.pages)) {
    return ocrResponse; // nothing to do
  }

  for (const page of ocrResponse.pages) {
    if (!Array.isArray(page.images)) continue;

    for (let i = 0; i < page.images.length; i++) {
      const imageObj = page.images[i];
      if (!imageObj.imageBase64) continue;

      try {
        // Remove any data URL prefix
        const cleanedBase64 = imageObj.imageBase64.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const imageBuffer = Buffer.from(cleanedBase64, "base64");

        const s3Key = `${prefix}/page-${page.index}-image-${i}.jpeg`;
        await s3
          .putObject({
            Bucket: bucketName,
            Key: s3Key,
            Body: imageBuffer,
            ContentType: "image/jpeg",
          })
          .promise();

        delete imageObj.imageBase64;
        imageObj.imageUrl = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
      } catch (err) {
        console.error("Error uploading image to S3:", err);
        imageObj.imageUrl = null; // or handle as needed
      }
    }
  }

  // Return the modified response
  return ocrResponse;
}

export function safeCall(step, fn) {
  return fn().catch((err) => {
    console.error(`Error during ${step}:`, err);
    const error = new Error(`Failed to ${step}`);
    error.details = err.message;
    error.statusCode = 500;
    throw error;
  });
}

export function costOfOpenAiCall({ i_t, o_t }) {
  const ONE_MILLION = 1000000;
  const I_C = (i_t * INPUT_PER_1M_COST) / ONE_MILLION;
  const O_C = (o_t * OUTPUT_PER_1M_COST) / ONE_MILLION;
  const total_cost = (I_C + O_C).toFixed(2) * DOLLAR_TO_INR_RATE;
  return total_cost;
}

/**
 * Given an S3 URL like
 *   https://...amazonaws.com/answer_evaluations/HITANSHU_PATEL.pdf
 * returns "Hitanshu Patel"
 */
export function extractStudentNameFromUrl(url) {
  // 1) pull off everything after the last slash
  const filename = url.substring(url.lastIndexOf("/") + 1);
  // 2) strip the extension
  const [namePart] = filename.split(".");
  // 3) split on underscore, lowercase+capitalize each
  return namePart
    .split("_")
    .map((word) => word.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
    .join(" ");
}
