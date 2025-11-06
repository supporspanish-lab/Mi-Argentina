        import { onSessionStateChanged, onUserProfileUpdate, logout, updateUserProfile } from '../auth.js';
        // --- NUEVO: Importar Firebase para matchmaking ---
        import { db, auth, getDoc } from '../auth.js';
        import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, deleteDoc, arrayUnion, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";


        // --- NUEVO: Elementos del botón de música y lógica de audio de fondo ---
        const muteMusicBtn = document.getElementById('mute-music-btn');
        const muteIcon = document.getElementById('mute-icon');
        const unmuteIcon = document.getElementById('unmute-icon');
        
        // --- NUEVO: Seleccionar una pista de música de fondo aleatoria ---
        const backgroundMusicTracks = [
            '../audio/home/1.mp3',
            '../audio/home/2.mp3',
            '../audio/home/3.mp3',
            '../audio/home/4.mp3'
        ];
        const randomTrack = backgroundMusicTracks[Math.floor(Math.random() * backgroundMusicTracks.length)];
        const backgroundAudio = new Audio(randomTrack);
        backgroundAudio.loop = true;
        backgroundAudio.volume = 0.6;

        // Intentar reproducir la música automáticamente al cargar la página
        // Esto puede ser bloqueado por las políticas de autoplay de los navegadores
        // Se reproducirá cuando el usuario interactúe con la página (ej. clic en el botón de mute)
        window.addEventListener('load', () => {
            backgroundAudio.play().catch(error => {
                console.warn("Autoplay de música de fondo bloqueado:", error);
            });
        });

        muteMusicBtn.addEventListener('click', () => {
            if (backgroundAudio.muted) {
                backgroundAudio.muted = false;
                backgroundAudio.play().catch(error => {
                    console.warn("Error al reproducir música después de desmutear:", error);
                });
                muteIcon.style.display = 'block';
                unmuteIcon.style.display = 'none';
            } else {
                backgroundAudio.muted = true;
                muteIcon.style.display = 'none';
                unmuteIcon.style.display = 'block';
            }
        });

        const userDisplayName = document.getElementById('user-display-name');
        const userBalanceSpan = document.querySelector('.user-balance span');
        const logoutBtn = document.getElementById('menu-logout-btn');
        const menuToggleBtn = document.getElementById('menu-toggle-btn');
        const userMenu = document.getElementById('user-menu');
        const configureUiBtn = document.getElementById('configure-ui-btn');
        const matchLoadingOverlay = document.getElementById('match-loading-overlay');
        const matchLoadingText = document.getElementById('match-loading-text');

        const root = document.getElementById('root');
        const gameContainer = document.getElementById('game-container');
        const gameIframe = document.getElementById('game-iframe');

        const player1ChatName = document.getElementById('player1-chat-name');
        const player2ChatName = document.getElementById('player2-chat-name');
        const player1ChatAvatar = document.getElementById('player1-chat-avatar');
        const player2ChatAvatar = document.getElementById('player2-chat-avatar');

        const maintenanceModal = document.getElementById('maintenance-modal');
        const closeMaintenanceModalBtn = document.getElementById('close-maintenance-modal-btn');
        let isMaintenanceModalOpen = false; // Nueva bandera

        closeMaintenanceModalBtn.addEventListener('click', () => {
            maintenanceModal.classList.remove('visible');
            isMaintenanceModalOpen = false; // Resetear la bandera al cerrar
        });

        const gameCarousel = document.getElementById('game-carousel');
        const waitingScreen = document.getElementById('waiting-screen');
        const cancelWaitBtn = document.getElementById('cancel-wait-btn');
        const startGameBtn = document.getElementById('start-game-btn');
        const kickOpponentBtn = document.getElementById('kick-opponent-btn');
        const chatMessagesContainer = document.querySelector('.chat-messages');
        const chatMessageInput = document.getElementById('chat-message-input');
        const sendChatMessageBtn = document.getElementById('send-chat-message-btn');
        const minimizeChatBtn = document.getElementById('minimize-chat-btn');
        const leftChatButton = document.getElementById('left-chat-button');

        // --- Lógica para el modal de selección de avatar ---
        const profilePictureContainer = document.querySelector('.profile-picture-container');
        const profilePictureModal = document.getElementById('profile-picture-modal');
        const closeAvatarModalBtn = document.getElementById('close-avatar-modal-btn');
        const avatarGrid = document.getElementById('avatar-grid');
        const profileImg = document.getElementById('profile-picture-img');
        const profileSvg = document.getElementById('profile-picture-svg');

        // --- NUEVO: Elementos del modal de apuestas ---
        const betModal = document.getElementById('bet-modal');
        const cancelBetBtn = document.getElementById('cancel-bet-btn');
        const confirmBetBtn = document.getElementById('confirm-bet-btn');
        const betAmountInput = document.getElementById('bet-amount-input');
        const betErrorMessage = document.getElementById('bet-error-message');
        const privateRoomCheckbox = document.getElementById('private-room-checkbox');
        
        // --- NUEVO: Lógica para el modal de amigos ---
        const friendsBtn = document.getElementById('friends-btn');
        const friendsModal = document.getElementById('friends-modal');
        const closeFriendsModalBtn = document.getElementById('close-friends-modal-btn');
        const userFriendIdSpan = document.getElementById('user-friend-id');
        const copyFriendIdBtn = document.getElementById('copy-friend-id-btn');

        // --- NUEVO: Elementos del modal de invitación a la sala ---
        const inviteFriendsModal = document.getElementById('invite-friends-modal');
        const inviteFriendsListContainer = document.getElementById('invite-friends-list-container');
        const closeInviteFriendsModalBtn = document.getElementById('close-invite-friends-modal-btn');

        // --- NUEVO: Lógica para el buscador de amigos ---
        const friendSearchView = document.getElementById('friend-search-view');
        const friendResultView = document.getElementById('friend-result-view');
        const searchInput = document.getElementById('friend-search-input');
        const searchBtn = document.getElementById('friend-search-btn');
        const searchError = document.getElementById('friend-search-error');
        const foundUserAvatarImg = document.getElementById('found-user-avatar-img');
        const foundUserAvatarSvg = document.getElementById('found-user-avatar-svg');
        const foundUsernameSpan = document.getElementById('found-username');
        const addFriendBtn = document.getElementById('add-friend-btn');
        const cancelAddFriendBtn = document.getElementById('cancel-add-friend-btn');
        let foundUser = null;

        const friendRequestsContainer = document.getElementById('friend-requests-container');
        const searchUser = async () => {
            const searchTerm = searchInput.value.trim();
            searchError.textContent = '';
            if (!searchTerm) return;

            if (searchTerm === currentUser.uid || searchTerm === currentUserProfile.username) {
                searchError.textContent = 'No puedes añadirte a ti mismo.';
                return;
            }

            foundUser = null;

            // 1. Buscar por ID (UID)
            try {
                const userDoc = await getDoc(doc(db, "saldo", searchTerm));
                if (userDoc.exists()) {
                    foundUser = { id: userDoc.id, ...userDoc.data() };
                }
            } catch (error) {
                console.warn("Búsqueda por ID no produjo resultados, buscando por username...");
            }

            // 2. Si no se encontró por ID, buscar por username
            if (!foundUser) {
                const usersRef = collection(db, "saldo");
                const q = query(usersRef, where("username", "==", searchTerm));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userDoc = querySnapshot.docs[0];
                    foundUser = { id: userDoc.id, ...userDoc.data() };
                }
            }

            // 3. Mostrar resultados
            if (foundUser) {
                // --- NUEVO: Mostrar el avatar del usuario encontrado ---
                if (foundUser.profileImageName) {
                    foundUserAvatarImg.src = `../imajenes/perfil/${foundUser.profileImageName}`;
                    foundUserAvatarImg.style.display = 'block';
                    foundUserAvatarSvg.style.display = 'none';
                } else {
                    foundUserAvatarImg.style.display = 'none';
                    foundUserAvatarSvg.style.display = 'block';
                }

                foundUsernameSpan.textContent = foundUser.username;
                friendSearchView.style.display = 'none';
                friendResultView.style.display = 'flex';
            } else {
                searchError.textContent = 'Usuario no encontrado.';
            }
        };

        searchBtn.addEventListener('click', searchUser);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchUser();
        });

        cancelAddFriendBtn.addEventListener('click', () => {
            friendSearchView.style.display = 'block';
            friendResultView.style.display = 'none';
            searchInput.value = '';
            searchError.textContent = '';
            foundUser = null;
        });

        addFriendBtn.addEventListener('click', async () => {
            if (!foundUser || !currentUser) {
                searchError.textContent = 'Error al enviar la solicitud.';
                return;
            }

            addFriendBtn.disabled = true;
            addFriendBtn.textContent = 'Enviando...';

            try {
                const requestsRef = collection(db, 'friend_requests');
                await addDoc(requestsRef, {
                    from: currentUser.uid,
                    fromUsername: currentUserProfile.username,
                    to: foundUser.id,
                    toUsername: foundUser.username,
                    status: 'pending',
                    createdAt: new Date()
                });

                addFriendBtn.textContent = 'Solicitud Enviada';
                // Optionally, hide the result view after a delay
                setTimeout(() => {
                    friendSearchView.style.display = 'block';
                    friendResultView.style.display = 'none';
                    searchInput.value = '';
                    foundUser = null;
                    addFriendBtn.disabled = false;
                    addFriendBtn.textContent = 'Añadir';
                }, 2000);

            } catch (error) {
                console.error("Error sending friend request:", error);
                searchError.textContent = 'Hubo un error al enviar la solicitud.';
                addFriendBtn.disabled = false;
                addFriendBtn.textContent = 'Añadir';
            }
        });

        if (friendsBtn && friendsModal) {
            friendsBtn.addEventListener('click', () => {
                friendsModal.classList.add('visible');
                // --- NUEVO: Mostrar el ID del usuario actual en el modal ---
                if (currentUser && userFriendIdSpan) {
                    userFriendIdSpan.textContent = currentUser.uid;
                }
            });

            // --- NUEVO: Lógica para el botón de copiar ID ---
            copyFriendIdBtn.addEventListener('click', async () => {
                if (currentUser && currentUser.uid) {
                    try {
                        await navigator.clipboard.writeText(currentUser.uid);
                        // Feedback visual de que se ha copiado
                        const originalIcon = copyFriendIdBtn.innerHTML;
                        copyFriendIdBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
                        copyFriendIdBtn.style.color = 'var(--primary-color)';
                        setTimeout(() => {
                            copyFriendIdBtn.innerHTML = originalIcon;
                            copyFriendIdBtn.style.color = '';
                        }, 2000);
                    } catch (err) {
                        console.error('Error al copiar el ID: ', err);
                    }
                }
            });



            // Cerrar el modal si se hace clic en el fondo oscuro
            friendsModal.addEventListener('click', (e) => {
                if (e.target === friendsModal) {
                    friendsModal.classList.remove('visible');
                }
            });

            // --- NUEVO: Cerrar el modal de amigos con el botón de cerrar ---
            if (closeFriendsModalBtn) {
                closeFriendsModalBtn.addEventListener('click', () => {
                    friendsModal.classList.remove('visible');
                });
            }
        }

        // --- NUEVO: Lógica para el botón de chat izquierdo ---
        if (leftChatButton) {
            leftChatButton.addEventListener('click', async () => {
                if (userWaitingGameId) { // Only open invite modal if in a game
                    inviteFriendsModal.classList.add('visible');
                    // Populate the invite friends list
                    await renderInviteFriendsList();
                } else {
                    alert('Debes estar en una sala de espera para invitar amigos.');
                }
            });
        }

        // --- NUEVO: Lógica para cerrar el modal de invitación a la sala ---
        if (inviteFriendsModal) {
            inviteFriendsModal.addEventListener('click', (e) => {
                if (e.target === inviteFriendsModal) {
                    inviteFriendsModal.classList.remove('visible');
                }
            });
            if (closeInviteFriendsModalBtn) {
                closeInviteFriendsModalBtn.addEventListener('click', () => {
                    inviteFriendsModal.classList.remove('visible');
                });
            }
        }

        // --- Lógica para el modal de errores de consola ---
        const errorConsoleModal = document.getElementById('error-console-modal');
        const errorConsoleTextarea = document.getElementById('error-console-textarea');
        const copyErrorsBtn = document.getElementById('copy-errors-btn');
        const closeErrorModalBtn = document.getElementById('close-error-modal-btn');
        const capturedErrors = [];

        let currentUser = null; // Variable to hold the current user object
        let currentUserProfile = null; // Variable para guardar el perfil del usuario
        let previousBalance = null; // --- NUEVO: Para detectar cambios en el saldo
        let userWaitingGameId = null;
        let unsubscribeGameListener = null; // Para limpiar el listener de la partida
        let lastMessageCount = 0;

        function updateErrorConsole() {
            errorConsoleTextarea.value = capturedErrors.join('\n\n');
        }

        // Capturar errores de consola
        const originalConsoleError = console.error;
        console.error = function(...args) {
            originalConsoleError.apply(console, args);
            const errorMessage = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
            
            if (((errorMessage.includes('FirebaseError') && errorMessage.includes('resource-exhausted')) || errorMessage.includes('Using maximum backoff delay to prevent overloading the backend.'))) {
                if (!isMaintenanceModalOpen) {
                    maintenanceModal.classList.add('visible');
                    isMaintenanceModalOpen = true;
                }
                return; 
            } else {
                capturedErrors.push('Console Error: ' + errorMessage);
                updateErrorConsole();
                errorConsoleModal.classList.add('visible');
            }
        };

        window.onerror = function(message, source, lineno, colno, error) {
            const errorString = `Uncaught Error: ${message}\n  Source: ${source}\n  Line: ${lineno}, Column: ${colno}\n  Stack: ${error ? error.stack : 'N/A'}`;
            
            if (((errorString.includes('FirebaseError') && errorString.includes('resource-exhausted')) || errorString.includes('Using maximum backoff delay to prevent overloading the backend.'))) {
                if (!isMaintenanceModalOpen) {
                    maintenanceModal.classList.add('visible');
                    isMaintenanceModalOpen = true;
                }
                return false;
            }

            capturedErrors.push(errorString);
            updateErrorConsole();
            errorConsoleModal.classList.add('visible');
            return false;
        };

        window.onunhandledrejection = function(event) {
            const reason = event.reason;
            const errorString = `Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : reason}\n  Stack: ${reason instanceof Error ? reason.stack : 'N/A'}`;

            if (((errorString.includes('FirebaseError') && errorString.includes('resource-exhausted')) || errorString.includes('Using maximum backoff delay to prevent overloading the backend.'))) {
                if (!isMaintenanceModalOpen) {
                    maintenanceModal.classList.add('visible');
                    isMaintenanceModalOpen = true;
                }
                event.preventDefault();
                return;
            }

            capturedErrors.push(errorString);
            updateErrorConsole();
            errorConsoleModal.classList.add('visible');
            event.preventDefault();
        };

        closeErrorModalBtn.addEventListener('click', () => {
            errorConsoleModal.classList.remove('visible');
        });

        copyErrorsBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(errorConsoleTextarea.value);
                alert('Errores copiados al portapapeles!');
            } catch (err) {
                console.error('Error al copiar los errores con navigator.clipboard.writeText:', err);
                try {
                    const textarea = document.createElement('textarea');
                    textarea.value = errorConsoleTextarea.value;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    alert('Errores copiados al portapapeles (método alternativo)!');
                } catch (fallbackErr) {
                    console.error('Error al copiar los errores con document.execCommand(\'copy\'):', fallbackErr);
                    alert('No se pudieron copiar los errores automáticamente. Por favor, selecciona el texto y cópialo manualmente.');
                }
            }
        });

        // --- Lógica para el modal de selección de avatar ---
        profilePictureContainer.addEventListener('click', () => {
            profilePictureModal.classList.add('visible');
        });

        closeAvatarModalBtn.addEventListener('click', () => {
            profilePictureModal.classList.remove('visible');
        });

        // Cargar las imágenes de avatar en la cuadrícula
        const TOTAL_AVATARS = 2;
        for (let i = 1; i <= TOTAL_AVATARS; i++) {
            const img = document.createElement('img');
            const imgPath = `../imajenes/perfil/${i}.jpg`;
            img.src = imgPath;
            img.className = 'avatar-option';
            img.alt = `Avatar ${i}`;
            img.dataset.path = imgPath;
            img.addEventListener('click', () => {
                if (!currentUser) {
                    console.error("Usuario no logueado. No se puede cambiar la foto.");
                    return;
                }
                const selectedPath = img.dataset.path;
                const imageName = selectedPath.split('/').pop(); // Extrae "1.jpg" de la ruta

                updateUserProfile(currentUser.uid, { profileImageName: imageName });
                
                profilePictureModal.classList.remove('visible');
            });
            avatarGrid.appendChild(img);
        }

        async function fetchUserProfile(uid) {
            const userDoc = await getDoc(doc(db, "saldo", uid));
            if (userDoc.exists()) {
                return userDoc.data();
            }
            return null;
        }

        function setPlayerAvatar(imgElement, imageName) {
            if (imageName) {
                imgElement.src = `../imajenes/perfil/${imageName}`;
                imgElement.style.display = 'block';
            } else {
                imgElement.style.display = 'none';
            }
        }

        function renderMessages(messages, container) {
            if (messages && messages.length > 0) {
                if (messages.length > lastMessageCount) {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage.uid !== currentUser.uid) {
                        const audio = new Audio('../audio/mensaje.mp3');
                        audio.play().catch(error => {
                            console.warn("Audio play was prevented by browser policy:", error);
                        });
                    }
                }
                lastMessageCount = messages.length;

                container.innerHTML = ''; // Clear existing messages
                messages.forEach(message => {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('chat-message');
                    
                    const senderClass = message.uid === currentUser.uid ? 'self' : 'opponent';
                    messageElement.classList.add(senderClass);
        
                    messageElement.innerHTML = `<span class="message-sender">${message.username}:</span> ${message.text}`;
                    container.appendChild(messageElement);
                });
            } else {
                container.innerHTML = '';
                lastMessageCount = 0;
            }

        }
        
        // --- NUEVO: Lógica para Notificaciones Push ---
        function requestNotificationPermission() {
            if ('Notification' in window) {
                if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('Permiso para notificaciones concedido.');
                        }
                    });
                }
            }
        }

        function showBalanceUpdateNotification(newBalance, oldBalance) {
            if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) {
                return; // No hacer nada si no hay permiso o no hay service worker
            }

            const amountChange = newBalance - oldBalance;
            const formattedChange = amountChange.toLocaleString('es-ES', { style: 'currency', currency: 'USD' });
            const formattedNewBalance = newBalance.toLocaleString('es-ES', { style: 'currency', currency: 'USD' });

            const title = '¡Saldo Actualizado!';
            const options = {
                body: `Has recibido ${formattedChange}. Tu nuevo saldo es ${formattedNewBalance}.`,
                icon: '../imajenes/pwa.png' // Puedes usar un ícono genérico o el del perfil
            };

            navigator.serviceWorker.getRegistration().then(registration => {
                if (registration) {
                    registration.showNotification(title, options);
                }
            });
        }

        // --- NUEVO: Función para animar el cambio de saldo ---
        function animateBalance(element, start, end, duration) {
            if (start === end) return;
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const currentBalance = progress * (end - start) + start;
                
                // Formatear el número como moneda
                element.textContent = `$${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        }
        // --- NUEVO: Lógica para el modal de apuestas ---
        cancelBetBtn.addEventListener('click', () => {
            betModal.classList.remove('visible');
        });
        betModal.addEventListener('click', (e) => {
            if (e.target === betModal) {
                betModal.classList.remove('visible');
            }
        });

        kickOpponentBtn.addEventListener('click', async () => {
            if (userWaitingGameId) {
                if (confirm('¿Estás seguro de que quieres expulsar a este jugador de la sala?')) {
                    const gameDocRef = doc(db, "games", userWaitingGameId);
                    await updateDoc(gameDocRef, {
                        player2: null,
                        status: "waiting"
                    });
                }
            }
        });

        const sendMessage = async () => {
            const messageText = chatMessageInput.value.trim();
            if (messageText && userWaitingGameId && currentUser) {
                const gameDocRef = doc(db, "games", userWaitingGameId);
                const message = {
                    uid: currentUser.uid,
                    username: currentUserProfile.username,
                    text: messageText,
                    timestamp: new Date()
                };

                await updateDoc(gameDocRef, {
                    messages: arrayUnion(message)
                });

                chatMessageInput.value = '';
            }
        };

        sendChatMessageBtn.addEventListener('click', sendMessage);
        chatMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        minimizeChatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            waitingScreen.classList.toggle('minimized');
        });

        waitingScreen.addEventListener('click', (e) => {
            // --- CORRECCIÓN: Asegurarse de que el chat solo se maximice si está minimizado
            // y si el clic no fue en uno de los botones de acción.
            if (waitingScreen.classList.contains('minimized') && 
                !e.target.closest('#start-game-btn') && 
                !e.target.closest('#cancel-wait-btn')) {
                waitingScreen.classList.remove('minimized');
            }
        });

        try {
            onSessionStateChanged((user) => {
                if (user) {
                    currentUser = user; // Store user object
                    requestNotificationPermission(); // --- NUEVO: Solicitar permiso al iniciar sesión

                    // --- NUEVO: Iniciar la lógica de PocketBase para el contador de usuarios ---
                    window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { userId: user.uid } }));
                    
                    onUserProfileUpdate(user.uid, (userData) => {
                        userDisplayName.textContent = userData.username || user.email;
                        currentUserProfile = userData; // Guardar perfil
                        
                        // --- MODIFICADO: Lógica de animación y notificación de saldo ---
                        if (previousBalance !== null && userData.balance !== previousBalance) {
                            // Animar el saldo desde el valor anterior al nuevo
                            animateBalance(userBalanceSpan, previousBalance, userData.balance, 1500); // 1.5 segundos de animación
                            // Mostrar notificación solo si el saldo aumenta
                            if (userData.balance > previousBalance) {
                                showBalanceUpdateNotification(userData.balance, previousBalance);
                            }
                        } else {
                            // Si es la primera vez, establecer el saldo directamente
                            userBalanceSpan.textContent = `$${userData.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                        // Actualizar el saldo anterior para la próxima comprobación.
                        previousBalance = userData.balance;

                        // Apply profile picture from Firestore
                        if (userData.profileImageName) {
                            profileImg.src = `../imajenes/perfil/${userData.profileImageName}`;
                            profileImg.style.display = 'block';
                            profileSvg.style.display = 'none';
                        } else {
                            profileImg.style.display = 'none';
                            profileSvg.style.display = 'block';
                        }

                        if (userData.username === 'leonirusta') {
                            configureUiBtn.style.display = 'block';
                        } else {
                            configureUiBtn.style.display = 'none';
                        }
                    });

                    // --- NUEVO: Lógica para escuchar solicitudes de amistad ---
                    const requestsRef = collection(db, 'friend_requests');
                    const q = query(requestsRef, where('to', '==', user.uid), where('status', '==', 'pending'));

                    onSnapshot(q, (snapshot) => {
                        friendRequestsContainer.innerHTML = '<h4>Solicitudes</h4>'; // Clear previous requests
                        if (snapshot.empty) {
                            friendRequestsContainer.innerHTML += '';
                            return;
                        }

                        snapshot.forEach(docSnap => {
                            const request = docSnap.data();
                            const requestId = docSnap.id;
                            const requestEl = document.createElement('div');
                            requestEl.className = 'friend-request-item';
                            requestEl.innerHTML = `
                                <span class="friend-request-info">${request.fromUsername}</span>
                                <div class="friend-request-actions">
                                    <button class="accept-btn" data-id="${requestId}" data-from="${request.from}">Aceptar</button>
                                    <button class="decline-btn" data-id="${requestId}">Rechazar</button>
                                </div>
                            `;
                            friendRequestsContainer.appendChild(requestEl);
                        });
                    });

                    // --- NUEVO: Lógica para escuchar invitaciones a sala ---
                    const gameInvitationsRef = collection(db, 'game_invitations');
                    const qGameInvites = query(gameInvitationsRef, where('to', '==', user.uid), where('status', '==', 'pending'));

                    onSnapshot(qGameInvites, (snapshot) => {
                        // Clear previous game invites (if any) before rendering new ones
                        const existingGameInvites = friendRequestsContainer.querySelectorAll('.game-invite-item');
                        existingGameInvites.forEach(item => item.remove());

                        if (snapshot.empty) {
                            return;
                        }

                        snapshot.forEach(async (docSnap) => {
                            const invite = docSnap.data();
                            const inviteId = docSnap.id;

                            // --- NUEVO: Obtener datos del remitente para el avatar ---
                            const fromUserDoc = await getDoc(doc(db, 'saldo', invite.from));
                            const fromUserData = fromUserDoc.exists() ? fromUserDoc.data() : {};
                            const fromUserAvatar = fromUserData.profileImageName ? `../imajenes/perfil/${fromUserData.profileImageName}` : '';

                            // --- NUEVO: Obtener datos de la partida para la apuesta ---
                            const gameDoc = await getDoc(doc(db, 'games', invite.gameId));
                            const gameData = gameDoc.exists() ? gameDoc.data() : {};
                            const betAmount = gameData.betAmount || 0;

                            const inviteEl = document.createElement('div');
                            inviteEl.className = 'game-invite-item'; // Usar la nueva clase principal
                            inviteEl.innerHTML = `
                                <div class="game-invite-info">
                                    ${fromUserAvatar ? `<img src="${fromUserAvatar}" class="game-invite-avatar">` : ''}
                                    <div class="game-invite-text">
                                        <span class="username">${invite.fromUsername}</span> te invita a una partida. <br>
                                        ${betAmount > 0 ? `<span class="game-invite-bet">Apuesta: $${betAmount.toLocaleString()}</span>` : ''}
                                    </div>
                                </div>
                                <div class="friend-request-actions">
                                    <button class="accept-btn accept-game-invite-btn" data-id="${inviteId}" data-game-id="${invite.gameId}">Aceptar</button>
                                    <button class="decline-btn decline-game-invite-btn" data-id="${inviteId}">Rechazar</button>
                                </div>
                            `;
                            friendRequestsContainer.appendChild(inviteEl);
                        });
                    });

                    // --- CORRECCIÓN: Unificar el manejo de clics para solicitudes de amistad e invitaciones de juego ---
                    friendRequestsContainer.addEventListener('click', async (e) => {
                        // Aceptar solicitud de amistad
                        if (e.target.classList.contains('accept-btn')) {
                            const requestId = e.target.dataset.id;
                            const fromId = e.target.dataset.from;
                            const currentUserRef = doc(db, 'saldo', currentUser.uid);
                            const friendUserRef = doc(db, 'saldo', fromId);

                            try {
                                await updateDoc(currentUserRef, { friends: arrayUnion(fromId) });
                                await updateDoc(friendUserRef, { friends: arrayUnion(currentUser.uid) });
                                await updateDoc(doc(db, 'friend_requests', requestId), { status: 'accepted' });
                            } catch (error) {
                                console.error("Error accepting friend request: ", error);
                            }
                        }

                        // Rechazar solicitud de amistad
                        if (e.target.classList.contains('decline-btn')) {
                            const requestId = e.target.dataset.id;
                            try {
                                await updateDoc(doc(db, 'friend_requests', requestId), { status: 'declined' });
                            } catch (error) {
                                console.error("Error declining friend request: ", error);
                            }
                        }

                        // Aceptar invitación a partida
                        if (e.target.classList.contains('accept-game-invite-btn')) {
                            const inviteId = e.target.dataset.id;
                            const gameId = e.target.dataset.gameId;
                            try {
                                // --- CORRECCIÓN: Lógica para unirse a la sala de chat en lugar de ir directo al juego ---
                                const gameDocRef = doc(db, "games", gameId);
                                const gameSnap = await getDoc(gameDocRef);

                                if (!gameSnap.exists() || gameSnap.data().status !== 'waiting') {
                                    alert('Esta partida ya no está disponible o alguien más se unió primero.');
                                    await updateDoc(doc(db, 'game_invitations', inviteId), { status: 'expired' });
                                    return;
                                }

                                const gameData = gameSnap.data();
                                if (currentUserProfile && gameData.betAmount > currentUserProfile.balance) {
                                    alert('No tienes saldo suficiente para unirte a esta partida.');
                                    return;
                                }

                                const random = Math.random();
                                const player1Uid = gameData.player1.uid;
                                const player2Uid = currentUser.uid;
                                const startingPlayerUid = random < 0.5 ? player1Uid : player2Uid;

                                await updateDoc(gameDocRef, {
                                    player2: { uid: player2Uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName },
                                    status: "players_joined",
                                    currentPlayerUid: startingPlayerUid,
                                    turn: 1
                                });

                                await updateDoc(doc(db, 'game_invitations', inviteId), { status: 'accepted' });

                                userWaitingGameId = gameId;
                                gameCarousel.style.display = 'none';
                                waitingScreen.style.display = 'flex';
                                player1ChatName.textContent = gameData.player1.username;
                                setPlayerAvatar(player1ChatAvatar, gameData.player1.profileImageName);
                                player2ChatName.textContent = currentUserProfile.username;
                                setPlayerAvatar(player2ChatAvatar, currentUserProfile.profileImageName);
                                startGameBtn.style.display = 'none';
                                cancelWaitBtn.textContent = 'Abandonar Sala';

                                unsubscribeGameListener = onSnapshot(doc(db, "games", gameId), (gameSnap) => {
                                    const gameData = gameSnap.data();
                                    if (gameData && gameData.status === "starting") {
                                        window.location.href = `../index.html?gameId=${gameId}`;
                                    }
                                });

                                friendsModal.classList.remove('visible'); // Cerrar modal de amigos
                            } catch (error) {
                                console.error("Error accepting game invitation: ", error);
                            }
                        }

                        // Rechazar invitación a partida
                        if (e.target.classList.contains('decline-game-invite-btn')) {
                            const inviteId = e.target.dataset.id;
                            try {
                                await updateDoc(doc(db, 'game_invitations', inviteId), { status: 'declined' });
                            } catch (error) {
                                console.error("Error declining game invitation: ", error);
                            }
                        }
                    });


                    const friendsListContainer = document.getElementById('friends-list-container');

                    onSnapshot(doc(db, 'saldo', user.uid), async (docSnap) => {
                        if (docSnap.exists()) {
                            const userData = docSnap.data();
                            const friendIds = userData.friends || [];
                            friendsListContainer.innerHTML = '<h4>Mis Amigos</h4>';

                            if (friendIds.length === 0) {
                                friendsListContainer.innerHTML += '<p>No tienes amigos todavía.</p>';
                                return;
                            }

                            for (const friendId of friendIds) {
                                const friendDoc = await getDoc(doc(db, 'saldo', friendId));
                                if (friendDoc.exists()) {
                                    const friendData = friendDoc.data();
                                    const friendEl = document.createElement('div');
                                    friendEl.className = 'friend-item';

                                    let avatarHtml = '';
                                    if (friendData.profileImageName) {
                                        avatarHtml = `<img src="../imajenes/perfil/${friendData.profileImageName}" alt="Avatar">`;
                                    } else {
                                        avatarHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;
                                    }

                                    friendEl.innerHTML = `
                                        <div class="friend-avatar">
                                            ${avatarHtml}
                                        </div>
                                        <span class="friend-info">${friendData.username}</span>
                                    `;
                                    friendsListContainer.appendChild(friendEl);
                                }
                            }
                        }
                    });

                const cleanupWaitingGame = async () => {
                    if (userWaitingGameId && currentUser) {
                        try {
                            const gameDocRef = doc(db, "games", userWaitingGameId);
                            const gameSnap = await getDoc(gameDocRef);
                            if (gameSnap.exists()) {
                                const gameData = gameSnap.data();
                                if (gameData.player1.uid === currentUser.uid) { // Current user is Player 1 (owner)
                                    if (gameData.status === "waiting" || gameData.status === "players_joined") {
                                        await deleteDoc(gameDocRef);
                                        console.log(`Game ${userWaitingGameId} deleted by owner.`);
                                    }
                                } else if (gameData.player2?.uid === currentUser.uid) { // Current user is Player 2 (guest)
                                    if (gameData.status === "players_joined") {
                                        await updateDoc(gameDocRef, {
                                            player2: null,
                                            status: "waiting"
                                        });
                                        console.log(`Player 2 left game ${userWaitingGameId}. Game status reverted to waiting.`);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error("Error cleaning up waiting game:", error);
                        } finally {
                            userWaitingGameId = null;
                            waitingScreen.style.display = 'none';
                            gameCarousel.style.display = 'flex';
                            // Reset UI elements for waiting screen
                            player2ChatName.textContent = 'Oponente';
                            player2ChatAvatar.style.display = 'none';
                            startGameBtn.style.display = 'none';
                            cancelWaitBtn.textContent = 'Cancelar Sala';
                            kickOpponentBtn.style.display = 'none';
                            if (unsubscribeGameListener) {
                                unsubscribeGameListener(); // Detener el listener anterior
                            }
                        }
                    }
                };

                menuToggleBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    userMenu.classList.toggle('active');
                });

                document.addEventListener('click', (event) => {
                    if (!userMenu.contains(event.target) && !menuToggleBtn.contains(event.target)) {
                        userMenu.classList.remove('active');
                    }
                });

                configureUiBtn.addEventListener('click', () => {
                    console.log('Botón Administrador clickeado! Abriendo admin.html en una nueva pestaña.');
                    window.open('admin.html', '_blank');
                    userMenu.classList.remove('active');
                });
                
                const gamesRef = collection(db, "games");
                const STALE_GAME_MINUTES = 10;

                const purgeStaleGames = async () => {
                    try {
                        // --- CORRECCIÓN: Definir la consulta que faltaba ---
                        const waitingGamesQuery = query(gamesRef, where("status", "==", "waiting"), where("player2", "==", null));
                        const snapshot = await getDocs(waitingGamesQuery);
                        const now = new Date();
                        const promises = [];
                        snapshot.forEach(docSnap => {
                            const gameData = docSnap.data();
                            const createdAt = gameData.createdAt?.toDate();
                            if (createdAt) {
                                const minutesDiff = (now - createdAt) / (1000 * 60);
                                if (minutesDiff > STALE_GAME_MINUTES && docSnap.data().status === "waiting" && docSnap.data().player2 === null) {
                                    // Stale game logic
                                }
                            }
                        });
                    } catch (error) {
                        console.error("Error al purgar partidas antiguas:", error);
                    }
                };
                purgeStaleGames();

                userWaitingGameId = null;
                let pollingIntervalId = null; // Variable para almacenar el ID del intervalo

                const fetchWaitingGames = async () => {
                    if (waitingScreen.style.display === 'flex' && userWaitingGameId) {
                        return; // Don't poll for games if the user is already in a waiting room
                    }
                    const waitingGamesQuery = query(gamesRef, where("status", "==", "waiting"), where("player2", "==", null), where("isPrivate", "==", false));
                    try {
                        const querySnapshot = await getDocs(waitingGamesQuery);
                        gameCarousel.innerHTML = '';
                        let userIsWaiting = false;
                        const now = new Date();

                        querySnapshot.forEach(docSnap => {
                            const gameData = docSnap.data();
                            const gameId = docSnap.id;

                            if (gameData.player1.uid === user.uid) {
                                userIsWaiting = true;
                                userWaitingGameId = gameId;
                            } else {
                                const card = document.createElement('div');
                                card.className = 'game-card waiting';
                                card.dataset.gameId = gameId;
                                card.innerHTML = `
                                    <div class="card-player-info">
                                        <span class="player-name-waiting">${gameData.player1.username}</span>
                                        <span class="status-text">está esperando...</span>
                                    </div>
                                    <!-- NUEVO: Mostrar monto de la apuesta -->
                                    ${gameData.betAmount > 0 ? `
                                    <div class="card-bet-amount">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm1.5-3.845V11h-3v-1.034c.96.124 1.51.278 1.51.794 0 .516-.544.69-1.51.825V12.5h3v-1.033c-.967-.125-1.51-.28-1.51-.795 0-.515.543-.69 1.51-.825V8.5h-3V7.5h3v1.033c.96.124 1.51.278 1.51.794 0 .516-.544.69-1.51.825z"/></svg>
                                        <span>$${gameData.betAmount.toLocaleString()}</span>
                                    </div>
                                    ` : ''}
                                    <div class="card-player-count">1/2</div>
                                `;
                                // --- MEJORA DE SEGURIDAD ---
                                card.addEventListener('click', async () => {
                                    // Volver a verificar el estado de la partida antes de unirse
                                    const gameDocRef = doc(db, "games", gameId);
                                    const gameSnap = await getDoc(gameDocRef);

                                    if (!gameSnap.exists() || gameSnap.data().status !== 'waiting') {
                                        alert('Esta partida ya no está disponible o alguien más se unió primero.');
                                        // Opcional: podrías refrescar la lista de partidas aquí
                                        return;
                                    }

                                    // --- NUEVO: Validar saldo del jugador 2 antes de unirse ---
                                    if (currentUserProfile && gameData.betAmount > currentUserProfile.balance) {
                                        alert('No tienes saldo suficiente para unirte a esta partida.');
                                        return;
                                    }

                                    const random = Math.random();
                                    const player1Uid = gameData.player1.uid;
                                    const player2Uid = user.uid;
                                    const startingPlayerUid = random < 0.5 ? player1Uid : player2Uid;

                                    // --- MODIFICADO: Ya no se descuenta el saldo del jugador 2 al unirse a la partida ---
                                    // La validación de saldo se mantiene, pero la deducción se realizará al iniciar la partida.
                                    console.log(`Player 2 (${user.uid}) is joining a game with bet amount: ${gameData.betAmount}. Balance will be deducted upon game start.`);

                                    await updateDoc(doc(db, "games", gameId), {
                                        player2: { uid: player2Uid, username: userDisplayName.textContent, profileImageName: currentUserProfile.profileImageName },
                                        status: "players_joined", // Changed status to indicate players have joined but game not started
                                        currentPlayerUid: startingPlayerUid,
                                        turn: 1,
                                        // --- NUEVO: Descontar saldo del jugador 2 ---
                                        player2BalanceTransaction: {
                                            amount: -gameData.betAmount,
                                            type: 'bet',
                                            gameId: gameId,
                                            timestamp: new Date()
                                        }
                                    }); // Removed .then() to prevent immediate redirect
                                    // Player 2 will now wait in the chat room.

                                    userWaitingGameId = gameId; // Set the game ID for cleanup
                                    gameCarousel.style.display = 'none';
                                    waitingScreen.style.display = 'flex';
                                    player1ChatName.textContent = gameData.player1.username;
                                    setPlayerAvatar(player1ChatAvatar, gameData.player1.profileImageName);
                                    player2ChatName.textContent = currentUserProfile.username; // Player 2 is current user
                                    setPlayerAvatar(player2ChatAvatar, currentUserProfile.profileImageName);
                                    startGameBtn.style.display = 'none'; // Player 2 doesn't see the start button
                                    cancelWaitBtn.textContent = 'Abandonar Sala'; // Player 2 can abandon the room

                                    // Listen for game status changes to redirect to actual game
                                    unsubscribeGameListener = onSnapshot(doc(db, "games", gameId), (gameSnap) => {
                                        const gameData = gameSnap.data();
                                        if (gameData) {
                                            renderMessages(gameData.messages, chatMessagesContainer);
                                            if (gameData.status === "starting" && !gameStartedAndLoaded) { // Check flag
                                                root.style.display = 'none';
                                                gameContainer.style.display = 'block';
                                                gameIframe.src = `../index.html?gameId=${gameId}`;
                                            }
                                        }
                                    });
                                });
                                gameCarousel.appendChild(card);
                            }
                        });

                        if (userIsWaiting) {
                            gameCarousel.style.display = 'none';
                            waitingScreen.style.display = 'flex';
                            player1ChatName.textContent = currentUserProfile.username;
                            setPlayerAvatar(player1ChatAvatar, currentUserProfile.profileImageName);
                            player2ChatName.textContent = 'Oponente';
                            player2ChatAvatar.style.display = 'none'; // Ocultar avatar del oponente inicialmente
                            document.getElementById('cancel-wait-btn').textContent = 'Cancelar Sala';
                            startGameBtn.style.display = 'none'; // Ensure start button is hidden when waiting for player 2
                        } else {
                            gameCarousel.style.display = 'flex';
                            waitingScreen.style.display = 'none';

                            const createCard = document.createElement('div');
                            createCard.className = 'game-card create-new';
                            createCard.innerHTML = `
                                <div class="create-icon">+</div>
                                <span class="create-text">Crear Partida</span>
                            `;
                            createCard.addEventListener('click', async () => {
                                // --- MODIFICADO: Abrir el modal de apuesta en lugar de crear la partida directamente ---
                                betAmountInput.value = '1000'; // Valor por defecto
                                betErrorMessage.textContent = '';
                                betModal.classList.add('visible');
                            });
                            // --- NUEVO: Lógica del botón de confirmar apuesta ---
                            confirmBetBtn.onclick = async () => {
                                const betAmount = parseFloat(betAmountInput.value);

                                // Validaciones
                                if (isNaN(betAmount) || betAmount < 1000) {
                                    betErrorMessage.textContent = 'La apuesta mínima es de $1,000.';
                                    return;
                                }
                                if (currentUserProfile && betAmount > currentUserProfile.balance) {
                                    betErrorMessage.textContent = 'No tienes saldo suficiente para esta apuesta.';
                                    return;
                                }

                                betErrorMessage.textContent = '';
                                confirmBetBtn.disabled = true;
                                confirmBetBtn.textContent = 'Creando...';

                                // --- Lógica de creación de partida (movida aquí) ---
                                const gamesRef = collection(db, "games");
                                const ballPositions = [];
                                const RACK_SPACING_DIAMETER = 24;
                                const TABLE_WIDTH = 1000;
                                const TABLE_HEIGHT = 500;
                                const startX = TABLE_WIDTH * 0.80;
                                const startY = TABLE_HEIGHT / 2;
                                const ballOrder = [1, 14, 2, 15, 8, 3, 13, 4, 12, 5, 11, 6, 10, 7, 9];
                                let ballIndex = 0;

                                for (let i = 0; i < 5; i++) {
                                    for (let j = 0; j <= i; j++) {
                                        const ballNumber = ballOrder[ballIndex++];
                                        ballPositions.push({
                                            number: ballNumber,
                                            x: startX + i * (RACK_SPACING_DIAMETER * 0.866),
                                            y: startY + j * RACK_SPACING_DIAMETER - i * (RACK_SPACING_DIAMETER / 2),
                                            isActive: true
                                        });
                                    }
                                }
                                ballPositions.push({
                                    number: null,
                                    x: TABLE_WIDTH / 4,
                                    y: TABLE_HEIGHT / 2,
                                    isActive: true
                                });

                                // --- MODIFICADO: Ya no se descuenta el saldo del jugador 1 al crear la partida ---
                                // La validación de saldo se mantiene, pero la deducción se realizará al iniciar la partida.
                                console.log(`Player 1 (${user.uid}) is creating a game with bet amount: ${betAmount}. Balance will be deducted upon game start.`);
                                betModal.classList.remove('visible'); // Cerrar modal

                                const newGame = await addDoc(collection(db, "games"), {
                                    player1: { uid: user.uid, username: userDisplayName.textContent, profileImageName: currentUserProfile.profileImageName },
                                    player2: null,
                                    status: "waiting",
                                    createdAt: new Date(),
                                    currentPlayerUid: null,
                                    balls: ballPositions,
                                    turn: 1,
                                    betAmount: betAmount,
                                    isPrivate: privateRoomCheckbox.checked,
                                    messages: [] // Initialize messages array
                                });

                                userWaitingGameId = newGame.id;
                                gameCarousel.style.display = 'none';
                                waitingScreen.style.display = 'flex';
                                player1ChatName.textContent = currentUserProfile.username;
                                setPlayerAvatar(player1ChatAvatar, currentUserProfile.profileImageName);
                                player2ChatName.textContent = 'Oponente';
                                player2ChatAvatar.style.display = 'none';
                                cancelWaitBtn.textContent = 'Cancelar Sala';
                                startGameBtn.style.display = 'none';
                                kickOpponentBtn.style.display = 'none';

                                let gameStartedAndLoaded = false; // Flag to prevent multiple iframe loads
                                unsubscribeGameListener = onSnapshot(doc(db, "games", newGame.id), (gameSnap) => {
                                    const gameData = gameSnap.data();
                                    if (gameData) {
                                        if (gameData.status === "players_joined" && gameData.player2) {
                                            // Player 2 has joined, update UI for Player 1
                                            player2ChatName.textContent = gameData.player2.username;
                                            setPlayerAvatar(player2ChatAvatar, gameData.player2.profileImageName);
                                            kickOpponentBtn.style.display = 'block'; // Show kick button
                                        } else if (gameData.status === "starting" && !gameStartedAndLoaded) { // Check flag
                                            root.style.display = 'none';
                                            gameContainer.style.display = 'block';
                                            gameIframe.src = `../index.html?gameId=${newGame.id}`;
                                            gameStartedAndLoaded = true; // Set flag to true after loading
                                        } else if (gameData.status === "waiting") {
                                            // Still waiting for player 2
                                            player2ChatName.textContent = 'Oponente';
                                            player2ChatAvatar.style.display = 'none';
                                            startGameBtn.style.display = 'none';
                                            cancelWaitBtn.textContent = 'Cancelar Sala';
                                            kickOpponentBtn.style.display = 'none'; // Hide kick button
                                        }
                                        renderMessages(gameData.messages, chatMessagesContainer);
                                    } else {
                                        // Game document was deleted, clean up the UI
                                        cleanupWaitingGame();
                                    }
                    // Player 1 can always start if a player 2 is present
                    if (gameData && gameData.player2) {
                        startGameBtn.style.display = 'block';
                        cancelWaitBtn.textContent = 'Cancelar Partida';
                    } else if (gameData) { // If there's game data but no player 2
                        startGameBtn.style.display = 'none';
                    }
                                });

                                // Event listener for the new start game button
                                startGameBtn.onclick = async () => {
                                    if (confirm('¿Estás seguro de que quieres iniciar la partida?')) {
                                        if (userWaitingGameId && currentUser) {
                                            const gameDocRef = doc(db, "games", userWaitingGameId);
                                            const gameSnap = await getDoc(gameDocRef);
                                            if (!gameSnap.exists()) {
                                                alert('La partida ya no existe.');
                                                return;
                                            }
                                            const gameData = gameSnap.data();
                                            const betAmount = gameData.betAmount || 0;

                                            // Fetch latest balances for both players within a transaction
                                            try {
                                                await runTransaction(db, async (transaction) => {
                                                    const player1Ref = doc(db, "saldo", gameData.player1.uid);
                                                    const player2Ref = doc(db, "saldo", gameData.player2.uid);

                                                    const player1Doc = await transaction.get(player1Ref);
                                                    const player2Doc = await transaction.get(player2Ref);

                                                    if (!player1Doc.exists() || !player2Doc.exists()) {
                                                        throw new Error("Uno de los perfiles de jugador no existe.");
                                                    }

                                                    const player1Balance = player1Doc.data().balance || 0;
                                                    const player2Balance = player2Doc.data().balance || 0;

                                                    if (player1Balance < betAmount || player2Balance < betAmount) {
                                                        throw new Error("Uno de los jugadores no tiene saldo suficiente para la apuesta.");
                                                    }

                                                    // Deduct balance
                                                    transaction.update(player1Ref, {
                                                        balance: player1Balance - betAmount,
                                                        transactions: arrayUnion({
                                                            amount: -betAmount,
                                                            type: 'bet_deduction',
                                                            gameId: userWaitingGameId,
                                                            timestamp: new Date()
                                                        })
                                                    });
                                                    transaction.update(player2Ref, {
                                                        balance: player2Balance - betAmount,
                                                        transactions: arrayUnion({
                                                            amount: -betAmount,
                                                            type: 'bet_deduction',
                                                            gameId: userWaitingGameId,
                                                            timestamp: new Date()
                                                        })
                                                    });

                                                    // Update game status
                                                    transaction.update(gameDocRef, {
                                                        status: "starting"
                                                    });
                                                });

                                                // If transaction is successful, proceed to load game
                                                root.style.display = 'none';
                                                gameContainer.style.display = 'block';
                                                gameIframe.src = `../index.html?gameId=${userWaitingGameId}`;

                                            } catch (e) {
                                                console.error("Error al iniciar la partida y deducir saldo:", e);
                                                alert(`No se pudo iniciar la partida: ${e.message}`);
                                            }
                                        }
                                    }
                                };
                            };
                            gameCarousel.appendChild(createCard);


                        }
                    } catch (error) {
                        console.error("Error fetching waiting games:", error);
                    }
                };

                // Iniciar el polling
                pollingIntervalId = setInterval(fetchWaitingGames, 5000); // Polling cada 5 segundos

                // Limpiar el intervalo cuando el usuario cierra sesión o abandona la página
                const stopPolling = () => {
                    if (pollingIntervalId) {
                        clearInterval(pollingIntervalId);
                        pollingIntervalId = null;
                    }
                };

                logoutBtn.addEventListener('click', async () => {
                    stopPolling(); // Detener el polling al cerrar sesión
                    await cleanupWaitingGame();
                    logout().then(() => {
                        window.location.href = 'login.html';
                    }).catch((error) => {
                        console.error('Error al cerrar sesión:', error);
                    });
                });

                window.addEventListener('beforeunload', async (event) => {
                    stopPolling(); // Detener el polling al abandonar la página
                    await cleanupWaitingGame();
                });

                // Llamar a fetchWaitingGames una vez al inicio para cargar los juegos
                fetchWaitingGames();

                cancelWaitBtn.addEventListener('click', async () => {
                    await cleanupWaitingGame();
                });

                window.addEventListener('beforeunload', async (event) => {
                    await cleanupWaitingGame();
                });

                // --- NUEVO: Listener para mensajes del iframe (index.html) ---
                window.addEventListener('message', (event) => {
                    // Asegurarse de que el mensaje proviene del iframe esperado
                    // En un entorno de producción, se debería verificar event.origin
                    if (event.data && event.data.type === 'gameEnded') { // Changed to gameEnded
                        console.log('Mensaje de fin de juego recibido del iframe:', event.data.gameId);
                        // Ocultar el iframe y mostrar la interfaz de home
                        gameContainer.style.display = 'none';
                        root.style.display = 'block';
                        // Mostrar un mensaje al usuario en home.html basado en si ganó o perdió
                        if (event.data.winner) {
                            alert('¡Felicidades! Has ganado la partida.');
                        } else {
                            alert('La partida ha terminado. Tu saldo ha sido actualizado.');
                        }
                        // Recargar el perfil del usuario para reflejar el nuevo saldo
                        onUserProfileUpdate(currentUser.uid, (userData) => {
                            userDisplayName.textContent = userData.username || currentUser.email;
                            currentUserProfile = userData;
                            userBalanceSpan.textContent = `$${userData.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            previousBalance = userData.balance;
                        });
                    }
                });

            } else {
                window.location.href = 'login.html';
            }
        });
        } catch (error) {
            console.error("Error in onSessionStateChanged setup:", error);
        }

        // --- NUEVO: Función para enviar invitación a la sala ---
        async function sendGameInvitation(friendId, toUsername, gameId) {
            try {
                const gameInvitationsRef = collection(db, 'game_invitations');
                await addDoc(gameInvitationsRef, {
                    from: currentUser.uid,
                    fromUsername: currentUserProfile.username,
                    to: friendId,
                    toUsername: toUsername,
                    gameId: gameId,
                    status: 'pending',
                    createdAt: new Date()
                });
                console.log(`Invitación a la sala ${gameId} enviada a ${friendId}`);
                alert(`Invitación enviada a ${toUsername}!`);
            } catch (error) {
                console.error("Error al enviar invitación a la sala:", error);
                alert("Error al enviar invitación.");
            }
        }

        // --- NUEVO: Función para renderizar la lista de amigos para invitar ---
        async function renderInviteFriendsList() {
            if (!currentUser || !userWaitingGameId) return;

            const userDoc = await getDoc(doc(db, 'saldo', currentUser.uid));
            if (!userDoc.exists()) return;

            const userData = userDoc.data();
            const friendIds = userData.friends || [];
            inviteFriendsListContainer.innerHTML = '<h4>Mis Amigos</h4>';

            if (friendIds.length === 0) {
                inviteFriendsListContainer.innerHTML += '<p>No tienes amigos todavía.</p>';
                return;
            }

            for (const friendId of friendIds) {
                const friendDoc = await getDoc(doc(db, 'saldo', friendId));
                if (friendDoc.exists()) {
                    const friendData = friendDoc.data();
                    const friendEl = document.createElement('div');
                    friendEl.className = 'friend-item';

                    let avatarHtml = '';
                    if (friendData.profileImageName) {
                        avatarHtml = `<img src="../imajenes/perfil/${friendData.profileImageName}" alt="Avatar">`;
                    } else {
                        avatarHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;
                    }

                    friendEl.innerHTML = `
                        <div class="friend-avatar">
                            ${avatarHtml}
                        </div>
                        <span class="friend-info">${friendData.username}</span>
                        ${friendId !== currentUser.uid ? `<button class="invite-to-game-btn" data-friend-id="${friendId}">Invitar a Sala</button>` : ''}
                    `;
                    inviteFriendsListContainer.appendChild(friendEl);
                }
            }

            // Add event listeners for invite buttons
            inviteFriendsListContainer.querySelectorAll('.invite-to-game-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    // --- CORRECCIÓN: Obtener los datos del amigo desde el elemento clickeado ---
                    const friendToInviteId = e.target.dataset.friendId;
                    const friendItem = e.target.closest('.friend-item');
                    const friendUsername = friendItem.querySelector('.friend-info').textContent;

                    if (friendToInviteId && userWaitingGameId) {
                        await sendGameInvitation(friendToInviteId, friendUsername, userWaitingGameId);
                        // --- MEJORA: Añadir un checkmark para feedback visual ---
                        e.target.innerHTML = '✓ Invitado';
                        e.target.disabled = true;
                    }
                });
            });
        }
