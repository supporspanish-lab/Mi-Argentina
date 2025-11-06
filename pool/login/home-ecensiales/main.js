import { setupAuthListeners, setupMenuListeners } from './authHandlers.js';
import { setupMaintenanceModal, setupAvatarModal, setupBetModal, setupFriendsModal, setupErrorConsoleModal } from './modalHandlers.js';
import { setupFriendSearch } from './friendshipHandlers.js';
import { setupGameRoomListeners, createGame, purgeStaleGames } from './gameRoomHandlers.js';
import { setupErrorHandling } from './utils.js';

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
setupMenuListeners();

// Configurar listeners de autenticación que activarán otras configuraciones al iniciar sesión
setupAuthListeners();

// Purge stale games on load
purgeStaleGames();
