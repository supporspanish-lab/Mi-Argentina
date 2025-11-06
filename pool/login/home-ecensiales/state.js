let currentUser = null;
let currentUserProfile = null;
let previousBalance = null;
let userWaitingGameId = null;
let lastMessageCount = 0;
let pollingIntervalId = null;

export const getState = () => ({
    currentUser,
    currentUserProfile,
    previousBalance,
    userWaitingGameId,
    lastMessageCount,
    pollingIntervalId
});

export const setCurrentUser = (user) => { currentUser = user; };
export const setCurrentUserProfile = (profile) => { currentUserProfile = profile; };
export const setPreviousBalance = (balance) => { previousBalance = balance; };
export const setUserWaitingGameId = (gameId) => { userWaitingGameId = gameId; };
export const setLastMessageCount = (count) => { lastMessageCount = count; };
export const setPollingIntervalId = (id) => { pollingIntervalId = id; };

export const stopPolling = () => {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }
};
