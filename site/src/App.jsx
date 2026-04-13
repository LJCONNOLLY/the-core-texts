import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Settings from './components/Settings';
import Library from './components/Library';
import BookProfile from './components/BookProfile';
import Search from './components/Search';
import Glossary from './components/Glossary';
import ConversationMap from './components/ConversationMap';
import FlashCards from './components/FlashCards';
import FrameworkTracker from './components/FrameworkTracker';
import TextsTechnology from './components/TextsTechnology';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <HashRouter>
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Routes>
        <Route path="/" element={<Layout onSettingsOpen={() => setSettingsOpen(true)} />}>
          <Route index element={<Library />} />
          <Route path="search" element={<Search />} />
          <Route path="glossary" element={<Glossary />} />
          <Route path="map" element={<ConversationMap />} />
          <Route path="book/:id" element={<BookProfile />} />
          <Route path="flashcards" element={<FlashCards />} />
          <Route path="frameworks" element={<FrameworkTracker />} />
          <Route path="definitions" element={<TextsTechnology />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
