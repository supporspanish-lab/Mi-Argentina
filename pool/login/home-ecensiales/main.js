import { setupAuthListeners, setupMenuListeners } from './authHandlers.js';
import { setupMaintenanceModal, setupAvatarModal, setupBetModal, setupFriendsModal, setupErrorConsoleModal } from './modalHandlers.js';
import { setupFriendSearch, setupFriendRequestsListener, setupFriendsListListener } from './friendshipHandlers.js';
import { setupGameRoomListeners, createGame, purgeStaleGames } from './gameRoomHandlers.js';
import { setupErrorHandling } from './utils.js';

// Setup error handling first
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

// Setup authentication listeners which will trigger other setups upon login
setupAuthListeners();

// Purge stale games on load
purgeStaleGames();
