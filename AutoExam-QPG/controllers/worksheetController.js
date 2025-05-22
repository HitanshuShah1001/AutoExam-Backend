import { generateHTML, uploadToS3 } from "../utils/generateQuestionPaper.util.js";
class WorksheetController {
  async createWorksheet(req, res) {
    const { student_data } = req.body;
    const renderedWorksheetHTML = generateHTML(
      student_data,
      "./templates/workSheetTemplate.mustache"
    );
    const worksheetHTMLURL = await uploadToS3(
      renderedWorksheetHTML,
      `${Date.now()}`,
      "html"
    );
    return res.status(200).json({
      success: true,
      message: "Worksheet html generated succesfully",
      worksheet_html: worksheetHTMLURL,
    });
  }
}

export const workSheetController = new WorksheetController();
