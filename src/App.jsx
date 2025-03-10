import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const socket = io('http://localhost:3000');

function App() {
  const [roomId, setRoomId] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [error, setError] = useState('');
  
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteVideo = useRef(null);

  useEffect(() => {
    socket.on('viewer-joined', async (viewerId) => {
      try {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit('offer', { offer, roomId });
      } catch (err) {
        console.error('Error creating offer:', err);
        setError('Failed to create connection offer');
      }
    });

    socket.on('offer', async (offer) => {
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit('answer', { answer, roomId });
      } catch (err) {
        console.error('Error handling offer:', err);
        setError('Failed to handle connection offer');
      }
    });

    socket.on('answer', async (answer) => {
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Error handling answer:', err);
        setError('Failed to handle connection answer');
      }
    });

    socket.on('ice-candidate', async (candidate) => {
      try {
        if (candidate) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
        setError('Failed to establish peer connection');
      }
    });

    socket.on('host-disconnected', () => {
      setIsViewing(false);
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = null;
      }
      setError('Host has disconnected');
    });

    return () => {
      socket.off('viewer-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('host-disconnected');
    };
  }, [roomId]);

  const initializePeerConnection = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, roomId });
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };
  };

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      localStream.current = stream;
      
      const newRoomId = uuidv4();
      setRoomId(newRoomId);
      
      initializePeerConnection();
      
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      socket.emit('create-room', newRoomId);
      setIsSharing(true);
      setError('');

      // Handle stream stop
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error('Error starting screen share:', err);
      setError('Failed to start screen sharing');
    }
  };

  const stopSharing = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    setIsSharing(false);
    setRoomId('');
    setError('');
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    try {
      initializePeerConnection();
      socket.emit('join-room', roomId);
      setIsViewing(true);
      setError('');
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Screen Sharing App</h1>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {!isSharing && !isViewing && (
            <div className="space-y-4">
              <button
                onClick={startSharing}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Share My Screen
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              <form onSubmit={joinRoom} className="space-y-3">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter Room ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Join Room
                </button>
              </form>
            </div>
          )}

          {isSharing && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-md p-4">
                <p className="text-sm font-medium text-gray-700">Room ID:</p>
                <p className="mt-1 text-sm text-gray-900 break-all">{roomId}</p>
              </div>
              <button
                onClick={stopSharing}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Stop Sharing
              </button>
            </div>
          )}

          {isViewing && (
            <div className="space-y-4">
              <video
                ref={remoteVideo}
                autoPlay
                playsInline
                className="w-full rounded-lg shadow-lg"
              />
              <button
                onClick={() => {
                  setIsViewing(false);
                  if (peerConnection.current) {
                    peerConnection.current.close();
                  }
                  if (remoteVideo.current) {
                    remoteVideo.current.srcObject = null;
                  }
                }}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Leave Room
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;