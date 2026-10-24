import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMetaPixel } from "./lib/metaPixel";

initMetaPixel(import.meta.env.VITE_META_PIXEL_ID);

createRoot(document.getElementById("root")!).render(<App />);
