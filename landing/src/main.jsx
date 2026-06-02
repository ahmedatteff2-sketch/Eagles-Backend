import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { HashRouter } from "react-router-dom";
import { LandingContentProvider } from "./content/LandingContentContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LandingContentProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </LandingContentProvider>
  </React.StrictMode>,
);
