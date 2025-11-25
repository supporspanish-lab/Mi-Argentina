import { db, doc, deleteDoc, updateDoc, getDoc } from './firebaseService.js';
import { maintenanceModal, waitingScreen, gameCarousel, player2ChatName, player2ChatAvatar, startGameBtn, cancelWaitBtn, kickOpponentBtn } from './domElements.js';
import { getState, setUserWaitingGameId, setPollingIntervalId, setGameStarted } from './state.js';

export let isMaintenanceModalOpen = false;

// --- NUEVO: Manejo mínimo de errores para ignorar permisos de Firebase ---
export const setupMinimalErrorHandling = () => {
    window.onunhandledrejection = function(event) {
        const reason = event.reason;
        const errorString = `Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : reason}`;

        // Ignorar errores de permisos de Firebase
        if (errorString.includes('Missing or insufficient permissions')) {
            event.preventDefault();
            return;
        }
    };
};

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

    const resetUI = () => {
        setUserWaitingGameId(null);
        setGameStarted(false);
        waitingScreen.classList.remove('visible');
        waitingScreen.classList.remove('minimized');
        gameCarousel.style.display = 'flex';
        player2ChatName.textContent = 'Oponente';
        player2ChatAvatar.style.display = 'none';
        startGameBtn.style.display = 'none';
        cancelWaitBtn.textContent = 'Cancelar Sala';
        kickOpponentBtn.style.display = 'none';
    };

    // If there's no game ID in the state, just reset the UI and exit.
    // This handles the case for a kicked player whose listener calls this function,
    // or if the function is called multiple times.
    if (!userWaitingGameId || !currentUser) {
        resetUI();
        return;
    }

    try {
        const gameDocRef = doc(db, "games", userWaitingGameId);
        const gameSnap = await getDoc(gameDocRef);

        if (gameSnap.exists()) {
            const gameData = gameSnap.data();
            if (gameData.player1 && gameData.player1.uid === currentUser.uid) {
                // Current user is the owner (player1), delete the game
                await deleteDoc(gameDocRef);
            } else if (gameData.player2 && gameData.player2.uid === currentUser.uid) {
                // Current user is player2, leave the game without deleting it
                await updateDoc(gameDocRef, {
                    player2: null,
                    status: "waiting"
                });
            } else {
                // Fallback: if not player1 or player2, delete to avoid orphaned games
                await deleteDoc(gameDocRef);
            }
        }

        // Finally, always reset the UI for the current user.
        // This is crucial for the kicked player, as their client will run this
        // after the host has already changed the game document.
        resetUI();

    } catch (error) {
        console.error("Error cleaning up waiting game:", error);
        resetUI(); // Also reset UI on error
    }
};
