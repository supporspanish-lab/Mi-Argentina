import { db, collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, arrayUnion } from './firebaseService.js';
import { friendSearchView, friendResultView, searchInput, searchBtn, searchError, foundUserAvatarImg, foundUserAvatarSvg, foundUsernameSpan, addFriendBtn, cancelAddFriendBtn, friendRequestsContainer, friendsListContainer } from './domElements.js';
import { getState } from './state.js';
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
            const qById = query(collection(db, "saldo"), where("uid", "==", searchTerm));
            const querySnapshotById = await getDocs(qById);
            if (!querySnapshotById.empty) {
                foundUser = { id: querySnapshotById.docs[0].id, ...querySnapshotById.docs[0].data() };
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
                foundUser = { id: userDoc.id, ...userDoc.data() };
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
    if (!currentUser) return;

    const requestsRef = collection(db, 'friend_requests');
    const q = query(requestsRef, where('to', '==', currentUser.uid), where('status', '==', 'pending'));

    onSnapshot(q, (snapshot) => {
        friendRequestsContainer.innerHTML = '<h4>Solicitudes</h4>';
        if (snapshot.empty) {
            friendRequestsContainer.innerHTML += '<p>No tienes solicitudes de amistad pendientes.</p>';
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
                const qByFriendId = query(collection(db, "saldo"), where("uid", "==", friendId));
                const friendQuerySnapshot = await getDocs(qByFriendId);
                if (!friendQuerySnapshot.empty) {
                    const friendData = friendQuerySnapshot.docs[0].data();
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