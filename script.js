import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@6.7.0/dist/d3.min.js';

let chartInstance;
let player;

document.addEventListener("DOMContentLoaded", async () => {
    detectTimezone();

    const confirmBtn = document.getElementById('confirmBtn');
    const usernameInput = document.getElementById('username');

    confirmBtn.addEventListener("click", async () => {
        start();
    });
    usernameInput.addEventListener("keydown", async (e) => {
        if(e.key == "Enter") {
            start();
        }
    })
});

async function start() {
    const usernameInput = document.getElementById('username');
    const confirmBtn = document.getElementById('confirmBtn');
    player = usernameInput.value.trim();
    usernameInput.disabled = true;

    try {
        if (player) {
            confirmBtn.style.display = 'none';
            const result = await getDataFromAPI();
            const gameData = extractGameData(result);
            loadData(gameData);

            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            alert("Please enter a valid username.");
        }
    } finally {
        usernameInput.disabled = false;  // Ensures this always runs
        confirmBtn.style.display = '';   // Clears inline 'none' to restore original display
    }
}

function detectTimezone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    timezoneLabel.textContent = "Detected timezone: " + timezone; 
}

function getDataFromAPI() {
    const progressDiv = document.getElementById("progress");
    const downloadedKB = document.getElementById("downloadedKB");

    // Show progress
    progress.style.display = "block";

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Define the request
        xhr.open("GET", "https://lichess.org/api/games/user/" + player + "?tags=true&clocks=false&evals=false&opening=false&literate=false", true);

        // Check if the server provides Content-Length
        const contentLength = xhr.getResponseHeader('Content-Length');
        let totalSize = contentLength ? parseInt(contentLength) : null;

        xhr.onprogress = function (event) {
            const receivedKB = (event.loaded / 1024).toFixed(2);
            downloadedKB.textContent = `Downloaded: ${receivedKB} KB`;
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                progressDiv.style.display = "none"; 
                resolve(xhr.responseText); // Return the response text
            } else {
                progressDiv.style.display = "none"; 
                reject(new Error("Failed to fetch data"));
                alert("Player not found.")
            }
        };

        xhr.onerror = function () {
            progressDiv.style.display = "none"; 
            reject(new Error("Error fetching data"));
        };

        xhr.ontimeout = function () {
            progressDiv.style.display = "none";
            reject(new Error("Request timed out"));
        };

        xhr.send();
    });
}

function extractGameData(result) {
    const games = result.trim().split("\n\n\n");

    return games
        .filter(game => game.trim()) // Skip empty games
        .map(game => {
            const isPlayerWhite = game.includes(`White "${player}"`);

            const resultIndex = game.indexOf('[Result "');
            const isDraw = game.includes('[Result "1/2-1/2"]');
            const playerWon = game[resultIndex + 9] === '1';

            let gameResult = 0;
            if (!isDraw) {
                gameResult = (isPlayerWhite == playerWon) ? 1 : -1;
            }

            const timeIndex = game.indexOf('UTCTime "');
            const [hours, minutes, seconds] = game
                .substring(timeIndex + 9, timeIndex + 17)
                .split(':');

            // Convert UTC to local time
            const utcDate = new Date();
            utcDate.setUTCHours(hours, minutes, seconds);

            const localHours = utcDate.getHours(); // Local timezone hour

            return { gameResult, time: `${localHours}:${minutes}:${seconds}` };
        });
}
function loadData(gameData) {
    // Aggregate data per hour
    const hourlyStats = {};

    gameData.forEach(({ gameResult, time }) => {
        const hour = parseInt(time.split(":")[0]);

        if (!hourlyStats[hour]) {
            hourlyStats[hour] = { winCount: 0, totalCount: 0 };
        }

        hourlyStats[hour].totalCount++;
        if (gameResult == 1) {
            hourlyStats[hour].winCount++;
        }
    });

    const data = Object.keys(hourlyStats).map(hour => ({
        hour: parseInt(hour),
        winRate: hourlyStats[hour].winCount / hourlyStats[hour].totalCount,
        sampleSize: hourlyStats[hour].totalCount
    }));

    renderChart(data);
}

function renderChart(data) {
    const ctx = document.getElementById('myChart').getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.hour),
            datasets: [
                {
                    label: 'Win Rate',
                    data: data.map(d => d.winRate),
                    borderColor: 'rgb(123, 58, 255)',
                    backgroundColor: 'rgb(123, 58, 255)',
                    tension: 0.1,
                    pointRadius: 0
                },
                {
                    label: 'Sample Size',
                    data: data.map(d => d.winRate),
                    borderColor: 'rgb(29, 242, 242)',
                    backgroundColor: 'rgb(29, 242, 242)',
                    pointRadius: data.map(d => 
                        Math.min(15, (d.sampleSize / data.reduce((sum, d) => sum + d.sampleSize, 0)) * 200)
                    ),
                    pointBackgroundColor: 'rgb(29, 242, 242)',
                    type: 'line',
                    borderColor: 'rgba(0, 0, 0, 0)',
                    showLine: false
                }
            ]
        },
        options: {
            scales: {
                x: { ticks: { stepSize: 1 } },
                y: { min: 0, max: 1 }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Win Rate Analysis for ${player}`,
                    font: {
                        size: 18
                    },
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Sample Size') {
                                return `Games Played: ${data[context.dataIndex].sampleSize}`;
                            }
                            return `Win Rate: ${(context.raw * 100).toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}
