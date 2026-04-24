import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { API_ORIGIN } from "@/lib/api-config";

setBaseUrl(API_ORIGIN || null);

createRoot(document.getElementById("root")!).render(<App />);
