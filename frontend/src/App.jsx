import { Routes, Route } from "react-router-dom";
import Pad from "./pages/Pad";
import Home from "./pages/Home";
import { ThemeProvider } from "./context/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:id" element={<Pad />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
