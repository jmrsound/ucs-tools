import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CategoryFinder } from "../../app/category-finder";
import "../../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("UCS Tagger root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <CategoryFinder />
  </StrictMode>,
);
