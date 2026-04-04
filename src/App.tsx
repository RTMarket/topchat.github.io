import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import ChatRoom from './components/ChatRoom';
import PaidCreatePage from './components/PaidCreatePage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<ChatRoom />} />
          <Route path="/paid-create" element={<PaidCreatePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
