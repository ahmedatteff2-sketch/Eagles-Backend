import { Route, Routes } from "react-router-dom";
import NavBar from "./components/navigation/Navbar";
import Home from "./Pages/Home";
import About from "./Pages/About";
import Schedule from "./Pages/Schedule";
import Pricing from "./Pages/Pricing";
import Classes from "./Pages/Classes";
import Protiens from "./Pages/Protiens";
import Footer from "./components/footer/Footer";
import ScrollToTop from "./components/ScrollToTop";
import "./index.css";

function App() {
  return (
    <div dir="rtl">
      <NavBar />
      <Routes>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="classes" element={<Classes />} />
        <Route path="protiens" element={<Protiens />} />
      </Routes>
      <Footer />
      <ScrollToTop />
    </div>
  );
}

export default App;
