import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "./s3.js";

export async function generatePresignedUrl(
  fileUrlOrKey,
  expiresInSeconds = 600
) {
  // Extract Key if full URL was passed
  const key = fileUrlOrKey.includes("amazonaws.com")
    ? fileUrlOrKey.split(".amazonaws.com/")[1]
    : fileUrlOrKey;

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: expiresInSeconds,
  });

  return signedUrl;
}
