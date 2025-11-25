import { closeMaintenanceModalBtn, maintenanceModal, profilePictureContainer, mainAvatarModal, avatarSelectionModal, closeAvatarSelectionModalBtn, mainCurrentAvatarDisplay, mainCurrentAvatarImg, avatarGrid, betModal, cancelBetBtn, confirmBetBtn, betAmountInput, betErrorMessage, friendsBtn, friendsModal, closeFriendsModalBtn, userFriendIdSpan, copyFriendIdBtn, openWonGamesModalBtn, wonGamesModal, closeWonGamesModalBtn, wonGamesList, infoBtn, infoModal, closeInfoModalBtn, friendChatBtn, friendChatModal, closeFriendChatModalBtn, friendChatList, friendChatArea, friendChatMessages, friendChatInput, sendFriendChatBtn, chatBadge, profileImg, profileSvg } from './domElements.js';
import { updateUserProfile } from '../auth.js';
import { getState, setCurrentUserProfile } from './state.js';
import { isMaintenanceModalOpen } from './utils.js';
import { db, auth, query, where, getDocs, collection, addDoc, onSnapshot, doc, getDoc } from '../auth.js';
import { createGame } from './gameRoomHandlers.js';

export const setupMaintenanceModal = () => {
    closeMaintenanceModalBtn.addEventListener('click', () => {
        maintenanceModal.classList.remove('visible');
        isMaintenanceModalOpen = false;
    });
};

export const setupAvatarModal = () => {
    // Get the span element inside mainCurrentAvatarDisplay
    const mainCurrentAvatarDisplaySpan = mainCurrentAvatarDisplay.querySelector('span');

    // Open main avatar modal when profile picture container is clicked
    profilePictureContainer.addEventListener('click', () => {
        mainAvatarModal.classList.add('visible');
        // Set current avatar image in the main avatar modal
        const { currentUserProfile } = getState();
        if (currentUserProfile && currentUserProfile.profileImageName) {
            mainCurrentAvatarImg.src = `../imajenes/perfil/${currentUserProfile.profileImageName}`;
            mainCurrentAvatarImg.style.display = 'block';
        } else {
            mainCurrentAvatarImg.src = ''; // Clear src if no image
            mainCurrentAvatarImg.style.display = 'none';
        }
        mainCurrentAvatarDisplaySpan.style.display = 'block'; // Show "Haz clic para cambiar"
    });

    // Close main avatar modal when clicking outside
    mainAvatarModal.addEventListener('click', (e) => {
        if (e.target === mainAvatarModal) {
            mainAvatarModal.classList.remove('visible');
        }
    });

    // Open avatar selection modal when mainCurrentAvatarDisplay is clicked
    mainCurrentAvatarDisplay.addEventListener('click', () => {
        avatarSelectionModal.classList.add('visible');
        // Hide "Haz clic para cambiar" when avatar selection modal is open
        mainCurrentAvatarDisplaySpan.style.display = 'none';
    });

    // Close avatar selection modal
    closeAvatarSelectionModalBtn.addEventListener('click', () => {
        avatarSelectionModal.classList.remove('visible');
        // Show "Haz clic para cambiar" again when avatar selection modal closes
        mainCurrentAvatarDisplaySpan.style.display = 'block';
    });

    const TOTAL_AVATARS = 107;
    for (let i = 1; i <= TOTAL_AVATARS; i++) {
        const img = document.createElement('img');
        const imgPath = `../imajenes/perfil/${i}.jpg`;
        img.src = imgPath;
        img.className = 'avatar-option';
        img.alt = `Avatar ${i}`;
        img.dataset.path = imgPath;
        img.addEventListener('click', () => {
            const { currentUser, currentUserProfile } = getState();
            if (!currentUser) {
                console.error("Usuario no logueado. No se puede cambiar la foto.");
                return;
            }
            const selectedPath = img.dataset.path;
            const imageName = selectedPath.split('/').pop();

            updateUserProfile(currentUser.uid, { profileImageName: imageName });

            // Update header avatar immediately
            profileImg.src = selectedPath;
            profileImg.style.display = 'block';
            profileSvg.style.display = 'none';
            profileImg.onerror = () => {
                profileImg.style.display = 'none';
                profileSvg.style.display = 'block';
            };

            // Update state
            if (currentUserProfile) {
                currentUserProfile.profileImageName = imageName;
                setCurrentUserProfile(currentUserProfile);
            }

            mainCurrentAvatarImg.src = selectedPath; // Update the displayed current avatar in main modal
            mainCurrentAvatarImg.style.display = 'block';
            avatarSelectionModal.classList.remove('visible'); // Close avatar selection modal
            mainCurrentAvatarDisplaySpan.style.display = 'block'; // Show "Haz clic para cambiar" again
            mainAvatarModal.classList.remove('visible'); // Close the main avatar modal after selection
        });
        avatarGrid.appendChild(img);
    }
};

export const setupBetModal = (createGameCallback) => {
    cancelBetBtn.addEventListener('click', () => {
        betModal.classList.remove('visible');
    });
    betModal.addEventListener('click', (e) => {
        if (e.target === betModal) {
            betModal.classList.remove('visible');
        }
    });

    confirmBetBtn.onclick = async () => {
        const { currentUserProfile } = getState();
        const betAmount = parseFloat(betAmountInput.value);
        const isPrivate = document.getElementById('private-room-checkbox').checked;

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

        await createGameCallback(betAmount, isPrivate);

        betModal.classList.remove('visible');
        confirmBetBtn.disabled = false;
        confirmBetBtn.textContent = 'Confirmar Apuesta';
    };
};

export const setupFriendsModal = () => {
    friendsBtn.addEventListener('click', () => {
        friendsModal.classList.add('visible');
        const { currentUser } = getState();
        if (currentUser && userFriendIdSpan) {
            userFriendIdSpan.textContent = currentUser.uid;
        }
    });

    copyFriendIdBtn.addEventListener('click', async () => {
        const { currentUser } = getState();
        if (currentUser && currentUser.uid) {
            try {
                await navigator.clipboard.writeText(currentUser.uid);
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

    closeFriendsModalBtn.addEventListener('click', () => {
        friendsModal.classList.remove('visible');
    });

    friendsModal.addEventListener('click', (e) => {
        if (e.target === friendsModal) {
            friendsModal.classList.remove('visible');
        }
    });
};


export const setupWonGamesModal = () => {
    // Open won games modal
    openWonGamesModalBtn.addEventListener('click', () => {
        wonGamesModal.classList.add('visible');
        loadGameHistory();
    });

    // Close won games modal
    closeWonGamesModalBtn.addEventListener('click', () => {
        wonGamesModal.classList.remove('visible');
    });

    // Close on click outside
    wonGamesModal.addEventListener('click', (e) => {
        if (e.target === wonGamesModal) {
            wonGamesModal.classList.remove('visible');
        }
    });
};

export const setupInfoModal = () => {
    // Open info modal
    infoBtn.addEventListener('click', () => {
        infoModal.classList.add('visible');
    });

    // Close info modal (only if button exists)
    if (closeInfoModalBtn) {
        closeInfoModalBtn.addEventListener('click', () => {
            infoModal.classList.remove('visible');
        });
    }

    // Close on click outside
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.classList.remove('visible');
        }
    });
};

const loadGameHistory = async () => {
    wonGamesList.innerHTML = '<p>Cargando...</p>';
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            wonGamesList.innerHTML = '<p>No has iniciado sesión.</p>';
            return;
        }
        // Consultar partidas ganadas
        const qWon = query(collection(db, "gameHistory"), where("winnerUid", "==", currentUser.uid));
        const wonSnapshot = await getDocs(qWon);
        // Consultar partidas perdidas
        const qLost = query(collection(db, "gameHistory"), where("loserUid", "==", currentUser.uid));
        const lostSnapshot = await getDocs(qLost);

        // Combinar resultados
        const games = [];
        wonSnapshot.forEach((doc) => {
            const data = doc.data();
            games.push({ ...data, type: 'won' });
        });
        lostSnapshot.forEach((doc) => {
            const data = doc.data();
            games.push({ ...data, type: 'lost' });
        });

        // Ordenar por fecha descendente
        games.sort((a, b) => b.date - a.date);

        wonGamesList.innerHTML = '';
        if (games.length === 0) {
            wonGamesList.innerHTML = '<p>No hay partidas registradas aún.</p>';
        } else {
            games.forEach((data) => {
                const item = document.createElement('div');
                item.className = 'won-game-item';
                const amount = data.type === 'won' ? data.amountWon : data.amountLost;
                const result = data.type === 'won' ? 'Ganó' : 'Perdió';
                item.textContent = `${result} $${amount} el ${new Date(data.date).toLocaleDateString()}`;
                wonGamesList.appendChild(item);
            });
        }
    } catch (error) {
        console.error('Error al cargar historial de partidas:', error);
        wonGamesList.innerHTML = '<p>Error al cargar las partidas.</p>';
    }
};

let currentChatFriend = null;
export let messagesUnsubscribe = null; // Export for potential external cleanup
let globalMessagesUnsubscribe = null;
let unreadMessages = new Map();
let lastSeen = new Map();

const LAST_SEEN_KEY = 'friendChatLastSeen';

// Load lastSeen from localStorage
const storedLastSeen = localStorage.getItem(LAST_SEEN_KEY);
if (storedLastSeen) {
    lastSeen = new Map(JSON.parse(storedLastSeen));
}

export function updateBadge() {
    const total = Array.from(unreadMessages.values()).reduce((a, b) => a + b, 0);
    if (total > 0) {
        chatBadge.textContent = total > 99 ? '99+' : total;
        chatBadge.style.display = 'flex';
    } else {
        chatBadge.style.display = 'none';
    }
}

export function startGlobalMessageListener(currentUser) {
    if (!currentUser || globalMessagesUnsubscribe) return;
    const q = query(
        collection(db, "friendMessages"),
        where("participants", "array-contains", currentUser.uid)
    );
    globalMessagesUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                if (data.from !== currentUser.uid && data.timestamp > (lastSeen.get(data.from) || 0)) {
                    unreadMessages.set(data.from, (unreadMessages.get(data.from) || 0) + 1);
                    updateBadge();
                    // Play sound for new message
                    const audio = new Audio('../audio/mensaje.mp3');
                    audio.play().catch(err => console.log('Audio play failed:', err));
                }
            }
        });
    });
}

export const setupFriendChatModal = () => {
    friendChatBtn.addEventListener('click', () => {
        friendChatModal.classList.add('visible');
        loadFriendsForChat();
    });

    closeFriendChatModalBtn.addEventListener('click', () => {
        friendChatModal.classList.remove('visible');
        friendChatArea.style.display = 'none';
        friendChatList.style.display = 'block';
        if (messagesUnsubscribe) {
            messagesUnsubscribe();
            messagesUnsubscribe = null;
        }
        currentChatFriend = null;
    });

    friendChatModal.addEventListener('click', (e) => {
        if (e.target === friendChatModal) {
            friendChatModal.classList.remove('visible');
            friendChatArea.style.display = 'none';
            friendChatList.style.display = 'block';
            if (messagesUnsubscribe) {
                messagesUnsubscribe();
                messagesUnsubscribe = null;
            }
            currentChatFriend = null;
        }
    });

    sendFriendChatBtn.addEventListener('click', sendFriendMessage);
    friendChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendFriendMessage();
    });
};

const loadFriendsForChat = async () => {
    friendChatList.innerHTML = '<p>Cargando amigos...</p>';
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            friendChatList.innerHTML = '<p>No has iniciado sesión.</p>';
            return;
        }
        const userDoc = await getDoc(doc(db, "saldo", currentUser.uid));
        if (!userDoc.exists()) {
            friendChatList.innerHTML = '<p>No se encontró tu perfil.</p>';
            return;
        }
        const userData = userDoc.data();
        const friendIds = userData.friends || [];
        friendChatList.innerHTML = '';
        if (friendIds.length === 0) {
            friendChatList.innerHTML = '<p>No tienes amigos para chatear.</p>';
            return;
        }
        for (const friendId of friendIds) {
            const friendDoc = await getDoc(doc(db, "saldo", friendId));
            if (friendDoc.exists()) {
                const friendData = friendDoc.data();
                const friendEl = document.createElement('div');
                friendEl.className = 'friend-chat-item';
                friendEl.dataset.friendId = friendId;
                let avatarHtml = '';
                if (friendData.profileImageName) {
                    avatarHtml = `<img src="../imajenes/perfil/${friendData.profileImageName}" alt="Avatar">`;
                } else {
                    avatarHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;
                }
                const unreadCount = unreadMessages.get(friendId) || 0;
                const badgeHtml = unreadCount > 0 ? `<span class="friend-unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : '';
                friendEl.innerHTML = `
                    <div class="friend-avatar">${avatarHtml}</div>
                    <span class="friend-name">${friendData.username}</span>
                    ${badgeHtml}
                `;
                friendEl.addEventListener('click', () => selectFriendForChat(friendId, friendData.username));
                friendChatList.appendChild(friendEl);
            }
        }
    } catch (error) {
        console.error('Error al cargar amigos:', error);
        friendChatList.innerHTML = '<p>Error al cargar amigos.</p>';
    }
};

const selectFriendForChat = (friendId, friendName) => {
    currentChatFriend = friendId;
    friendChatList.style.display = 'none';
    friendChatArea.style.display = 'block';
    // Reset unread for this friend
    unreadMessages.set(friendId, 0);
    lastSeen.set(friendId, Date.now());
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(Array.from(lastSeen.entries())));
    updateBadge();
    loadMessages();
};

const loadMessages = () => {
    if (!currentChatFriend) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const q = query(
        collection(db, "friendMessages"),
        where("participants", "array-contains", currentUser.uid)
    );
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        friendChatMessages.innerHTML = '';
        const messages = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if ((data.from === currentUser.uid && data.to === currentChatFriend) ||
                (data.from === currentChatFriend && data.to === currentUser.uid)) {
                messages.push(data);
            }
        });
        messages.sort((a, b) => a.timestamp - b.timestamp);
        messages.forEach((msg) => {
            const msgEl = document.createElement('div');
            msgEl.className = 'chat-message ' + (msg.from === currentUser.uid ? 'self' : 'opponent');
            msgEl.innerHTML = `<span class="message-sender">${msg.from === currentUser.uid ? 'Tú' : 'Amigo'}:</span> ${msg.text}`;
            friendChatMessages.appendChild(msgEl);
        });
        friendChatMessages.scrollTop = friendChatMessages.scrollHeight;
    });
};

const sendFriendMessage = async () => {
    const message = friendChatInput.value.trim();
    if (message && currentChatFriend) {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        try {
            await addDoc(collection(db, "friendMessages"), {
                from: currentUser.uid,
                to: currentChatFriend,
                text: message,
                timestamp: Date.now(),
                participants: [currentUser.uid, currentChatFriend]
            });
            friendChatInput.value = '';
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
        }
    }
};


