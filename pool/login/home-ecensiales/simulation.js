// login/home-ecensiales/simulation.js

import { getSalas, setSalas } from './state.js';
import { displaySalas } from './gameRoomHandlers.js';

let simulatedRooms = [];

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
    return {
        id: salaId,
        nombre: `Sala de demostración ${Math.floor(Math.random() * 100)}`,
        creador: creatorName,
        jugadores: 2,
        maxJugadores: 2,
        estado: 'jugando',
        status: 'starting',
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
        betAmount: Math.floor(Math.random() * 5000) + 1000,
        createdBy: {
            displayName: creatorName,
            photoURL: `../imajenes/perfil/${player1Num}.jpg`
        }
    };
}

function showMultipleWinNotifications(winners) {
    const notificationDiv = document.getElementById('game-win-notification');
    const notificationBar = document.getElementById('notification-bar');
    notificationDiv.style.display = 'block';
    notificationBar.style.display = 'block';

    let currentMessages = [];
    winners.forEach((winner, index) => {
        setTimeout(() => {
            const message = `${winner.username} ganó <span class="win-amount">$${winner.amount.toLocaleString()}</span>!`;
            currentMessages.push(message);
            notificationDiv.innerHTML = currentMessages.join(' | ');
        }, index * 1000); // 1 second delay between each
    });

    // Hide after all are shown plus some time
    const totalTime = winners.length * 1000 + 8000;
    setTimeout(() => {
        notificationDiv.style.display = 'none';
        notificationBar.style.display = 'none';
    }, totalTime);
}

function updateSimulatedRooms() {
    const winners = [];

    // Eliminar una o dos salas simuladas aleatoriamente
    if (simulatedRooms.length > 5) {
        const roomsToRemove = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < roomsToRemove; i++) {
            const randomIndex = Math.floor(Math.random() * simulatedRooms.length);
            const roomToRemove = simulatedRooms[randomIndex];
            // Collect winner info
            const winner = Math.random() < 0.5 ? roomToRemove.player1 : roomToRemove.player2;
            const winAmount = Math.floor(Math.random() * 50000) + 20000; // 20k to 70k
            winners.push({ username: winner.username, amount: winAmount });
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
    // Carga inicial de salas simuladas
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
