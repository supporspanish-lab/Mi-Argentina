import { setupAuthListeners, setupMenuListeners } from './authHandlers.js';
import { setupMaintenanceModal, setupAvatarModal, setupBetModal, setupFriendsModal, setupErrorConsoleModal, setupWonGamesModal, setupInfoModal, setupFriendChatModal, setupTournamentInfoModal } from './modalHandlers.js';
import { setupFriendSearch } from './friendshipHandlers.js';
import { setupGameRoomListeners, createGame, purgeStaleGames, setupStartGameButton, endGame } from './gameRoomHandlers.js'; // updateGameLists se llama desde auth.js
import { setupErrorHandling } from './utils.js';
import { setupBackgroundMusic } from './home.js'; // CORRECCIÓN: Importar la lógica de la música
import { initSimulation } from './simulation.js';

// Make endGame available to the iframe
window.endGame = endGame;

// Configurar el manejo de errores primero
setupErrorHandling();

// Setup UI event listeners
setupMaintenanceModal();
setupAvatarModal();
setupBetModal(createGame); // Pass createGame function to bet modal
setupFriendsModal();
setupErrorConsoleModal();
setupWonGamesModal();
setupInfoModal();
setupFriendChatModal();
setupTournamentInfoModal();
setupFriendSearch();
setupGameRoomListeners();
setupStartGameButton();
setupMenuListeners();
setupBackgroundMusic(); // CORRECCIÓN: Inicializar la música de fondo

// Configurar listeners de autenticación que activarán otras configuraciones al iniciar sesión
setupAuthListeners();

// Purge stale games on load
purgeStaleGames();

// Iniciar la simulación de salas
initSimulation();
