export function parseMetadataFromUrl(url) {
    try {
        if (!url) {
            return;
        }
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const parts = pathname.split("/");
        const filename = parts[parts.length - 1];
        const baseName = filename.replace(/\.pdf$/i, "");
        const segments = baseName.split("_");
        if (segments.length < 6) {
            throw new Error("Filename does not have enough segments to extract metadata");
        }
        const [grade, subject, examName, examYear, examMonth, part] = segments;
        return { grade, subject, examName, examYear, examMonth, part };
    } catch (error) {
        console.error("Error parsing metadata from URL:", url, error);
        return null;
    }
};


export function parseGCSUrl(url) {
    if (!url) throw new Error("URL cannot be empty.");

    try {
        const urlObj = new URL(url);

        // Ensure it's a valid Google Cloud Storage URL
        if (!urlObj.hostname.includes("storage.cloud.google.com")) {
            throw new Error("Invalid GCS URL format.");
        }

        // Extract path components
        const parts = urlObj.pathname.split("/").filter(Boolean);
        if (parts.length < 2) throw new Error("Invalid GCS URL format.");

        const bucket = parts[0]; // Extract bucket name
        const objectName = parts.slice(1).join("/"); // Full object path
        const fileName = parts[parts.length - 1]; // Extract file name

        // Extract directory by removing the file name
        const directory = parts.length > 2 ? parts.slice(1, -1).join("/") + "/" : "";

        return { bucket, fileName, directory, objectName };
    } catch (error) {
        console.error("Error parsing GCS URL:", error.message);
        throw error;
    }
}

export function parseGCSDirectoryUrl(url) {
    if (!url) throw new Error("URL cannot be empty.");

    try {
        const urlObj = new URL(url);

        // Ensure it's a valid Google Cloud Storage URL
        if (!urlObj.hostname.includes("storage.cloud.google.com")) {
            throw new Error("Invalid GCS URL format.");
        }

        // Extract path components
        const parts = urlObj.pathname.split("/").filter(Boolean);
        if (parts.length < 1) throw new Error("Invalid GCS URL format.");

        const bucket = parts[0]; // Extract bucket name
        const directory = parts.length > 1 ? parts.slice(1).join("/") + "/" : ""; // Extract directory path

        return { bucket, directory };
    } catch (error) {
        console.error("Error parsing GCS directory URL:", error.message);
        throw error;
    }
}

