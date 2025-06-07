import express from "express";
import s3 from "../utils/s3.js";

const preSignedRouter = express.Router();

preSignedRouter.post("/generate-presigned-url", async (req, res) => {
  const { fileName, fileType, bucket } = req.body;
  const key = `${Date.now()}-${fileName}`;
  const params = {
    Bucket: bucket ?? "autoexam-staffroom-files",
    Key: key,
    Expires: 120,
    ContentType: fileType,
  };
  try {
    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
    return res.json({ uploadUrl, key });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not generate upload URL" });
  }
});

export { preSignedRouter };
