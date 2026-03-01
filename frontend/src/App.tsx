import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LibraryView } from "./views/LibraryView";
import { ReaderView } from "./views/ReaderView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LibraryView />} />
        <Route path="/books/:bookId" element={<ReaderView />} />
      </Routes>
    </BrowserRouter>
  );
}
