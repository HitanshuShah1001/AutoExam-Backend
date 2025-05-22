import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export const s3 = new AWS.S3();

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
