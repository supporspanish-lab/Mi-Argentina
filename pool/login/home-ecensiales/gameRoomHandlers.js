import { db, collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, arrayUnion, deleteDoc, getDoc } from './firebaseService.js';
import { appContainer, gameContainer, gameIframe, gameCarousel, waitingScreen, cancelWaitBtn, startGameBtn, kickOpponentBtn, chatMessagesContainer, chatMessageInput, sendChatMessageBtn, player1ChatName, player2ChatName, player1ChatAvatar, player2ChatAvatar, betModal, betAmountInput, betErrorMessage, leftChatButton, inviteFriendsModal, inviteFriendsListContainer, closeInviteFriendsModalBtn } from './domElements.js';
import { getState, setUserWaitingGameId, setLastMessageCount, setPollingIntervalId, stopPolling, setGameStarted, getSalas, setSalas } from './state.js';
import { setPlayerAvatar, renderMessages, cleanupWaitingGame, fetchUserProfile } from './utils.js';
import { updateUserProfile } from '../auth.js';
import { getBackgroundAudio } from './home.js';

export const endGame = () => {
    const audio = getBackgroundAudio();
    if (audio && audio.paused) {
        audio.play().catch(e => console.warn("Could not resume audio:", e));
    }

    // Show home UI, hide game UI
    appContainer.style.display = 'block';
    gameContainer.style.display = 'none';
    gameIframe.src = 'about:blank';

    // --- FIX: Hide the waiting screen ---
    waitingScreen.classList.remove('visible');

    // Reset state
    setGameStarted(false);
    setUserWaitingGameId(null);

    // The 'focus' event listener in home.html will handle showing the modal.
    // I'll also trigger it manually for speed.
    window.dispatchEvent(new Event('focus'));
};

const startGameFullscreen = (gameId, isSpectator = false) => {
    const audio = getBackgroundAudio();
    if (audio) {
        audio.pause();
    }

    appContainer.style.display = 'none'; // Hide the home.html UI
    gameIframe.src = `../index.html?gameId=${gameId}${isSpectator ? '&spectator=true' : ''}`; // Set iframe source with spectator flag
    gameContainer.style.display = 'block'; // Show the game container
};

const STALE_GAME_MINUTES = 10;

const STALE_STARTED_GAME_MINUTES = 30; // Juegos iniciados sin terminar después de 30 min se eliminan

export const purgeStaleGames = async () => {
    try {
        const gamesRef = collection(db, "games");
        const waitingGamesQuery = query(gamesRef, where("status", "==", "waiting"), where("player2", "==", null));
        const snapshot = await getDocs(waitingGamesQuery);
        const now = new Date();
        const promises = [];
        snapshot.forEach(docSnap => {
            const gameData = docSnap.data();
            const createdAt = gameData.createdAt?.toDate();
            if (createdAt) {
                const minutesDiff = (now - createdAt) / (1000 * 60);
                if (minutesDiff > STALE_GAME_MINUTES) {
                    promises.push(deleteDoc(doc(db, "games", docSnap.id)));
                }
            }
        });
        await Promise.all(promises);
    } catch (error) {
        console.error("Error al purgar partidas antiguas:", error);
    }
};

export const purgeStaleStartedGames = async () => {
    try {
        const gamesRef = collection(db, "games");
        const startedGamesQuery = query(gamesRef, where("status", "in", ["starting", "players_joined"]));
        const snapshot = await getDocs(startedGamesQuery);
        const now = new Date();
        const promises = [];
        snapshot.forEach(docSnap => {
            const gameData = docSnap.data();
            const createdAt = gameData.createdAt?.toDate();
            if (createdAt) {
                const minutesDiff = (now - createdAt) / (1000 * 60);
                if (minutesDiff > STALE_STARTED_GAME_MINUTES) {
                    promises.push(deleteDoc(doc(db, "games", docSnap.id)));
                }
            }
        });
        await Promise.all(promises);
    } catch (error) {
        console.error("Error al purgar partidas iniciadas antiguas:", error);
    }
};

export const createGame = async (betAmount, isPrivate = false) => {
    const { currentUser, currentUserProfile } = getState();
    if (!currentUser || !currentUserProfile) return;

    const gamesRef = collection(db, "games");

    // Eliminar salas anteriores del usuario que están esperando
    const oldGamesQuery = query(gamesRef, where("player1.uid", "==", currentUser.uid), where("status", "==", "waiting"));
    const oldGamesSnap = await getDocs(oldGamesQuery);
    const deletePromises = oldGamesSnap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    const ballPositions = [];
    const RACK_SPACING_DIAMETER = 40;
    const TABLE_WIDTH = 1000;
    const TABLE_HEIGHT = 500;
    const startX = TABLE_WIDTH * 0.65;
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

    // Removed balance check as per user request
    // if (currentUserProfile.balance < betAmount) {
    //     betErrorMessage.textContent = 'No tienes saldo suficiente para crear esta partida.';
    //     betModal.classList.add('visible');
    //     return;
    // }

    // Removed balance deduction as per user request
    // const player1BalanceTransaction = {
    //     amount: -betAmount,
    //     type: 'bet',
    //     gameId: null,
    //     timestamp: new Date()
    // };

    // await updateUserProfile(currentUser.uid, {
    //     balance: currentUserProfile.balance - betAmount,
    //     transactions: arrayUnion(player1BalanceTransaction)
    // });

    const newGameRef = await addDoc(collection(db, "games"), {
        player1: { uid: currentUser.uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName || null },
        player2: null,
        status: "waiting",
        createdAt: new Date(),
        currentPlayerUid: null,
        balls: ballPositions,
        turn: 1,
        betAmount: betAmount,
        isPrivate: isPrivate,
        isPractice: false,
        balancesDeducted: false,
        spectators: []
    });

    setUserWaitingGameId(newGameRef.id);

    waitingScreen.classList.add('visible');
    player1ChatName.textContent = currentUserProfile.username;
    setPlayerAvatar(player1ChatAvatar, currentUserProfile.profileImageName);
    player2ChatName.textContent = 'Oponente';
    player2ChatAvatar.style.display = 'none';
    cancelWaitBtn.textContent = 'Cancelar Sala';
    startGameBtn.style.display = 'none';
    kickOpponentBtn.style.display = 'none';

    onSnapshot(doc(db, "games", newGameRef.id), (gameSnap) => {
        const gameData = gameSnap.data();
        if (gameData) {
            if (gameData.status === "players_joined" && gameData.player2) {
                player2ChatName.textContent = gameData.player2.username;
                setPlayerAvatar(player2ChatAvatar, gameData.player2.profileImageName);
                startGameBtn.style.display = 'block';
                cancelWaitBtn.textContent = 'Cancelar Partida';
                kickOpponentBtn.style.display = 'block';
            } else if (gameData.status === "starting") {
                const { gameStarted } = getState();
                if (!gameStarted) {
                    setGameStarted(true);
                    startGameFullscreen(newGameRef.id);
                }
                // Fallback: force start after 5 seconds if not started
                setTimeout(() => {
                    if (!getState().gameStarted) {
                        setGameStarted(true);
                        startGameFullscreen(newGameRef.id);
                    }
                }, 5000);
            } else if (gameData.status === "waiting") {
                player2ChatName.textContent = 'Oponente';
                player2ChatAvatar.style.display = 'none';
                startGameBtn.style.display = 'none';
                cancelWaitBtn.textContent = 'Cancelar Sala';
                kickOpponentBtn.style.display = 'none';
            }
            renderMessages(gameData.messages, chatMessagesContainer);
            setLastMessageCount(gameData.messages ? gameData.messages.length : 0);
        } else {
            cleanupWaitingGame();
        }
    });
};

export const createPracticeGame = async () => {
    const { currentUser, currentUserProfile } = getState();
    if (!currentUser || !currentUserProfile) return;

    const gamesRef = collection(db, "games");
    const ballPositions = [];
    const RACK_SPACING_DIAMETER = 36;
    const TABLE_WIDTH = 1000;
    const TABLE_HEIGHT = 500;
    const startX = TABLE_WIDTH * 0.65;
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

    const newGameRef = await addDoc(collection(db, "games"), {
        player1: { uid: currentUser.uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName || null },
        player2: { uid: currentUser.uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName || null },
        status: "starting",
        createdAt: new Date(),
        currentPlayerUid: currentUser.uid,
        balls: ballPositions,
        turn: 1,
        betAmount: 0,
        isPrivate: true,
        isPractice: true,
        practiceMoneyGain: 1,
        twoTurnsAsOne: true,
        balancesDeducted: false,
        player1BalanceTransaction: null,
        spectators: []
    });
setUserWaitingGameId(newGameRef.id);
    setGameStarted(true);
    startGameFullscreen(newGameRef.id);
};

export const setupStartGameButton = () => {
    startGameBtn.onclick = async () => {
        const { userWaitingGameId } = getState();
        if (confirm('¿Estás seguro de que quieres iniciar la partida?')) {
            if (userWaitingGameId) {
                const gameDocRef = doc(db, "games", userWaitingGameId);
                await updateDoc(gameDocRef, { status: "starting" });
            }
        }
    };
};

const createGameCard = (gameData) => {
    const { currentUser, currentUserProfile } = getState();
    if (!currentUser || !currentUserProfile) return null;

    const card = document.createElement('div');
    card.className = 'game-card active';
    card.dataset.gameId = gameData.id;

    const p1Avatar = gameData.createdBy?.photoURL || (gameData.player1?.profileImageName ? `../imajenes/perfil/${gameData.player1.profileImageName}` : './home-ecensiales/avatar-placeholder.svg');
    const p1Username = gameData.createdBy?.displayName || gameData.player1?.username || 'Jugador 1';

    const p2AvatarSimulated = gameData.player2?.profileImageName ? `../imajenes/perfil/${gameData.player2.profileImageName}` : './home-ecensiales/avatar-placeholder.svg';
    const p2UsernameSimulated = gameData.player2?.username || 'Jugador 2';

    let cardHTML = '';

    if (gameData.isSimulated) {
        let statusText, statusColor, cursor = 'default', onClickAction = null;
        if (gameData.status === 'waiting') {
            statusText = 'Unirse';
            statusColor = '#2ecc71';
        } else if (gameData.status === 'starting' || gameData.status === 'players_joined') {
            statusText = 'En Partida';
            statusColor = '#2ecc71';
            cursor = 'pointer';
            onClickAction = () => alert('Otra persona ya se está sincronizando a la sala.');
        } else if (gameData.status === 'ended') {
            statusText = 'Terminada';
            statusColor = '#95a5a6';
        } else {
            statusText = 'En Partida';
            statusColor = '#2ecc71';
        }
        const p2Display = gameData.status === 'waiting' ?
            `<div class="player-avatar-card" style="background-color: #2c3e50; border-style: dashed;"></div><span class="player-name-active" style="opacity: 0.6;">Esperando...</span>` :
            `<img src="${p2AvatarSimulated}" alt="${p2UsernameSimulated}" class="player-avatar-card"><span class="player-name-active">${p2UsernameSimulated}</span>`;
        const betDisplay = (gameData.betAmount > 0 && gameData.status === 'waiting') ? `
            <div class="card-bet-amount">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm1.5-3.845V11h-3v-1.034c.96.124 1.51.278 1.51.794 0 .516-.544.69-1.51.825V12.5h3v-1.033c-.967-.125-1.51-.28-1.51-.795 0-.515.543-.69 1.51-.825V8.5h-3V7.5h3v1.033c.96.124 1.51.278 1.51.794 0 .516-.544.69-1.51.825z"/></svg>
                <span>$${gameData.betAmount.toLocaleString()}</span>
            </div>
        ` : '';
        const statusDisplay = gameData.status === 'waiting' ? `<div class="card-game-details">${betDisplay}<span class="card-status-active" style="color: ${statusColor}; font-weight: bold; cursor: ${cursor};">${statusText}</span></div>` : `<div class="card-game-details"><span class="card-status-active" style="color: ${statusColor}; font-weight: bold;">${statusText}</span></div>`;
        cardHTML = `
            <div class="active-card-content">
                <div class="card-active-players">
                    <div class="player-avatar-container">
                        <img src="${p1Avatar}" alt="${p1Username}" class="player-avatar-card">
                        <span class="player-name-active">${p1Username}</span>
                    </div>
                    <span class="vs-separator">vs</span>
                    <div class="player-avatar-container">
                        ${p2Display}
                    </div>
                </div>
                ${statusDisplay}
            </div>
        `;
    } else {
        const p2Avatar = gameData.player2?.profileImageName ? `../imajenes/perfil/${gameData.player2.profileImageName}` : './home-ecensiales/avatar-placeholder.svg';
        const p2Username = gameData.player2?.username || 'Esperando...';
        const isUserPlayer1 = gameData.player1.uid === currentUser.uid;
        const canJoin = gameData.status === 'waiting' && !gameData.player2 && !isUserPlayer1;
        const isUserInGame = isUserPlayer1 || (gameData.player2 && gameData.player2.uid === currentUser.uid);

        let statusText, statusColor, cursor, onClickAction;

        if (canJoin) {
            statusText = 'Unirse';
            statusColor = '#3498db';
            cursor = 'pointer';
            onClickAction = () => joinGameAndSetupListener(gameData);
        } else if (gameData.status === 'starting' || gameData.status === 'players_joined') {
            statusText = isUserInGame ? 'En tu sala' : 'Espectar';
            statusColor = isUserInGame ? '#3498db' : '#f39c12';
            cursor = isUserInGame ? 'default' : 'pointer';
            onClickAction = isUserInGame ? null : () => spectateGame(gameData);
        } else if (gameData.status === 'ended') {
            statusText = 'Terminada';
            statusColor = '#95a5a6';
            cursor = 'default';
        } else { // waiting
            statusText = isUserInGame ? 'En tu sala' : 'Esperando';
            statusColor = '#bdc3c7';
            cursor = 'default';
        }

        cardHTML = `
            <div class="active-card-content">
                <div class="card-active-players">
                    <div class="player-avatar-container">
                        <img src="${p1Avatar}" alt="${p1Username}" class="player-avatar-card">
                        <span class="player-name-active">${p1Username}</span>
                    </div>
                    <span class="vs-separator">vs</span>
                    <div class="player-avatar-container">
                        ${gameData.player2 ? `<img src="${p2Avatar}" alt="${p2Username}" class="player-avatar-card">` : `<div class="player-avatar-card" style="background-color: #2c3e50; border-style: dashed;"></div>`}
                        <span class="player-name-active" style="opacity: ${gameData.player2 ? 1 : 0.6};">${p2Username}</span>
                    </div>
                </div>
                <div class="card-game-details">
                    ${gameData.betAmount > 0 && gameData.status === 'waiting' ? `
                    <div class="card-bet-amount">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm1.5-3.845V11h-3v-1.034c.96.124 1.51.278 1.51.794 0 .516-.544.69-1.51.825V12.5h3v-1.033c-.967-.125-1.51-.28-1.51-.795 0-.515.543-.69 1.51-.825V8.5h-3V7.5h3v1.033c.96.124 1.51.278 1.51.794 0 .516-.544.69-1.51.825z"/></svg>
                        <span>$${gameData.betAmount.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="card-status-active" style="color: ${statusColor}; font-weight: bold; cursor: ${cursor};">${statusText}</div>
                    ${gameData.status === 'ended' ? `<div style="color: #27ae60; font-size: 12px;">Ganador: ${gameData.winnerUsername}</div>` : ''}
                </div>
            </div>
        `;
        if (onClickAction) {
            card.addEventListener('click', onClickAction);
        }
    }

    card.innerHTML = cardHTML;
    // Re-add event listener if it was an action card
    if (card.querySelector('.card-status-active')?.textContent === 'Unirse') {
        card.addEventListener('click', card.onclick);
    }
    return card;
};

// --- NUEVO: Función para espectar una partida ---
export const spectateGame = async (gameData) => {
    const { currentUser, currentUserProfile } = getState();
    if (!currentUser || !currentUserProfile) return;

    if (!confirm('¿Quieres espectar esta partida? No podrás jugar, solo observar.')) return;

    const gameDocRef = doc(db, "games", gameData.id);
    const gameSnap = await getDoc(gameDocRef);

    if (!gameSnap.exists() || (gameSnap.data().status !== "starting" && gameSnap.data().status !== "players_joined")) {
        alert('Esta partida ya no está disponible para espectar.');
        return;
    }

    // Agregar al usuario como espectador
    await updateDoc(gameDocRef, {
        spectators: arrayUnion({ uid: currentUser.uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName || null })
    });

    // Iniciar el juego en modo espectador
    startGameFullscreen(gameData.id, true); // true para spectator
};

// --- NUEVO: Función para unirse a una partida y configurar el listener ---
const joinGameAndSetupListener = async (gameData) => {
    const { currentUser, currentUserProfile } = getState();
    if (!currentUser || !currentUserProfile) return;

    const gameDocRef = doc(db, "games", gameData.id);
    const gameSnap = await getDoc(gameDocRef);

    if (!gameSnap.exists() || gameSnap.data().status !== 'waiting') {
        alert('Esta partida ya no está disponible.');
        return;
    }

    // Actualizar el documento del juego para añadir al jugador 2
    await updateDoc(gameDocRef, {
        player2: { uid: currentUser.uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName || null },
        status: "players_joined",
        currentPlayerUid: Math.random() < 0.5 ? gameData.player1.uid : currentUser.uid,
    });

    setUserWaitingGameId(gameData.id);

    // --- Lógica de UI para el jugador que se une ---
    const globalGamesSection = document.getElementById('global-games-section');
    if(globalGamesSection) globalGamesSection.style.display = 'none';
    
    waitingScreen.classList.add('visible'); // ¡Esta es la corrección clave!

    // Configurar la UI del chat con la información de ambos jugadores
    player1ChatName.textContent = gameData.player1.username;
    setPlayerAvatar(player1ChatAvatar, gameData.player1.profileImageName);
    player2ChatName.textContent = currentUserProfile.username;
    setPlayerAvatar(player2ChatAvatar, currentUserProfile.profileImageName);
    
    cancelWaitBtn.textContent = 'Salir';
    startGameBtn.style.display = 'none'; // El creador inicia la partida
    kickOpponentBtn.style.display = 'none'; // No se puede expulsar a sí mismo

    // Configurar el listener para futuras actualizaciones (inicio de partida, chat, etc.)
    onSnapshot(gameDocRef, (gameSnap) => {
        const updatedGameData = gameSnap.data();
        if (updatedGameData) {
            if (updatedGameData.status === "starting") {
                // Automatically start the game for player 2
                const { gameStarted } = getState();
                if (!gameStarted) {
                    setGameStarted(true);
                    startGameFullscreen(gameData.id);
                }
                
                // Fallback: force start after 5 seconds if not started
                setTimeout(() => {
                    if (!getState().gameStarted) {
                        setGameStarted(true);
                        startGameFullscreen(gameData.id);
                    }
                }, 5000);

                // Keep the button as a fallback, as requested by the user.
                startGameBtn.style.display = 'block';
                startGameBtn.textContent = 'Jugar';
                startGameBtn.onclick = () => {
                    // This allows re-entering the game if the user somehow navigates away
                    startGameFullscreen(gameData.id);
                };
            }
            renderMessages(updatedGameData.messages, chatMessagesContainer);
            setLastMessageCount(updatedGameData.messages ? updatedGameData.messages.length : 0);
        } else {
            cleanupWaitingGame(); // La partida fue cancelada o eliminada
        }
    });
};

export const displaySalas = (allRooms) => {
    const { currentUser } = getState();
    const globalGamesList = document.getElementById('global-games-list');

    if (!globalGamesList || !currentUser) return;

    globalGamesList.innerHTML = '';

    // --- CORRECCIÓN: Cambiar la lógica de ordenación ---
    // 1. Tu sala en espera primero.
    // 2. Otras salas en espera.
    // 3. El resto de salas por fecha.
    allRooms.sort((a, b) => {
        const aIsMyWaitingRoom = a.status === "waiting" && a.player1?.uid === currentUser.uid;
        const bIsMyWaitingRoom = b.status === "waiting" && b.player1?.uid === currentUser.uid;
        if (aIsMyWaitingRoom) return -1; // La sala 'a' es mi sala en espera, va primero.
        if (bIsMyWaitingRoom) return 1;  // La sala 'b' es mi sala en espera, va primero.

        const aIsWaiting = a.status === "waiting";
        const bIsWaiting = b.status === "waiting";
        if (aIsWaiting && !bIsWaiting) return -1; // Cualquier otra sala en espera va antes que las que están en partida.
        if (!aIsWaiting && bIsWaiting) return 1;

        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    allRooms.forEach(gameData => {
        const card = createGameCard(gameData);
        if (card) globalGamesList.appendChild(card);
    });
};

export const updateGameLists = async () => {
    const { currentUser, userWaitingGameId } = getState();
    if (!currentUser) return;

    if (waitingScreen.classList.contains('visible') && userWaitingGameId) {
        return;
    }

    // Add vertical options
    const verticalList = document.getElementById('vertical-options-list');
    if (verticalList) {
        if (!verticalList.querySelector('.create-new')) {
            const createCard = document.createElement('div');
            createCard.className = 'game-card create-new';
            createCard.innerHTML = `<img src="../video/crear.png" alt="Crear Partida" class="create-icon"><span class="create-text">Crear Partida</span>`;
            createCard.addEventListener('click', () => {
                const betModal = document.getElementById('bet-modal');
                const betAmountInput = document.getElementById('bet-amount-input');
                const betErrorMessage = document.getElementById('bet-error-message');
                betAmountInput.value = '1000';
                betErrorMessage.textContent = '';
                betModal.classList.add('visible');
            });
            verticalList.appendChild(createCard);
        }
        if (!verticalList.querySelector('.practice-game')) {
            const practiceCard = document.createElement('div');
            practiceCard.className = 'game-card practice-game';
            practiceCard.innerHTML = `<img src="../video/practica.png" alt="Practica" class="create-icon"><span class="create-text">Practica</span>`;
            practiceCard.addEventListener('click', () => createPracticeGame());
            verticalList.appendChild(practiceCard);
        }
    }

    // Purge stale games
    await purgeStaleGames();
    await purgeStaleStartedGames();

    try {
        const gamesRef = collection(db, "games");
        const q = query(gamesRef, where("isPrivate", "==", false), where("isPractice", "==", false), where("status", "in", ["waiting", "starting", "players_joined"]));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const realGames = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const simulatedRooms = getSalas().filter(sala => sala.isSimulated);
            
            const allRooms = [...realGames, ...simulatedRooms];
            setSalas(allRooms);
            displaySalas(allRooms);
        });
        
        // We need to store this unsubscribe function somewhere to call it when the user logs out.
        // For now, we'll just let it run.

    } catch (error) {
        console.error("Error al obtener la lista de partidas:", error);
    }
};


export const setupGameRoomListeners = () => {
    kickOpponentBtn.addEventListener('click', async () => {
        const { userWaitingGameId } = getState();
        if (userWaitingGameId && confirm('¿Estás seguro de que quieres expulsar a este jugador?')) {
            const gameDocRef = doc(db, "games", userWaitingGameId);
            await updateDoc(gameDocRef, { player2: null, status: "waiting" });
        }
    });

    const sendMessage = async () => {
        const { currentUser, currentUserProfile, userWaitingGameId } = getState();
        const messageText = chatMessageInput.value.trim();
        if (messageText && userWaitingGameId && currentUser) {
            const gameDocRef = doc(db, "games", userWaitingGameId);
            const message = { uid: currentUser.uid, username: currentUserProfile.username, text: messageText, timestamp: new Date() };
            await updateDoc(gameDocRef, { messages: arrayUnion(message) });
            chatMessageInput.value = '';
        }
    };

    sendChatMessageBtn.addEventListener('click', sendMessage);
    chatMessageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });


    waitingScreen.addEventListener('click', (e) => {
        if (waitingScreen.classList.contains('minimized')) {
            waitingScreen.classList.remove('minimized');
        }
    });

    cancelWaitBtn.addEventListener('click', () => cleanupWaitingGame());

    leftChatButton.addEventListener('click', async () => {
        const { currentUserProfile } = getState();
        if (!currentUserProfile || !currentUserProfile.friends) {
            inviteFriendsListContainer.innerHTML = '<p>No tienes amigos para invitar.</p>';
            inviteFriendsModal.classList.add('visible');
            return;
        }

        inviteFriendsListContainer.innerHTML = '<h4>Mis Amigos</h4>';
        let hasFriendsToList = false;

        for (const friendId of currentUserProfile.friends) {
            const friendProfile = await fetchUserProfile(friendId);
            if (friendProfile) {
                hasFriendsToList = true;
                const friendElement = document.createElement('div');
                friendElement.className = 'friend-item';
                let avatarHtml = friendProfile.profileImageName ? `<img src="../imajenes/perfil/${friendProfile.profileImageName}" alt="Avatar">` : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;
                friendElement.innerHTML = `<div class="friend-avatar">${avatarHtml}</div><span class="friend-info">${friendProfile.username}</span><button class="invite-to-game-btn" data-friend-id="${friendId}">Invitar</button>`;
                inviteFriendsListContainer.appendChild(friendElement);
            }
        }

        if (!hasFriendsToList) {
            inviteFriendsListContainer.innerHTML += '<p>No tienes amigos para invitar.</p>';
        }
        inviteFriendsModal.classList.add('visible');
    });

    closeInviteFriendsModalBtn.addEventListener('click', () => inviteFriendsModal.classList.remove('visible'));

    inviteFriendsListContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('invite-to-game-btn')) {
            const friendId = e.target.dataset.friendId;
            const { userWaitingGameId, currentUserProfile } = getState();

            if (friendId && userWaitingGameId && currentUserProfile) {
                e.target.disabled = true;
                e.target.textContent = 'Enviando...';
                try {
                    const gameDoc = await getDoc(doc(db, "games", userWaitingGameId));
                    if (gameDoc.exists()) {
                        const gameData = gameDoc.data();
                        await addDoc(collection(db, 'game_invites'), {
                            fromUid: currentUserProfile.uid,
                            fromUsername: currentUserProfile.username,
                            toUid: friendId,
                            gameId: userWaitingGameId,
                            betAmount: gameData.betAmount || 0,
                            status: 'pending',
                            createdAt: new Date()
                        });
                        e.target.textContent = 'Invitado';
                    }
                } catch (error) {
                    console.error("Error al enviar la invitación:", error);
                    e.target.textContent = 'Error';
                }
            }
        }
    });
};

export const startPollingWaitingGames = () => {
    // The new updateGameLists uses onSnapshot, so we just need to call it once.
    updateGameLists();
    // The polling is no longer needed.
    // setPollingIntervalId(setInterval(updateGameLists, 5000));
};
