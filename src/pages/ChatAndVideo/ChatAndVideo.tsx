import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import useAuthStore from '../../stores/useAuthStore';
import './ChatAndVideo.css';

interface Message {
  userId: string;
  message: string;
  timestamp: string;
}

const ChatAndVideo: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);

  // Inicializar socket y stream local
  useEffect(() => {
    if (!roomId || !user) return;

    const newSocket = io('http://localhost:9000');
    setSocket(newSocket);

    // Obtener media local
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setConnectionStatus('connected');
      })
      .catch((err) => {
        console.error('Error al acceder a los dispositivos:', err);
        setConnectionStatus('error');
      });

    // Unirse a la sala
    newSocket.emit('join:room', roomId, user.email);

    // Listener para cuando la sala está lista
    newSocket.on('room:joined', ({ existingUsers }: { existingUsers: string[] }) => {
      console.log('Sala unida. Usuarios existentes:', existingUsers);
      
      // Si hay usuarios, iniciar conexión como iniciador
      if (existingUsers.length > 0) {
        initializePeerConnection(true, newSocket, existingUsers[0]);
      }
    });

    // Listener para nuevo usuario
    newSocket.on('user:joined', (userId: string) => {
      console.log('Nuevo usuario se unió:', userId);
      // El nuevo usuario será el iniciador
    });

    // Listener para señales WebRTC
    newSocket.on('signal', ({ from, signal }: { from: string; signal: any }) => {
      if (peerRef.current) {
        peerRef.current.signal(signal);
      } else {
        initializePeerConnection(false, newSocket, from, signal);
      }
    });

    // Listener para usuario que se va
    newSocket.on('user:left', (userId: string) => {
      console.log('Usuario se fue:', userId);
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      setRemoteStream(null);
    });

    // Listener para mensajes de chat
    newSocket.on('chat:message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      newSocket.emit('leave:room', roomId);
      newSocket.disconnect();
    };
  }, [roomId, user]);

  // Inicializar conexión peer
  const initializePeerConnection = (
    initiator: boolean, 
    socket: Socket, 
    targetUserId: string,
    initialSignal?: any
  ) => {
    if (!localStream) return;

    const peer = new SimplePeer({
      initiator,
      trickle: false,
      stream: localStream,
    });

    peer.on('signal', (signal) => {
      socket.emit('signal', {
        to: targetUserId,
        from: socket.id,
        signal,
        roomId
      });
    });

    peer.on('stream', (stream) => {
      console.log('Stream remoto recibido');
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    peer.on('error', (err) => {
      console.error('Error en peer:', err);
    });

    if (initialSignal) {
      peer.signal(initialSignal);
    }

    peerRef.current = peer;
  };

  // Enviar mensaje
  const sendMessage = () => {
    if (inputValue.trim() && socket && roomId) {
      socket.emit('chat:message', {
        roomId,
        userId: user?.displayName || 'Usuario',
        message: inputValue
      });
      setInputValue('');
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Salir de la sala
  const leaveRoom = () => {
    if (socket && roomId) {
      socket.emit('leave:room', roomId);
    }
    navigate('/profile');
  };

  // Copiar link de la sala
  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setShowCopyNotification(true);
      setTimeout(() => setShowCopyNotification(false), 2000);
    });
  };

  return (
    <div className="chat-video-container">
      {/* Sección de Video */}
      <div className="video-section">
        <div className="video-container">
          <div className="videos-grid">
            {/* Video Local */}
            <div className="video-wrapper local-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
              />
              <span className="video-label">Tú</span>
            </div>

            {/* Video Remoto */}
            {remoteStream ? (
              <div className="video-wrapper remote-video">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                />
                <span className="video-label">Participante</span>
              </div>
            ) : (
              <div className="video-wrapper waiting">
                <div className="waiting-content">
                  <div className="spinner"></div>
                  <p>Esperando a otro participante...</p>
                </div>
              </div>
            )}
          </div>

          {connectionStatus === 'error' && (
            <div className="video-error">
              <p>❌ Error al acceder a la cámara o micrófono</p>
              <p>Por favor, permite el acceso en la configuración de tu navegador</p>
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="video-controls">
          <button
            className={`control-button mute-button ${muted ? 'muted' : ''}`}
            onClick={toggleMute}
            disabled={connectionStatus !== 'connected'}
          >
            {muted ? '🔇' : '🎤'} {muted ? 'Activar' : 'Silenciar'}
          </button>

          <button
            className={`control-button video-button ${!videoEnabled ? 'disabled' : ''}`}
            onClick={toggleVideo}
            disabled={connectionStatus !== 'connected'}
          >
            {videoEnabled ? '📹' : '🚫'} {videoEnabled ? 'Cámara' : 'Sin cámara'}
          </button>

          <button
            className="control-button share-button"
            onClick={copyRoomLink}
          >
            🔗 Compartir Link
          </button>

          <button
            className="control-button leave-button"
            onClick={leaveRoom}
          >
            📞 Salir
          </button>
        </div>
      </div>

      {/* Sección de Chat */}
      <div className="chat-section">
        <div className="chat-header">
          <h3>Chat en Vivo</h3>
          <p>{messages.length} mensajes</p>
          <span className="room-id">Sala: {roomId}</span>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <p>No hay mensajes aún. ¡Escribe el primero!</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="message-item">
                <div className="message-header">
                  <span className="message-user">{msg.userId}</span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="message-text">{msg.message}</p>
              </div>
            ))
          )}
        </div>

        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <input
              className="chat-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Escribe un mensaje..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  sendMessage();
                }
              }}
            />
            <button
              className="send-button"
              onClick={sendMessage}
              disabled={!inputValue.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* Notificación de copia */}
      {showCopyNotification && (
        <div className="copy-notification">
          ✓ Link copiado al portapapeles
        </div>
      )}
    </div>
  );
};

export default ChatAndVideo;