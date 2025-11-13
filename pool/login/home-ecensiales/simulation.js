// login/home-ecensiales/simulation.js

import { getSalas, setSalas } from './state.js';
import { displaySalas } from './gameRoomHandlers.js';

let simulatedRooms = [];
let simulationStartTime = 0;

const NAMES = [
  "ShadowKill", "LunaFire", "Gamer202", "SombraXD", "DarkLion", "NeoHunter", "ToxicWave", "AlexPro", "SniperWolf",
  "Cr4zyJuan", "KillerQueen", "FrostByte", "LeoGT", "TheGhost", "M4rtiN", "ZenixYT", "NoScopeMan", "MiniSofi", "PandaRush",
  "FireStorm", "ZeroSkill", "TitoXD", "MrAndres", "NoeliaGamer", "UltraManuel", "XxValenxX", "Luciferino", "TomiPlayz",
  "NovaBlast", "SofiChan", "GonzaPRO", "ElTigre07", "CamiQueen", "NachoX", "TheDestroyer", "D4rkSoul", "JuliYT",
  "CrazyLu", "Mateo_404", "FuriaTotal", "NatiUwU", "ZombiRush", "BrunoFPS", "LuciaKillz", "Vortex88", "SkyLord",
  "PanteraNegra", "MiniMeli", "RafaZon", "AngelStorm", "Zorro_Arg", "EliFire", "ProxGamer", "ToxicGirl", "Juanjo007",
  "CrisTnT", "CamiloXD", "BlackMoon", "DemonSoul", "FrancoYT", "LaBestia23", "RocketPanda", "XxMaruUwUxX", "Sn1p3rLeo",
  "LuzDark", "FerBoom", "NicoRush", "IceDragon", "JulietaPro", "RafitaLOL", "ZeroOne", "MisterGhost", "Valen_22",
  "GonzaPlay", "PinkTerror", "ShadowKiller", "LuchoXD", "DarkNova", "MiniFer", "GalaxyGirl", "CamiBoom", "TheRealPablo",
  "TrollMaster", "ViruX", "ZombieGirl", "TomiSniper", "UltraCris", "SkyRider", "DanteLOL", "NatyFire", "ThunderKid",
  "BlazeMan", "LauFPS", "JuanitoYT", "WolfyBoy", "ElGamerArg", "Prosofia", "VegaX", "Sofi_2009", "Sn1perGod", "LauBoom"
];

const STATUSES = ['waiting', 'starting', 'players_joined', 'ended'];

function getRandomStatus() {
    return STATUSES[Math.floor(Math.random() * STATUSES.length)];
}


function getRandomName() {
    return NAMES[Math.floor(Math.random() * NAMES.length)];
}

function createSimulatedRoom() {
    const salaId = `sim_${Date.now()}`;
    const player1Num = Math.floor(Math.random() * 107) + 1;
    const player2Num = Math.floor(Math.random() * 107) + 1;
    const player1Name = getRandomName();
    const player2Name = getRandomName();
    const creatorName = getRandomName();
    const canCreateWaiting = Date.now() - simulationStartTime > 2000;
    const status = canCreateWaiting && Math.random() < 0.3 ? 'waiting' : 'starting'; // 30% chance to start as waiting after 2 seconds
    const room = {
        id: salaId,
        nombre: `Sala de demostración ${Math.floor(Math.random() * 100)}`,
        creador: creatorName,
        jugadores: 2,
        maxJugadores: 2,
        estado: 'jugando',
        status: status,
        createdAt: new Date().toISOString(),
        isSimulated: true,
        player1: {
            uid: `bot1_${salaId}`,
            username: player1Name,
            profileImageName: `${player1Num}.jpg`
        },
        player2: {
            uid: `bot2_${salaId}`,
            username: player2Name,
            profileImageName: `${player2Num}.jpg`
        },
        betAmount: Math.floor(Math.random() * 99000) + 1000, // 1000 to 100000
        createdBy: {
            displayName: creatorName,
            photoURL: `../imajenes/perfil/${player1Num}.jpg`
        }
    };
    if (status === 'waiting') {
        room.changeTime = Date.now() + (Math.floor(Math.random() * 1000) + 500); // 0.5-1.5 seconds
    }
    if (status === 'ended') {
        room.winnerUsername = Math.random() < 0.5 ? player1Name : player2Name;
        room.removeTime = Date.now() + 3000; // Remove after 3 seconds
    }
    return room;
}

function showMultipleWinNotifications(winners) {
    if (winners.length > 0) {
        const notificationBar = document.getElementById('notification-bar');
        notificationBar.style.display = 'block';
        // Hide the bar when the last notification disappears
        const lastNotificationTime = (winners.length - 1) * 2000 + 8000;
        setTimeout(() => {
            notificationBar.style.display = 'none';
        }, lastNotificationTime);
    }

    winners.forEach((winner, index) => {
        setTimeout(() => {
            const notificationDiv = document.createElement('div');
            notificationDiv.id = `game-win-notification-${Date.now()}-${index}`;
            notificationDiv.className = 'game-win-notification';
            notificationDiv.innerHTML = `${winner.username} ganó <span class="win-amount">$${winner.amount.toLocaleString()}</span>!`;
            notificationDiv.style.left = `${-100 + index * 10}%`;
            notificationDiv.style.display = 'block';
            document.body.appendChild(notificationDiv);

            // Hide after 8 seconds
            setTimeout(() => {
                notificationDiv.style.display = 'none';
                document.body.removeChild(notificationDiv);
            }, 8000);
        }, index * 2000); // 2 second delay between each to avoid overlap
    });
}

function updateSimulatedRooms() {
    const winners = [];

    // Cambiar estados de salas existentes aleatoriamente
    simulatedRooms.forEach(room => {
        if (room.status === 'waiting' && room.changeTime && Date.now() > room.changeTime) {
            room.status = 'players_joined';
            delete room.changeTime; // Remove the timer
        } else if (room.status === 'players_joined') {
            if (Math.random() < 0.2) { // 20% chance to start if joined
                room.status = 'starting';
            }
        } else if (room.status === 'starting') {
            if (Math.random() < 0.1) { // 10% chance to end
                room.status = 'ended';
                room.winnerUsername = Math.random() < 0.5 ? room.player1.username : room.player2.username;
                room.removeTime = Date.now() + 3000; // Remove after 3 seconds
            }
        }
    });

    // Eliminar salas simuladas terminadas después de 3 segundos
    const endedRooms = simulatedRooms.filter(room => room.status === 'ended' && room.removeTime && Date.now() > room.removeTime);
    endedRooms.forEach(room => {
        const winner = room.player1.username === room.winnerUsername ? room.player1 : room.player2;
        const winAmount = Math.floor(Math.random() * 50000) + 20000; // 20k to 70k
        winners.push({ username: winner.username, amount: winAmount });
        const index = simulatedRooms.indexOf(room);
        if (index > -1) simulatedRooms.splice(index, 1);
    });

    // Eliminar una o dos salas simuladas aleatoriamente si hay más de 5
    if (simulatedRooms.length > 5) {
        const roomsToRemove = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < roomsToRemove; i++) {
            const randomIndex = Math.floor(Math.random() * simulatedRooms.length);
            const roomToRemove = simulatedRooms[randomIndex];
            // Collect winner info if ended and not already collected
            if (roomToRemove.status === 'ended' && !winners.some(w => w.username === roomToRemove.winnerUsername)) {
                const winner = roomToRemove.player1.username === roomToRemove.winnerUsername ? roomToRemove.player1 : roomToRemove.player2;
                const winAmount = Math.floor(Math.random() * 50000) + 20000; // 20k to 70k
                winners.push({ username: winner.username, amount: winAmount });
            }
            simulatedRooms.splice(randomIndex, 1);
        }
    }

    // Show notifications for all winners at once
    if (winners.length > 0) {
        showMultipleWinNotifications(winners);
    }

    // Añadir una o dos salas nuevas
    const roomsToAdd = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < roomsToAdd; i++) {
        if (simulatedRooms.length < 50) {
            simulatedRooms.push(createSimulatedRoom());
        }
    }

    // Ordenar las salas simuladas por fecha de creación
    simulatedRooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const realRooms = getSalas().filter(sala => !sala.isSimulated);

    const allRooms = [...realRooms, ...simulatedRooms];
    setSalas(allRooms);
    displaySalas(allRooms);
}

export function initSimulation() {
    simulationStartTime = Date.now();
    // Carga inicial de salas simuladas (solo 'starting')
    for (let i = 0; i < 45; i++) {
        simulatedRooms.push(createSimulatedRoom());
    }
    const realRooms = getSalas().filter(sala => !sala.isSimulated);
    const allRooms = [...realRooms, ...simulatedRooms];
    setSalas(allRooms);
    displaySalas(allRooms);

    // Función para programar la próxima actualización con intervalo aleatorio
    function scheduleNextUpdate() {
        updateSimulatedRooms();
        const delay = Math.floor(Math.random() * (60000 - 5000 + 1)) + 5000; // Entre 5 segundos y 1 minuto
        setTimeout(scheduleNextUpdate, delay);
    }

    // Iniciar la primera actualización con un retraso aleatorio
    const initialDelay = Math.floor(Math.random() * (60000 - 5000 + 1)) + 5000;
    setTimeout(scheduleNextUpdate, initialDelay);
}
