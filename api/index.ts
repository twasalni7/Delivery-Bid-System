// Vercel serverless function entry point — exports the Express app without calling listen()
import app from "../artifacts/api-server/src/app.js";
export default app;
