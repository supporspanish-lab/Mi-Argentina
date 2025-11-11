import { db, collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, arrayUnion, getDoc as getDocFromAuth } from './firebaseService.js';
import { friendSearchView, friendResultView, searchInput, searchBtn, searchError, foundUserAvatarImg, foundUserAvatarSvg, foundUsernameSpan, addFriendBtn, cancelAddFriendBtn, friendRequestsContainer, gameInvitesContainer, friendsListContainer, gameCarousel, waitingScreen, player1ChatName, player1ChatAvatar, player2ChatName, player2ChatAvatar, cancelWaitBtn, startGameBtn, friendRequestBadge } from './domElements.js';
import { getState, setUserWaitingGameId, setLastMessageCount, setGameStarted } from './state.js';
import { setPlayerAvatar } from './utils.js';

export const setupFriendSearch = () => {
    let foundUser = null;

    const searchUser = async () => {
        const { currentUser, currentUserProfile } = getState();
        const searchTerm = searchInput.value.trim();
        searchError.textContent = '';
        if (!searchTerm) return;

        if (searchTerm === currentUser.uid || searchTerm === currentUserProfile.username) {
            searchError.textContent = 'No puedes añadirte a ti mismo.';
            return;
        }

        foundUser = null;

        // 1. Buscar por UID
        try {
            const qById = doc(db, "saldo", searchTerm);
            const querySnapshotById = await getDocFromAuth(qById);
            if (!querySnapshotById.empty) {
                const userDoc = querySnapshotById.docs[0];
                foundUser = { 
                    id: userDoc.id, 
                    uid: userDoc.id, // --- CORRECCIÓN: Añadir uid aquí también
                    ...userDoc.data() 
                };
            }
        } catch (error) {
            console.warn("Búsqueda por UID no produjo resultados, buscando por username...", error);
        }

        // 2. Si no se encontró por UID, buscar por username
        if (!foundUser) {
            const usersRef = collection(db, "saldo");
            const qByUsername = query(usersRef, where("username", "==", searchTerm));
            const querySnapshotByUsername = await getDocs(qByUsername);
            if (!querySnapshotByUsername.empty) {
                const userDoc = querySnapshotByUsername.docs[0];
                foundUser = { 
                    id: userDoc.id, 
                    uid: userDoc.id, // --- CORRECCIÓN: Añadir uid aquí también
                    ...userDoc.data() 
                };
            }
        }

        if (foundUser) {
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
        const { currentUser, currentUserProfile } = getState();
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
                to: foundUser.uid, // Use foundUser.uid here
                toUsername: foundUser.username,
                status: 'pending',
                createdAt: new Date()
            });

            addFriendBtn.textContent = 'Solicitud Enviada';
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
};

export const setupFriendRequestsListener = () => {
    const { currentUser } = getState();
    if (currentUser) setupGameInvitesListener(currentUser.uid); // --- NUEVO: Llamar al listener de invitaciones a partidas
    if (!currentUser) return;

    const requestsRef = collection(db, 'friend_requests');
    const q = query(requestsRef, where('to', '==', currentUser.uid), where('status', '==', 'pending'));

    onSnapshot(q, (snapshot) => {
        // Update badge
        const count = snapshot.size;
        if (count > 0) {
            friendRequestBadge.textContent = count > 99 ? '99+' : count;
            friendRequestBadge.style.display = 'flex';
        } else {
            friendRequestBadge.style.display = 'none';
        }

        // --- MODIFICADO: Limpiar solo el contenido, no el título ---
        const existingItems = friendRequestsContainer.querySelectorAll('.friend-request-item');
        existingItems.forEach(item => item.remove());

        if (snapshot.empty) {
            // Opcional: Mostrar un mensaje si está vacío
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
            // --- MODIFICADO: Añadir después del título ---
            friendRequestsContainer.querySelector('h4').insertAdjacentElement('afterend', requestEl);
        });
    });

    friendRequestsContainer.addEventListener('click', async (e) => {
        const { currentUser } = getState();
        if (e.target.classList.contains('accept-btn')) {
            const requestId = e.target.dataset.id;
            const fromId = e.target.dataset.from;
            const currentUserRef = doc(db, 'saldo', currentUser.uid);
            const friendUserRef = doc(db, 'saldo', fromId);

            try {
                await updateDoc(currentUserRef, {
                    friends: arrayUnion(fromId)
                });
                await updateDoc(friendUserRef, {
                    friends: arrayUnion(currentUser.uid)
                });
                await updateDoc(doc(db, 'friend_requests', requestId), {
                    status: 'accepted'
                });
            } catch (error) {
                console.error("Error accepting friend request: ", error);
            }
        }

        if (e.target.classList.contains('decline-btn')) {
            const requestId = e.target.dataset.id;
            try {
                await updateDoc(doc(db, 'friend_requests', requestId), {
                    status: 'declined'
                });
            } catch (error) {
                console.error("Error declining friend request: ", error);
            }
        }
    });
};

// --- NUEVO: Lógica para escuchar y manejar invitaciones a partidas ---
export const setupGameInvitesListener = (userId) => {
    const invitesRef = collection(db, 'game_invites');
    const q = query(invitesRef, where('toUid', '==', userId), where('status', '==', 'pending'));

    // --- NUEVO: Limpiar el contenedor de invitaciones al inicio ---
    const existingInvites = gameInvitesContainer.querySelectorAll('.game-invite-item');
    existingInvites.forEach(item => item.remove());

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const invite = change.doc.data();
                const inviteId = change.doc.id;
                
                const inviteEl = document.createElement('div');
                inviteEl.className = 'game-invite-item'; // Usamos un estilo específico para invitaciones
                inviteEl.innerHTML = `
                    <div class="game-invite-info">
                        <span class="game-invite-text">
                            <span class="username">${invite.fromUsername}</span> te ha invitado a una partida.
                        </span>
                        ${invite.betAmount > 0 ? `<span class="game-invite-bet">$${invite.betAmount.toLocaleString()}</span>` : ''}
                    </div>
                    <div class="friend-request-actions">
                        <button class="accept-btn" data-invite-id="${inviteId}" data-game-id="${invite.gameId}">Aceptar</button>
                        <button class="decline-btn" data-invite-id="${inviteId}">Rechazar</button>
                    </div>
                `;
                // Añadir al principio del contenedor de solicitudes
                gameInvitesContainer.querySelector('h4').insertAdjacentElement('afterend', inviteEl);
            }
            if (change.type === "removed" || (change.type === "modified" && change.doc.data().status !== 'pending')) {
                const inviteId = change.doc.id;
                // --- MODIFICADO: Buscar en el contenedor correcto ---
                const inviteElement = gameInvitesContainer.querySelector(`[data-invite-id="${inviteId}"]`);
                if (inviteElement) {
                    inviteElement.closest('.game-invite-item').remove();
                }
            }
        });
    });
    // --- MODIFICADO: Listener separado para las invitaciones a partidas ---
    gameInvitesContainer.addEventListener('click', async (e) => {
        const { currentUser, currentUserProfile } = getState();
        if (!currentUser || !currentUserProfile) return;

        if (e.target.matches('.accept-btn[data-game-id]')) {
            const inviteId = e.target.dataset.inviteId;
            const gameId = e.target.dataset.gameId;

            const gameDocRef = doc(db, "games", gameId);
            const gameSnap = await getDocFromAuth(gameDocRef);

            if (!gameSnap.exists() || gameSnap.data().status !== 'waiting') {
                alert('Esta partida ya no está disponible.');
                await updateDoc(doc(db, 'game_invites', inviteId), { status: 'expired' });
                return;
            }

            const gameData = gameSnap.data();
            if (currentUserProfile.balance < gameData.betAmount) {
                alert('No tienes saldo suficiente para unirte a esta partida.');
                return;
            }

            // Unirse a la partida
            await updateDoc(gameDocRef, {
                player2: { uid: currentUser.uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName },
                status: "players_joined"
            });

            // Marcar la invitación como aceptada
            await updateDoc(doc(db, 'game_invites', inviteId), { status: 'accepted' });

            // Mostrar la pantalla de espera
            setUserWaitingGameId(gameId);
            gameCarousel.style.display = 'none';
            waitingScreen.style.display = 'flex';
            player1ChatName.textContent = gameData.player1.username;
            setPlayerAvatar(player1ChatAvatar, gameData.player1.profileImageName);
            player2ChatName.textContent = currentUserProfile.username;
            setPlayerAvatar(player2ChatAvatar, currentUserProfile.profileImageName);
            startGameBtn.style.display = 'none'; // Solo el creador puede iniciar
            cancelWaitBtn.textContent = 'Abandonar Sala';

            // Cerrar el modal de amigos
            document.getElementById('friends-modal').classList.remove('visible');

            // Escuchar cambios en la partida (para cuando el creador la inicie)
            onSnapshot(gameDocRef, (gameSnap) => {
                const updatedGameData = gameSnap.data();
                if (updatedGameData && updatedGameData.status === "starting") {
                    // La lógica para entrar al juego ya está en gameRoomHandlers
                }
            });
        }

        if (e.target.matches('.decline-btn[data-invite-id]')) {
            const inviteId = e.target.dataset.inviteId;
            await updateDoc(doc(db, 'game_invites', inviteId), { status: 'declined' });
        }
    });
};

export const setupFriendsListListener = () => {
    const { currentUser } = getState();
    if (!currentUser) return;

    onSnapshot(doc(db, 'saldo', currentUser.uid), async (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const friendIds = userData.friends || [];
            friendsListContainer.innerHTML = '<h4>Mis Amigos</h4>';

            if (friendIds.length === 0) {
                friendsListContainer.innerHTML += '<p>No tienes amigos todavía.</p>';
                return;
            }

            for (const friendId of friendIds) {
                const friendDocRef = doc(db, "saldo", friendId);
                const friendDocSnap = await getDocFromAuth(friendDocRef);
                if (friendDocSnap.exists()) {
                    const friendData = friendDocSnap.data();
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
};