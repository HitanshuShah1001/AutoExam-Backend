import express from "express";
import dotenv from "dotenv";
import { sequelize } from "./src/connections/database.js";
import cors from "cors";
import router from "./src/routes/routes.js";
import "./src/models/ReferenceSheet.js";

dotenv.config();

const app = express();
const PORT = process.env.port || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Parse text bodies (for example, SNS notifications with text/plain)
app.use(express.text({ type: "text/*" }));
app.use("/", router);
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully.");

    await sequelize.sync();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

startServer();
