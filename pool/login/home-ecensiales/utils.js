import { db, doc, deleteDoc, updateDoc, getDoc } from './firebaseService.js';
import { maintenanceModal, errorConsoleTextarea, errorConsoleModal, waitingScreen, gameCarousel, player2ChatName, player2ChatAvatar, startGameBtn, cancelWaitBtn, kickOpponentBtn } from './domElements.js';
import { getState, setUserWaitingGameId, setPollingIntervalId, setGameStarted } from './state.js';

export let isMaintenanceModalOpen = false;
export const capturedErrors = [];

export function updateErrorConsole() {
    errorConsoleTextarea.value = capturedErrors.join('\n\n');
}

export function setPlayerAvatar(imgElement, imageName) {
    if (imageName) {
        imgElement.src = `../imajenes/perfil/${imageName}`;
        imgElement.style.display = 'block';
    } else {
        imgElement.style.display = 'none';
    }
}

export function renderMessages(messages, container) {
    const { currentUser, lastMessageCount } = getState();

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
        // lastMessageCount is now managed externally

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
        // lastMessageCount is now managed externally
    }
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight; // Scroll to the bottom
    });
}

export function requestNotificationPermission() {
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

export function showBalanceUpdateNotification(newBalance, oldBalance) {
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

export function animateBalance(element, start, end, duration) {
    if (start === end) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentBalance = progress * (end - start) + start;
        
        element.textContent = `$${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

export async function fetchUserProfile(uid) {
    const userDoc = await getDoc(doc(db, "saldo", uid));
    if (userDoc.exists()) {
        return userDoc.data();
    }
    return null;
}

// --- NUEVO: Manejo de errores global ---
export const setupErrorHandling = () => {
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
};

// --- NUEVO: Limpieza de la sala de espera ---
export const loadGameIntoIframe = (gameId) => {
    const rootDiv = document.getElementById('root');
    const gameContainer = document.getElementById('game-container');
    const gameIframe = document.getElementById('game-iframe');

    if (rootDiv && gameContainer && gameIframe) {
        rootDiv.style.display = 'none'; // Oculta la interfaz principal de home.html
        gameContainer.style.display = 'block'; // Muestra el contenedor del juego
        gameIframe.src = `../index.html?gameId=${gameId}`; // Carga el juego en el iframe
    } else {
        console.error('No se encontraron los elementos necesarios para cargar el juego en el iframe.');
        // Fallback: si no se encuentran los elementos, redirigir como antes
        window.location.href = `../index.html?gameId=${gameId}`;
    }
};

export const cleanupWaitingGame = async () => {
    const { currentUser, userWaitingGameId } = getState();

    if (!userWaitingGameId || !currentUser) {
        return;
    }

    const resetUI = () => {
        setUserWaitingGameId(null);
        setGameStarted(false);
        waitingScreen.style.display = 'none';
        gameCarousel.style.display = 'flex';
        player2ChatName.textContent = 'Oponente';
        player2ChatAvatar.style.display = 'none';
        startGameBtn.style.display = 'none';
        cancelWaitBtn.textContent = 'Cancelar Sala';
        kickOpponentBtn.style.display = 'none';
    };

    try {
        const gameDocRef = doc(db, "games", userWaitingGameId);
        const gameSnap = await getDoc(gameDocRef);

        if (gameSnap.exists()) {
            const gameData = gameSnap.data();
            const isPlayer1 = gameData.player1.uid === currentUser.uid;
            const isPlayer2 = gameData.player2?.uid === currentUser.uid;

            // Case 1: Two players are in the room. The one who leaves makes the other the winner.
            if (gameData.status === "players_joined" && (isPlayer1 || isPlayer2)) {
                const winner = isPlayer1 ? gameData.player2 : gameData.player1;
                const loser = isPlayer1 ? gameData.player1 : gameData.player2;
                
                if (winner && loser) {
                    await updateDoc(gameDocRef, {
                        juegoTerminado: true,
                        winner: winner.uid,
                        loser: loser.uid,
                        status: 'finished'
                    });

                    const betAmount = gameData.betAmount || 0;
                    const totalWinnings = betAmount * 2;

                    localStorage.setItem('gameEnded', 'true');
                    localStorage.setItem('winnerUid', winner.uid);
                    localStorage.setItem('loserUid', loser.uid);
                    localStorage.setItem('winnerUsername', winner.username);
                    localStorage.setItem('loserUsername', loser.username);
                    localStorage.setItem('winnerAvatar', `../imajenes/perfil/${winner.profileImageName}`);
                    localStorage.setItem('loserAvatar', `../imajenes/perfil/${loser.profileImageName}`);
                    localStorage.setItem('winnerAmount', totalWinnings.toString());
                    localStorage.setItem('loserAmount', betAmount.toString());

                    window.location.reload();
                    return; // Exit after starting reload
                }
            }

            // Case 2: Player 1 is alone in a "waiting" room and cancels.
            if (isPlayer1 && gameData.status === "waiting") {
                await deleteDoc(gameDocRef);
            }
        }
        
        // If we reach here, it means we didn't reload. So, reset the UI.
        resetUI();

    } catch (error) {
        console.error("Error cleaning up waiting game:", error);
        // Also reset UI on error
        resetUI();
    }
};
