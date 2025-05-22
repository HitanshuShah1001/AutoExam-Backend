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
  console.log(htmlUrl,"htmlulr")
  // 1. Fetch the HTML
  const resp = await fetch(htmlUrl);
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch HTML (${resp.status}): ${resp.statusText}`
    );
  }
  const html = await resp.text();

  // 2. Ensure the output directory exists
  const outDir = path.dirname(savePath);
  fs.mkdirSync(outDir, { recursive: true });

  // 3. Launch Puppeteer, render & save PDF
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    // load the HTML (you can also use page.goto if it has assets)
    await page.setContent(html, { waitUntil: "networkidle0" });

    // adjust margins, format, etc. as needed:
    await page.pdf({
      path: savePath,
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return { success: true, savedPath: savePath };
  } catch (e) {
    console.log("e",e)
    return { success: false };
  } finally {
    await browser.close();
  }
}