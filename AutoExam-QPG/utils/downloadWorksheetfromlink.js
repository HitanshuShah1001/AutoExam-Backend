// htmlToPdf.js
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

/**
 * Fetches an HTML document from a URL, renders it in headless Chromium,
 * and saves the result as a PDF.
 *
 * @param {string} htmlUrl  - The URL of your HTML file (e.g. a presigned S3 link).
 * @param {string} savePath - Local file path where you want to save the PDF.
 * @returns {Promise<string>}  Resolves with the savePath once complete.
 */
export async function htmlUrlToPdf({ htmlUrl, savePath }) {
  console.log("=== PDF Generation Debug ===");
  console.log("HTML URL:", htmlUrl);
  console.log("Save Path:", savePath);

  let browser;

  try {
    // 1. Fetch the HTML with better error handling
    console.log("Step 1: Fetching HTML content...");
    const resp = await fetch(htmlUrl);
    console.log("Fetch response status:", resp.status);
    console.log("Fetch response ok:", resp.ok);

    if (!resp.ok) {
      throw new Error(
        `Failed to fetch HTML (${resp.status}): ${resp.statusText}`
      );
    }

    const html = await resp.text();
    console.log("HTML content length:", html.length);
    console.log("HTML preview (first 200 chars):", html.substring(0, 200));

    // 2. Ensure the output directory exists
    console.log("Step 2: Creating output directory...");
    const outDir = path.dirname(savePath);
    console.log("Output directory:", outDir);

    // Check if directory exists before creating
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
      console.log("Directory created successfully");
    } else {
      console.log("Directory already exists");
    }

    // Verify directory was created and is writable
    try {
      fs.accessSync(outDir, fs.constants.W_OK);
      console.log("Directory is writable");
    } catch (err) {
      console.error("Directory is not writable:", err.message);
      throw new Error(`Cannot write to directory: ${outDir}`);
    }

    // 3. Launch Puppeteer with enhanced configuration
    console.log("Step 3: Launching Puppeteer...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // Use only if you have memory constraints
      ],
    });
    console.log("Puppeteer launched successfully");

    const page = await browser.newPage();
    console.log("New page created");

    // Set longer timeout for network operations
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);

    // Load the HTML content
    console.log("Step 4: Loading HTML content...");
    await page.setContent(html, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 60000,
    });
    console.log("HTML content loaded successfully");

    // Wait for any potential MathJax rendering
    console.log("Step 5: Waiting for potential MathJax rendering...");
    try {
      await page.waitForFunction(
        () =>
          window.MathJax &&
          window.MathJax.startup &&
          window.MathJax.startup.document.state() >= 10,
        { timeout: 10000 }
      );
      console.log("MathJax rendered successfully");
    } catch (mathJaxError) {
      console.log("MathJax not found or timeout - continuing anyway");
    }

    // Additional wait to ensure everything is rendered

    // Check if the page content is actually loaded
    const bodyContent = await page.evaluate(
      () => document.body.innerHTML.length
    );
    console.log("Body content length:", bodyContent);

    if (bodyContent === 0) {
      throw new Error(
        "Page content is empty - HTML might not have loaded properly"
      );
    }

    // 6. Generate PDF with enhanced options
    console.log("Step 6: Generating PDF...");
    console.log("PDF will be saved to:", savePath);

    await page.pdf({
      path: savePath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
    });

    console.log("PDF generation completed");

    // 7. Verify the file was actually created
    if (fs.existsSync(savePath)) {
      const stats = fs.statSync(savePath);
      console.log("PDF file created successfully");
      console.log("File size:", stats.size, "bytes");

      if (stats.size === 0) {
        throw new Error("PDF file was created but is empty");
      }

      return { success: true, savedPath: savePath, fileSize: stats.size };
    } else {
      throw new Error(
        "PDF file was not created - file does not exist after generation"
      );
    }
  } catch (error) {
    console.error("Error in PDF generation:", error.message);
    console.error("Error stack:", error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  } finally {
    // Ensure browser is always closed
    if (browser) {
      try {
        await browser.close();
        console.log("Browser closed successfully");
      } catch (closeError) {
        console.error("Error closing browser:", closeError.message);
      }
    }
  }
}
