import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LibraryView } from "./views/LibraryView";
import { ReaderView } from "./views/ReaderView";
import { ReaderSettingsProvider } from "./contexts/ReaderSettingsContext";

export default function App() {
  return (
    <BrowserRouter>
      <ReaderSettingsProvider>
        <Routes>
          <Route path="/" element={<LibraryView />} />
          <Route path="/books/:bookId" element={<ReaderView />} />
        </Routes>
      </ReaderSettingsProvider>
    </BrowserRouter>
  );
}
