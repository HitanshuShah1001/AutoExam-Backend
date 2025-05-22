import s3 from "../s3.js";

export async function uploadAndReplaceImages({ ocrResponse, prefix }) {
    // The S3 bucket and prefix (folder) where images will be stored
    const bucketName = process.env.S3_BUCKET_NAME || "tutor-staffroom-files";

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
                const cleanedBase64 = imageObj.imageBase64.replace(/^data:image\/\w+;base64,/, "");
                const imageBuffer = Buffer.from(cleanedBase64, "base64");

                const s3Key = `${prefix}/page-${page.index}-image-${i}.jpeg`;
                await s3.putObject({
                    Bucket: bucketName,
                    Key: s3Key,
                    Body: imageBuffer,
                    ContentType: "image/jpeg",
                }).promise();

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