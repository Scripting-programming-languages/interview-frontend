import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SelectRole from './pages/SelectRole';
import Interview from './pages/Interview';
import Results from './pages/Results';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-bg" />
      <div className="App">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/select" element={<SelectRole />} />
          <Route path="/interview/:courseId" element={<Interview />} />
          <Route path="/results/:attemptId" element={<Results />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;