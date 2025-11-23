// src/pages/login/Login.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore'; // Importar el store de autenticación

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore(); // Traemos la función setUser

  const handleLoginGoogle = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulando la respuesta del login de Google (deberías reemplazar esto con la integración real)
    const user = {
      displayName: "John Doe",
      email: "john.doe@gmail.com",
      photoURL: "photo.com",
    };
    setUser(user); // Guardamos el usuario en el store
    navigate("/chat-and-video"); // Redirigir al chat y video después del login
  };

  return (
    <div className="container-page">
      <div>
        <h1>Iniciar Sesión</h1>
        <div>
          <button onClick={handleLoginGoogle}>
            <img src="icons/google-icon.svg" alt="Iniciar sesión con Google" width={24} height={24} />
            <span>Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
