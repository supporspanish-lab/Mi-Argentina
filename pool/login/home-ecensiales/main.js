import { setupAuthListeners, setupMenuListeners } from './authHandlers.js';
import { setupMaintenanceModal, setupAvatarModal, setupBetModal, setupFriendsModal, setupErrorConsoleModal } from './modalHandlers.js';
import { setupFriendSearch } from './friendshipHandlers.js';
import { setupGameRoomListeners, createGame, purgeStaleGames, setupStartGameButton } from './gameRoomHandlers.js'; // updateGameLists se llama desde auth.js
import { setupErrorHandling } from './utils.js';
import { setupBackgroundMusic } from './home.js'; // CORRECCIÓN: Importar la lógica de la música

// Configurar el manejo de errores primero
setupErrorHandling();

// Setup UI event listeners
setupMaintenanceModal();
setupAvatarModal();
setupBetModal(createGame); // Pass createGame function to bet modal
setupFriendsModal();
setupErrorConsoleModal();
setupFriendSearch();
setupGameRoomListeners();
setupStartGameButton();
setupMenuListeners();
setupBackgroundMusic(); // CORRECCIÓN: Inicializar la música de fondo

// Configurar listeners de autenticación que activarán otras configuraciones al iniciar sesión
setupAuthListeners();

// Purge stale games on load
purgeStaleGames();
