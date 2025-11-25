import { setupAuthListeners, setupMenuListeners } from './authHandlers.js';
import { setupMaintenanceModal, setupAvatarModal, setupBetModal, setupFriendsModal, setupWonGamesModal, setupInfoModal, setupFriendChatModal } from './modalHandlers.js';
import { setupFriendSearch } from './friendshipHandlers.js';
import { setupGameRoomListeners, createGame, purgeStaleGames, setupStartGameButton, endGame } from './gameRoomHandlers.js'; // updateGameLists se llama desde auth.js
import { setupBackgroundMusic } from './home.js'; // CORRECCIÓN: Importar la lógica de la música
import { initSimulation } from './simulation.js';
import { setupMinimalErrorHandling } from './utils.js';

// Make endGame available to the iframe
window.endGame = endGame;

// Configurar manejo mínimo de errores para ignorar permisos de Firebase
setupMinimalErrorHandling();

// Setup UI event listeners
setupMaintenanceModal();
setupAvatarModal();
setupBetModal(createGame); // Pass createGame function to bet modal
setupFriendsModal();
setupWonGamesModal();
setupInfoModal();
setupFriendChatModal();
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
