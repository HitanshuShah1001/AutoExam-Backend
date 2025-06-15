// controllers/StudentController.js
import { Student } from "../models/student_insight_costs.js";
import { htmlUrlToPdf } from "../utils/downloadWorksheetfromlink.js";

class StudentController {
  /**
   * @route   POST /students
   * @desc    Create a new student record or update existing one
   * @body    { studentName, schoolName, standard, worksheet_s3_link, cost }
   */
  async createStudent(req, res) {
    let {
      studentName,
      schoolName,
      standard,
      worksheet_s3_link,
      cost,
      currentTestData = [],
    } = req.body;
    standard = String(standard);
    cost = Math.ceil(cost);
    try {
      // 1. Try to find existing by studentName + standard
      const existing = await Student.findOne({
        where: { studentName, standard },
      });

      const existingData = existing.prevTests ?? [];
      const newTestData = [...existingData, ...currentTestData];
      if (existing) {
        // 2a. Update and return 200
        await existing.update({
          schoolName,
          worksheet_s3_link,
          cost,
          prevTests: newTestData,
        });
        return res.status(200).json({
          success: true,
          message: "Student record updated successfully",
          data: existing,
        });
      }

      // 2b. Not found → create new and return 201
      const newStudent = await Student.create({
        studentName,
        schoolName,
        standard,
        worksheet_s3_link,
        cost,
        prevTests: newTestData,
      });

      return res.status(201).json({
        success: true,
        message: "Student record created successfully",
        data: newStudent,
      });
    } catch (error) {
      console.error("Error saving student record:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to save student record",
        error: error.message,
      });
    }
  }
  async getStudentPreviousMarks(req, res) {
    try {
      const { studentName, schoolName, standard } = req.body;
      if (!studentName || !school) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameters: studentName and school",
        });
      }
      const student = await Student.findOne({
        where: { studentName, schoolName, standard },
      });
      if (!student) {
        return res.status(200).json({
          studentData: [],
          success: true,
        });
      } else {
        return res.status(200).json({
          studentData: student.prevTests,
          success: true,
        });
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        success: false,
        error: e,
      });
    }
  }
  async downloadWorksheetFromPdf(req, res) {
    try {
      const { s3Link, pathToSave } = req.body;

      console.log("=== Controller Debug ===");
      console.log("Received s3Link:", s3Link);
      console.log("Received pathToSave:", pathToSave);

      // Validate inputs
      if (!s3Link || !pathToSave) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameters: s3Link and pathToSave",
        });
      }

      const response = await htmlUrlToPdf({
        htmlUrl: s3Link,
        savePath: pathToSave,
      });

      console.log("PDF generation response:", response);

      if (response.success === true) {
        return res.status(201).json({
          path: response.savedPath,
          success: true,
          fileSize: response.fileSize,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: response.error,
          message: "PDF generation failed",
        });
      }
    } catch (e) {
      console.error("Error in downloadWorksheetFromPdf controller:", e);
      return res.status(500).json({
        success: false,
        message: "Failed to download worksheet from PDF",
        error: e.message,
      });
    }
  }
}

export const studentController = new StudentController();
