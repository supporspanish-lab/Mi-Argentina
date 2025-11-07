import { db, collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, arrayUnion, deleteDoc, getDoc, getUserProfile, updateUserProfile } from './firebaseService.js';
import { appContainer, gameContainer, gameIframe, gameCarousel, waitingScreen, cancelWaitBtn, startGameBtn, kickOpponentBtn, chatMessagesContainer, chatMessageInput, sendChatMessageBtn, minimizeChatBtn, player1ChatName, player2ChatName, player1ChatAvatar, player2ChatAvatar, betModal, betAmountInput, betErrorMessage } from './domElements.js';
import { getState, setUserWaitingGameId, setLastMessageCount, setPollingIntervalId, stopPolling, setGameStarted } from './state.js';
import { setPlayerAvatar, renderMessages, cleanupWaitingGame } from './utils.js';

const startGameFullscreen = (gameId) => {
    appContainer.style.display = 'none'; // Hide the home.html UI
    gameIframe.src = `../index.html?gameId=${gameId}`; // Set iframe source
    gameContainer.style.display = 'block'; // Show the game container

    // Request fullscreen
    if (gameContainer.requestFullscreen) {
        gameContainer.requestFullscreen();
    } else if (gameContainer.mozRequestFullScreen) { /* Firefox */
        gameContainer.mozRequestFullScreen();
    } else if (gameContainer.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        gameContainer.webkitRequestFullscreen();
    } else if (gameContainer.msRequestFullscreen) { /* IE/Edge */
        gameContainer.msRequestFullscreen();
    }
};

const STALE_GAME_MINUTES = 10;

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
                    // Stale game logic - delete the game
                    promises.push(deleteDoc(doc(db, "games", docSnap.id)));
                }
            }
        });
        await Promise.all(promises);
    } catch (error) {
        console.error("Error al purgar partidas antiguas:", error);
    }
};

export const createGame = async (betAmount, isPrivate = false) => {
    const { currentUser, currentUserProfile } = getState();
    if (!currentUser || !currentUserProfile) return;

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

    // NEW: Deduct bet amount from player 1's balance
    if (currentUserProfile.balance < betAmount) {
        betErrorMessage.textContent = 'No tienes saldo suficiente para crear esta partida.';
        betModal.classList.add('visible'); // Re-open bet modal to show error
        return;
    }

    const player1BalanceTransaction = {
        amount: -betAmount,
        type: 'bet',
        gameId: null, // Will be updated after game creation
        timestamp: new Date()
    };

    // Update player 1's balance
    await updateUserProfile(currentUser.uid, {
        balance: currentUserProfile.balance - betAmount,
        transactions: arrayUnion(player1BalanceTransaction)
    });

    console.log(`Player 1 (${currentUser.uid}) is creating a game with bet amount: ${betAmount}. Balance deducted.`);

    const newGameRef = await addDoc(collection(db, "games"), {
        player1: { uid: currentUser.uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName },
        player2: null,
        status: "waiting",
        createdAt: new Date(),
        currentPlayerUid: null,
        balls: ballPositions,
        turn: 1,
        betAmount: betAmount,
        isPrivate: isPrivate, // Añadir el estado de privacidad
        balancesDeducted: false, // Balances are not fully deducted until player 2 joins
        player1BalanceTransaction: player1BalanceTransaction // Store transaction details
    });

    // Update the gameId in the transaction record
    await updateDoc(newGameRef, {
        'player1BalanceTransaction.gameId': newGameRef.id
    });

    setUserWaitingGameId(newGameRef.id);

    setUserWaitingGameId(newGame.id);
    gameCarousel.style.display = 'none';
    waitingScreen.style.display = 'flex';
    player1ChatName.textContent = currentUserProfile.username;
    setPlayerAvatar(player1ChatAvatar, currentUserProfile.profileImageName);
    player2ChatName.textContent = 'Oponente';
    player2ChatAvatar.style.display = 'none';
    cancelWaitBtn.textContent = 'Cancelar Sala';
    startGameBtn.style.display = 'none';
    kickOpponentBtn.style.display = 'none';

    onSnapshot(doc(db, "games", newGame.id), (gameSnap) => {
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
                    startGameFullscreen(newGame.id);
                }
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

    startGameBtn.onclick = async () => {
        const { userWaitingGameId, currentUser } = getState();
        if (confirm('¿Estás seguro de que quieres iniciar la partida?')) {
            if (userWaitingGameId && currentUser) {
                const gameDocRef = doc(db, "games", userWaitingGameId);
                const gameSnap = await getDoc(gameDocRef); // Get game data
                if (!gameSnap.exists()) {
                    console.error("Game document not found.");
                    alert("Error: Documento de partida no encontrado.");
                    return;
                }
                const gameData = gameSnap.data();

                if (gameData.balancesDeducted) { // Check if already deducted
                    console.log("Balances already deducted for this game. Proceeding to start.");
                    await updateDoc(gameDocRef, { status: "starting" });
                    return;
                }

                const player1Uid = gameData.player1.uid;
                const player2Uid = gameData.player2.uid;
                const betAmount = gameData.betAmount;

                if (!player1Uid || !player2Uid || !betAmount) {
                    console.error("Missing player UIDs or bet amount in game data.");
                    alert("Error: Faltan UIDs de jugador o monto de apuesta en los datos de la partida.");
                    return;
                }

                // Fetch player balances
                const player1Profile = await getUserProfile(player1Uid);
                const player2Profile = await getUserProfile(player2Uid);

                if (!player1Profile || !player2Profile) {
                    console.error("Could not fetch one or both player profiles.");
                    alert("Error al obtener perfiles de jugador. No se puede iniciar la partida.");
                    return;
                }

                // Check balances
                if (player1Profile.balance < betAmount || player2Profile.balance < betAmount) {
                    alert("Uno de los jugadores no tiene saldo suficiente para la apuesta. No se puede iniciar la partida.");
                    return;
                }

                // Deduct balances and record transactions
                const newPlayer1Balance = player1Profile.balance - betAmount;
                const newPlayer2Balance = player2Profile.balance - betAmount;

                const player1Transaction = {
                    amount: -betAmount,
                    type: 'bet',
                    gameId: userWaitingGameId,
                    timestamp: new Date()
                };
                const player2Transaction = {
                    amount: -betAmount,
                    type: 'bet',
                    gameId: userWaitingGameId,
                    timestamp: new Date()
                };

                await updateUserProfile(player1Uid, {
                    balance: newPlayer1Balance,
                    transactions: arrayUnion(player1Transaction)
                });
                await updateUserProfile(player2Uid, {
                    balance: newPlayer2Balance,
                    transactions: arrayUnion(player2Transaction)
                });

                console.log(`Balances deducted for game ${userWaitingGameId}. Player 1 new balance: ${newPlayer1Balance}, Player 2 new balance: ${newPlayer2Balance}`);

                // Update game status to starting and mark balances as deducted
                await updateDoc(gameDocRef, {
                    status: "starting",
                    balancesDeducted: true
                });
            }
        }
    };
};

export const fetchWaitingGames = async (isPrivate = false) => {
    const { currentUser, userWaitingGameId, currentUserProfile } = getState();
    if (!currentUser || !currentUserProfile) return;

    if (waitingScreen.style.display === 'flex' && userWaitingGameId) {
        return; 
    }
    try {
        const gamesRef = collection(db, "games");
        const waitingGamesQuery = query(gamesRef, where("status", "==", "waiting"), where("player2", "==", null), where("isPrivate", "==", isPrivate));
        const querySnapshot = await getDocs(waitingGamesQuery);
        gameCarousel.innerHTML = '';
        let userIsWaiting = false;

        querySnapshot.forEach(docSnap => {
            const gameData = docSnap.data();
            const gameId = docSnap.id;

            if (gameData.player1.uid === currentUser.uid) {
                userIsWaiting = true;
                setUserWaitingGameId(gameId);
            } else {
                const card = document.createElement('div');
                card.className = 'game-card waiting';
                card.dataset.gameId = gameId;
                card.innerHTML = `
                    <div class="card-player-info">
                        <span class="player-name-waiting">${gameData.player1.username}</span>
                        <span class="status-text">está esperando...</span>
                    </div>
                    ${gameData.betAmount > 0 ? `
                    <div class="card-bet-amount">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm1.5-3.845V11h-3v-1.034c.96.124 1.51.278 1.51.794 0 .516-.544.69-1.51.825V12.5h3v-1.033c-.967-.125-1.51-.28-1.51-.795 0-.515.543-.69 1.51-.825V8.5h-3V7.5h3v1.033c.96.124 1.51.278 1.51.794 0 .516-.544.69-1.51.825z"/></svg>
                        <span>$${gameData.betAmount.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="card-player-count">1/2</div>
                `;
                card.addEventListener('click', async () => {
                    const gameDocRef = doc(db, "games", gameId);
                    const gameSnap = await getDoc(gameDocRef);

                    if (!gameSnap.exists() || gameSnap.data().status !== 'waiting') {
                        alert('Esta partida ya no está disponible o alguien más se unió primero.');
                        return;
                    }

                    if (currentUserProfile && gameData.betAmount > currentUserProfile.balance) {
                        alert('No tienes saldo suficiente para unirte a esta partida.');
                        return;
                    }

                    const random = Math.random();
                    const player1Uid = gameData.player1.uid;
                    const player2Uid = currentUser.uid;
                    const startingPlayerUid = random < 0.5 ? player1Uid : player2Uid;

                    console.log(`Player 2 (${currentUser.uid}) is joining a game with bet amount: ${gameData.betAmount}. Balance will be deducted upon game start.`);

                    await updateDoc(doc(db, "games", gameId), {
                        player2: { uid: player2Uid, username: currentUserProfile.username, profileImageName: currentUserProfile.profileImageName },
                        status: "players_joined",
                        currentPlayerUid: startingPlayerUid,
                        turn: 1,
                        player2BalanceTransaction: {
                            amount: -gameData.betAmount,
                            type: 'bet',
                            gameId: gameId,
                            timestamp: new Date()
                        }
                    });

                    setUserWaitingGameId(gameId);
                    gameCarousel.style.display = 'none';
                    waitingScreen.style.display = 'flex';
                    player1ChatName.textContent = gameData.player1.username;
                    setPlayerAvatar(player1ChatAvatar, gameData.player1.profileImageName);
                    player2ChatName.textContent = currentUserProfile.username;
                    setPlayerAvatar(player2ChatAvatar, currentUserProfile.profileImageName);
                    startGameBtn.style.display = 'none';
                    cancelWaitBtn.textContent = 'Abandonar Sala';

                    onSnapshot(doc(db, "games", gameId), (gameSnap) => {
                        const gameData = gameSnap.data();
                        if (gameData) {
                            renderMessages(gameData.messages, chatMessagesContainer);
                            setLastMessageCount(gameData.messages ? gameData.messages.length : 0);

                            // Si el juego comienza, redirigir.
                            if (gameData.status === "starting") {
                                const { gameStarted } = getState();
                                if (!gameStarted) {
                                    setGameStarted(true);
                                    startGameFullscreen(gameId);
                                }
                            }
                            // Si el jugador 2 (el que se unió) ya no está en la partida,
                            // y el juego NO está en estado "starting", entonces limpiar la sala de espera.
                            else if (gameData.player2 === null && gameData.status !== "starting") {
                                cleanupWaitingGame();
                            }
                        } else {
                            // Si el documento del juego se elimina, limpiar la sala de espera.
                            cleanupWaitingGame();
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
            player2ChatAvatar.style.display = 'none';
            cancelWaitBtn.textContent = 'Cancelar Sala';
            startGameBtn.style.display = 'none';
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
                betAmountInput.value = '1000';
                betErrorMessage.textContent = '';
                betModal.classList.add('visible');
            });
            gameCarousel.appendChild(createCard);
        }
    } catch (error) {
        console.error("Error fetching waiting games:", error);
    }
};

export const setupGameRoomListeners = () => {
    kickOpponentBtn.addEventListener('click', async () => {
        const { userWaitingGameId } = getState();
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
        const { currentUser, currentUserProfile, userWaitingGameId } = getState();
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
        if (waitingScreen.classList.contains('minimized')) {
            waitingScreen.classList.remove('minimized');
        }
    });

    cancelWaitBtn.addEventListener('click', async () => {
        await cleanupWaitingGame();
    });
};

export const startPollingWaitingGames = () => {
    setPollingIntervalId(setInterval(fetchWaitingGames, 5000));
};