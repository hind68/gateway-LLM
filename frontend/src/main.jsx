import ReactDOM from 'react-dom/client'
import '@fontsource-variable/jetbrains-mono'
import App from './App.jsx'
import './styles/index.css'
import { AuthProvider } from './AuthProvider.jsx' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)
