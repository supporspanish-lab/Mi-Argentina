import { onSessionStateChanged, onUserProfileUpdate, logout } from '../auth.js';
import { userDisplayName, userBalanceSpan, profileImg, profileSvg, configureUiBtn, logoutBtn, menuToggleBtn, userMenu } from './domElements.js';
import { getState, setCurrentUser, setCurrentUserProfile, setPreviousBalance, stopPolling } from './state.js';
import { requestNotificationPermission, animateBalance, showBalanceUpdateNotification, setPlayerAvatar, cleanupWaitingGame } from './utils.js';
import { setupFriendRequestsListener, setupFriendsListListener } from './friendshipHandlers.js';
import { startPollingWaitingGames, fetchWaitingGames } from './gameRoomHandlers.js';

export const setupAuthListeners = () => {
    try {
        onSessionStateChanged((user) => {
            if (user) {
                setCurrentUser(user);
                requestNotificationPermission();

                window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { userId: user.uid } }));
                
                onUserProfileUpdate(user.uid, (userData) => {
                    userDisplayName.textContent = userData.username || user.email;
                    setCurrentUserProfile(userData);
                    
                    const { previousBalance } = getState();
                    if (previousBalance !== null && userData.balance !== previousBalance) {
                        animateBalance(userBalanceSpan, previousBalance, userData.balance, 1500);
                        if (userData.balance > previousBalance) {
                            showBalanceUpdateNotification(userData.balance, previousBalance);
                        }
                    } else {
                        userBalanceSpan.textContent = `$${userData.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    }
                    setPreviousBalance(userData.balance);

                    if (userData.profileImageName) {
                        profileImg.src = `../imajenes/perfil/${userData.profileImageName}`;
                        profileImg.style.display = 'block';
                        profileSvg.style.display = 'none';
                    } else {
                        profileImg.style.display = 'none';
                        profileSvg.style.display = 'block';
                    }

                    if (userData.username === 'leonirusta') {
                        configureUiBtn.style.display = 'block';
                    } else {
                        configureUiBtn.style.display = 'none';
                    }
                });

                setupFriendRequestsListener();
                setupFriendsListListener();
                startPollingWaitingGames();
                fetchWaitingGames(); // Initial fetch

            } else {
                window.location.href = 'login.html';
            }
        });
    } catch (error) {
        console.error("Error in onSessionStateChanged setup:", error);
    }
};

export const setupMenuListeners = () => {
    menuToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        userMenu.classList.toggle('active');
    });

    document.addEventListener('click', (event) => {
        if (!userMenu.contains(event.target) && !menuToggleBtn.contains(event.target)) {
            userMenu.classList.remove('active');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        stopPolling();
        window.dispatchEvent(new CustomEvent('userLoggedOut'));
        await cleanupWaitingGame();
        logout().then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
    });

    configureUiBtn.addEventListener('click', () => {
        console.log('Botón Administrador clickeado! Abriendo admin.html en una nueva pestaña.');
        window.open('admin.html', '_blank');
        userMenu.classList.remove('active');
    });

    window.addEventListener('beforeunload', async (event) => {
        stopPolling();
        window.dispatchEvent(new CustomEvent('userLoggedOut'));
        await cleanupWaitingGame();
    });
};