import { closeMaintenanceModalBtn, maintenanceModal, profilePictureContainer, profilePictureModal, closeAvatarModalBtn, avatarGrid, betModal, cancelBetBtn, confirmBetBtn, betAmountInput, betErrorMessage, friendsBtn, friendsModal, closeFriendsModalBtn, userFriendIdSpan, copyFriendIdBtn, errorConsoleModal, errorConsoleTextarea, copyErrorsBtn, closeErrorModalBtn } from './domElements.js';
import { updateUserProfile } from '../auth.js';
import { getState } from './state.js';
import { updateErrorConsole, isMaintenanceModalOpen } from './utils.js';

export const setupMaintenanceModal = () => {
    closeMaintenanceModalBtn.addEventListener('click', () => {
        maintenanceModal.classList.remove('visible');
        isMaintenanceModalOpen = false;
    });
};

export const setupAvatarModal = () => {
    profilePictureContainer.addEventListener('click', () => {
        profilePictureModal.classList.add('visible');
    });

    closeAvatarModalBtn.addEventListener('click', () => {
        profilePictureModal.classList.remove('visible');
    });

    const TOTAL_AVATARS = 2;
    for (let i = 1; i <= TOTAL_AVATARS; i++) {
        const img = document.createElement('img');
        const imgPath = `../imajenes/perfil/${i}.jpg`;
        img.src = imgPath;
        img.className = 'avatar-option';
        img.alt = `Avatar ${i}`;
        img.dataset.path = imgPath;
        img.addEventListener('click', () => {
            const { currentUser } = getState();
            if (!currentUser) {
                console.error("Usuario no logueado. No se puede cambiar la foto.");
                return;
            }
            const selectedPath = img.dataset.path;
            const imageName = selectedPath.split('/').pop();

            updateUserProfile(currentUser.uid, { profileImageName: imageName });
            
            profilePictureModal.classList.remove('visible');
        });
        avatarGrid.appendChild(img);
    }
};

export const setupBetModal = (createGameCallback) => {
    cancelBetBtn.addEventListener('click', () => {
        betModal.classList.remove('visible');
    });
    betModal.addEventListener('click', (e) => {
        if (e.target === betModal) {
            betModal.classList.remove('visible');
        }
    });

    confirmBetBtn.onclick = async () => {
        const { currentUserProfile } = getState();
        const betAmount = parseFloat(betAmountInput.value);

        if (isNaN(betAmount) || betAmount < 1000) {
            betErrorMessage.textContent = 'La apuesta mínima es de $1,000.';
            return;
        }
        if (currentUserProfile && betAmount > currentUserProfile.balance) {
            betErrorMessage.textContent = 'No tienes saldo suficiente para esta apuesta.';
            return;
        }

        betErrorMessage.textContent = '';
        confirmBetBtn.disabled = true;
        confirmBetBtn.textContent = 'Creando...';

        await createGameCallback(betAmount);

        betModal.classList.remove('visible');
        confirmBetBtn.disabled = false;
        confirmBetBtn.textContent = 'Confirmar Apuesta';
    };
};

export const setupFriendsModal = () => {
    friendsBtn.addEventListener('click', () => {
        friendsModal.classList.add('visible');
        const { currentUser } = getState();
        if (currentUser && userFriendIdSpan) {
            userFriendIdSpan.textContent = currentUser.uid;
        }
    });

    copyFriendIdBtn.addEventListener('click', async () => {
        const { currentUser } = getState();
        if (currentUser && currentUser.uid) {
            try {
                await navigator.clipboard.writeText(currentUser.uid);
                const originalIcon = copyFriendIdBtn.innerHTML;
                copyFriendIdBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
                copyFriendIdBtn.style.color = 'var(--primary-color)';
                setTimeout(() => {
                    copyFriendIdBtn.innerHTML = originalIcon;
                    copyFriendIdBtn.style.color = '';
                }, 2000);
            } catch (err) {
                console.error('Error al copiar el ID: ', err);
            }
        }
    });

    closeFriendsModalBtn.addEventListener('click', () => {
        friendsModal.classList.remove('visible');
    });

    friendsModal.addEventListener('click', (e) => {
        if (e.target === friendsModal) {
            friendsModal.classList.remove('visible');
        }
    });
};

export const setupErrorConsoleModal = () => {
    closeErrorModalBtn.addEventListener('click', () => {
        errorConsoleModal.classList.remove('visible');
    });

    copyErrorsBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(errorConsoleTextarea.value);
            alert('Errores copiados al portapapeles!');
        } catch (err) {
            console.error('Error al copiar los errores con navigator.clipboard.writeText:', err);
            try {
                const textarea = document.createElement('textarea');
                textarea.value = errorConsoleTextarea.value;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('Errores copiados al portapapeles (método alternativo)!');
            } catch (fallbackErr) {
                console.error('Error al copiar los errores con document.execCommand(\'copy\'):', fallbackErr);
                alert('No se pudieron copiar los errores automáticamente. Por favor, selecciona el texto y cópialo manualmente.');
            }
        }
    });
};
