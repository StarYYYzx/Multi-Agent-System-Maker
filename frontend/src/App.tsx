/* 应用主入口 - 路由配置 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import BlueprintListPage from "./pages/BlueprintListPage";
import EditorPage from "./pages/EditorPage";
import ExecutePage from "./pages/ExecutePage";
import LogDetailPage from "./pages/LogDetailPage";
import SettingsPage from "./pages/SettingsPage";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BlueprintListPage />} />
        <Route path="/editor/:id" element={<EditorPage />} />
        <Route path="/execute/:id" element={<ExecutePage />} />
        <Route path="/logs/:logId" element={<LogDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
