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
    let { studentName, schoolName, standard, worksheet_s3_link, cost } =
      req.body;
    standard = String(standard);
    cost = Math.ceil(cost);
    try {
      // 1. Try to find existing by studentName + standard
      const existing = await Student.findOne({
        where: { studentName, standard },
      });

      if (existing) {
        // 2a. Update and return 200
        await existing.update({ schoolName, worksheet_s3_link, cost });
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

  async downloadWorksheetFromPdf(req, res) {
    const { s3Link, pathToSave } = req.body;
    const response = await htmlUrlToPdf({
      htmlUrl: s3Link,
      savePath: pathToSave,
    });
    if (response.success == true) {
      return res.status(201).json({
        path: response.savedPath,
        success: true,
      });
    } else {
      return res.status(400).json({
        success: false,
      });
    }
  }
}

export const studentController = new StudentController();
