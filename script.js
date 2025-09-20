class Game {
            constructor() {
                this.canvas = document.getElementById('gameCanvas');
                this.ctx = this.canvas.getContext('2d');
                this.gameState = 'menu';
                this.score = 0;
                this.level = 1;
                this.entities = [];
                this.towers = [];
                this.enemies = [];
                this.projectiles = [];
                this.particles = [];
                this.keys = {};
                this.mouse = { x: 0, y: 0, pressed: false };
                this.touch = { x: 0, y: 0, active: false };
                this.selectedTowerType = null;
                this.selectedTower = null;
                this.gold = 100;
                this.lives = 20;
                this.currentWave = 1;
                this.waveActive = false;
                this.paused = false;
                this.difficulty = 'normal';
                this.path = [];
                this.towerSpots = [];
                this.basePosition = { x: 700, y: 300 };
                this.soundEnabled = true;
                this.lastTime = 0;
                this.enemiesToSpawn = 0;
                this.spawnInterval = 1000;
                this.lastSpawnTime = 0;
                this.waveTimer = 0;
                this.waveCooldown = 5000;
                this.gameSpeed = 1;
                this.killCount = 0;
                this.totalDamage = 0;
                this.fastForward = false;
                this.waveComplete = false;
                this.nukeCooldown = 0;
                this.nukeCooldownTime = 30000;
                this.longestWave = 0;
                this.theme = 'dark';
                this.bossSpawned = false;
                
                this.setupCanvas();
                this.setupInput();
                this.setupAudio();
                this.loadHighScore();
                this.createMap();
                this.updateWavePreview();
                this.gameLoop();
            }

            setupCanvas() {
                this.canvas.width = 800;
                this.canvas.height = 600;
                
                window.addEventListener('resize', () => {
                    this.handleResize();
                });
                this.handleResize();
            }

            handleResize() {
                const maxWidth = Math.min(800, window.innerWidth - 40);
                const scale = maxWidth / 800;
                
                this.canvas.style.width = maxWidth + 'px';
                this.canvas.style.height = (600 * scale) + 'px';
            }

            setupInput() {
                document.addEventListener('keydown', (e) => {
                    this.keys[e.code] = true;
                    
                    if (e.code === 'Escape') {
                        this.togglePause();
                    }
                    if (e.code === 'Space' && this.gameState === 'playing') {
                        if (!this.waveActive && this.waveTimer <= 0) {
                            this.startNextWave();
                        }
                    }
                    if (e.code === 'KeyM') {
                        this.toggleSound();
                    }
                    if (e.code === 'KeyF') {
                        this.toggleFastForward();
                    }
                    if (e.code === 'KeyN' && this.gameState === 'playing' && this.nukeCooldown <= 0) {
                        this.activateNuke();
                    }
                });

                document.addEventListener('keyup', (e) => {
                    this.keys[e.code] = false;
                });

                this.canvas.addEventListener('mousemove', (e) => {
                    const rect = this.canvas.getBoundingClientRect();
                    this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
                    this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
                });

                this.canvas.addEventListener('mousedown', (e) => {
                    this.mouse.pressed = true;
                    if (this.gameState === 'playing') {
                        if (this.selectedTowerType) {
                            this.placeTower();
                        } else {
                            this.selectTower();
                        }
                    }
                });

                this.canvas.addEventListener('mouseup', (e) => {
                    this.mouse.pressed = false;
                });

                document.querySelectorAll('.tower-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        document.querySelectorAll('.tower-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        this.selectedTowerType = item.dataset.type;
                        this.selectedTower = null;
                        document.getElementById('towerInfo').style.display = 'none';
                        document.body.classList.add('tower-cursor');
                    });
                });

                document.getElementById('startWave').addEventListener('click', () => {
                    if (!this.waveActive && this.waveTimer <= 0) {
                        this.startNextWave();
                    }
                });

                document.getElementById('pauseBtn').addEventListener('click', () => {
                    this.togglePause();
                });

                document.getElementById('muteBtn').addEventListener('click', () => {
                    this.toggleSound();
                });

                document.getElementById('fastForward').addEventListener('click', () => {
                    this.toggleFastForward();
                });

                document.getElementById('nukeBtn').addEventListener('click', () => {
                    if (this.gameState === 'playing' && this.nukeCooldown <= 0) {
                        this.activateNuke();
                    }
                });

                document.getElementById('startGame').addEventListener('click', () => {
                    this.startGame();
                });

                document.getElementById('restartGame').addEventListener('click', () => {
                    this.restartGame();
                });

                document.getElementById('upgradeTower').addEventListener('click', () => {
                    this.upgradeTower();
                });

                document.getElementById('sellTower').addEventListener('click', () => {
                    this.sellTower();
                });

                document.querySelectorAll('.difficulty-buttons button').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        this.difficulty = e.target.dataset.difficulty;
                        document.querySelectorAll('.difficulty-buttons button').forEach(b => {
                            b.classList.remove('selected-difficulty');
                        });
                        e.target.classList.add('selected-difficulty');
                    });
                });

                document.getElementById('themeToggle').addEventListener('click', () => {
                    this.toggleTheme();
                });
            }

            setupAudio() {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.sounds = {
                    shoot: this.createSound(200, 0.1),
                    explosion: this.createSound(100, 0.2),
                    enemyHit: this.createSound(300, 0.1),
                    towerPlace: this.createSound(400, 0.1),
                    gameOver: this.createSound(150, 0.3),
                    upgrade: this.createSound(500, 0.1),
                    error: this.createSound(100, 0.2),
                    waveStart: this.createSound(600, 0.2),
                    nuke: this.createSound(80, 0.5)
                };
            }

            createSound(frequency, duration) {
                return () => {
                    if (!this.soundEnabled) return;
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                    
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.value = frequency;
                    oscillator.type = 'square';
                    
                    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + duration);
                };
            }

            toggleSound() {
                this.soundEnabled = !this.soundEnabled;
                document.getElementById('muteBtn').innerHTML = this.soundEnabled ? 
                    '<i class="fas fa-volume-up"></i> Sound' : '<i class="fas fa-volume-mute"></i> Muted';
            }

            toggleFastForward() {
                this.fastForward = !this.fastForward;
                this.gameSpeed = this.fastForward ? 2 : 1;
                document.getElementById('fastForward').innerHTML = this.fastForward ? 
                    '<i class="fas fa-forward"></i> Speed x2' : '<i class="fas fa-forward"></i> Speed x1';
            }

            toggleTheme() {
                this.theme = this.theme === 'dark' ? 'light' : 'dark';
                const icon = document.querySelector('#themeToggle i');
                
                if (this.theme === 'dark') {
                    document.body.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
                    icon.className = 'fas fa-moon';
                } else {
                    document.body.style.background = 'linear-gradient(135deg, #6a89cc 0%, #4a69bd 100%)';
                    icon.className = 'fas fa-sun';
                }
            }

            createMap() {
                this.path = [
                    { x: -50, y: 300 },
                    { x: 100, y: 300 },
                    { x: 100, y: 150 },
                    { x: 300, y: 150 },
                    { x: 300, y: 450 },
                    { x: 500, y: 450 },
                    { x: 500, y: 250 },
                    { x: 700, y: 250 },
                    { x: 700, y: 300 }
                ];

                const spots = [
                    { x: 200, y: 200 }, { x: 200, y: 400 },
                    { x: 400, y: 200 }, { x: 400, y: 400 },
                    { x: 600, y: 200 }, { x: 600, y: 400 },
                    { x: 250, y: 100 }, { x: 250, y: 500 },
                    { x: 450, y: 100 }, { x: 450, y: 500 }
                ];

                this.towerSpots = spots.map(spot => ({
                    x: spot.x,
                    y: spot.y,
                    occupied: false,
                    tower: null
                }));
            }

            updateWavePreview() {
                const wavePreview = document.getElementById('wavePreview');
                wavePreview.innerHTML = '';
                
                for (let i = 1; i <= 3; i++) {
                    const waveNum = this.currentWave + i - 1;
                    const enemyCount = 5 + waveNum * 2;
                    
                    const waveElement = document.createElement('div');
                    waveElement.className = 'enemy-preview';
                    
                    if (waveNum % 5 === 0) {
                        waveElement.innerHTML = `
                            <span>Wave ${waveNum} 👑</span>
                            <span>👾×${Math.floor(enemyCount * 0.5)}</span>
                            <span>🛡️×${Math.floor(enemyCount * 0.3)}</span>
                            <span>🐝×${Math.floor(enemyCount * 0.2)}</span>
                        `;
                    } else {
                        waveElement.innerHTML = `
                            <span>Wave ${waveNum}</span>
                            <span>👾×${Math.floor(enemyCount * 0.6)}</span>
                            <span>🛡️×${Math.floor(enemyCount * 0.2)}</span>
                            <span>🐝×${Math.floor(enemyCount * 0.2)}</span>
                        `;
                    }
                    wavePreview.appendChild(waveElement);
                }
            }

            startGame() {
                this.gameState = 'playing';
                document.getElementById('menuScreen').style.display = 'none';
                this.resetGame();
            }

            restartGame() {
                this.gameState = 'playing';
                document.getElementById('gameOverScreen').style.display = 'none';
                this.resetGame();
            }

            resetGame() {
                this.entities = [];
                this.towers = [];
                this.enemies = [];
                this.projectiles = [];
                this.particles = [];
                this.gold = 100;
                this.lives = 20;
                this.currentWave = 1;
                this.waveActive = false;
                this.score = 0;
                this.paused = false;
                this.selectedTower = null;
                this.selectedTowerType = null;
                this.waveTimer = 0;
                this.killCount = 0;
                this.totalDamage = 0;
                this.fastForward = false;
                this.gameSpeed = 1;
                this.waveComplete = false;
                this.nukeCooldown = 0;
                this.bossSpawned = false;
                document.querySelectorAll('.tower-item').forEach(i => i.classList.remove('selected'));
                document.getElementById('towerInfo').style.display = 'none';
                document.body.classList.remove('tower-cursor');
                document.getElementById('fastForward').innerHTML = '<i class="fas fa-forward"></i> Speed x1';
                document.getElementById('waveProgress').style.width = '0%';
                document.getElementById('waveTimer').textContent = '0';
                document.getElementById('nukeBtn').classList.remove('active');
                
                this.towerSpots.forEach(spot => {
                    spot.occupied = false;
                    spot.tower = null;
                });
                
                this.updateUI();
                this.updateWavePreview();
            }

            togglePause() {
                if (this.gameState === 'playing') {
                    this.paused = !this.paused;
                    document.getElementById('pauseBtn').innerHTML = this.paused ? 
                        '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
                }
            }

            startNextWave() {
                if (this.waveActive) return;
                
                this.waveActive = true;
                this.waveComplete = false;
                this.enemiesToSpawn = 5 + this.currentWave * 2;
                this.lastSpawnTime = 0;
                this.bossSpawned = false;
                this.sounds.waveStart();
                this.showNotification('Wave ' + this.currentWave + ' started!');
                
                const waveElement = document.getElementById('wave');
                waveElement.classList.add('wave-alert');
                setTimeout(() => waveElement.classList.remove('wave-alert'), 1500);
            }

            spawnEnemy(type) {
                const enemy = {
                    type: type,
                    x: this.path[0].x,
                    y: this.path[0].y,
                    health: 0,
                    maxHealth: 0,
                    speed: 0,
                    reward: 0,
                    damage: 0,
                    pathIndex: 0,
                    size: 20,
                    isBoss: false,
                    armor: 0
                };

                let difficultyMultiplier = 1;
                if (this.difficulty === 'easy') difficultyMultiplier = 0.8;
                if (this.difficulty === 'hard') difficultyMultiplier = 1.2;
                if (this.difficulty === 'brutal') difficultyMultiplier = 1.5;

                switch (type) {
                    case 'minion':
                        enemy.health = enemy.maxHealth = Math.floor((50 + this.currentWave * 10) * difficultyMultiplier);
                        enemy.speed = 1.5;
                        enemy.reward = 10;
                        enemy.damage = 1;
                        enemy.color = '#ff6b6b';
                        break;
                    case 'tank':
                        enemy.health = enemy.maxHealth = Math.floor((150 + this.currentWave * 20) * difficultyMultiplier);
                        enemy.speed = 0.7;
                        enemy.reward = 25;
                        enemy.damage = 3;
                        enemy.color = '#747d8c';
                        enemy.armor = 5;
                        break;
                    case 'swarm':
                        enemy.health = enemy.maxHealth = Math.floor((30 + this.currentWave * 5) * difficultyMultiplier);
                        enemy.speed = 2.0;
                        enemy.reward = 5;
                        enemy.damage = 1;
                        enemy.color = '#a55eea';
                        break;
                    case 'boss':
                        enemy.health = enemy.maxHealth = Math.floor((500 + this.currentWave * 50) * difficultyMultiplier);
                        enemy.speed = 0.5;
                        enemy.reward = 100;
                        enemy.damage = 5;
                        enemy.color = '#ff9f1a';
                        enemy.size = 35;
                        enemy.isBoss = true;
                        enemy.armor = 10;
                        this.bossSpawned = true;
                        break;
                }

                this.enemies.push(enemy);
            }

            completeWave() {
                this.waveActive = false;
                this.waveComplete = true;
                this.waveTimer = this.waveCooldown;
                
                const bonusGold = 25 + this.currentWave * 5;
                this.gold += bonusGold;
                this.score += 100;
                
                this.updateUI();
                this.showNotification('Wave ' + this.currentWave + ' complete! Bonus: ' + bonusGold + ' gold');
                
                if (this.currentWave % 5 === 0) {
                    this.showAchievement('Wave ' + this.currentWave + ' Master', 'You completed ' + this.currentWave + ' waves!');
                }
                
                this.currentWave++;
                this.updateWavePreview();
            }

            activateNuke() {
                let totalReward = 0;
                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    totalReward += this.enemies[i].reward;
                    this.createExplosion(this.enemies[i].x, this.enemies[i].y);
                    this.enemies.splice(i, 1);
                }
                
                this.gold += totalReward;
                this.score += totalReward * 10;
                
                this.nukeCooldown = this.nukeCooldownTime;
                document.getElementById('nukeBtn').classList.add('active');
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                this.sounds.nuke();
                this.showNotification('Nuke activated! +' + totalReward + ' gold');
            }

            createExplosion(x, y) {
                for (let i = 0; i < 20; i++) {
                    this.particles.push({
                        x: x,
                        y: y,
                        size: Math.random() * 5 + 2,
                        speedX: Math.random() * 6 - 3,
                        speedY: Math.random() * 6 - 3,
                        color: `hsl(${Math.random() * 60}, 100%, 50%)`,
                        life: 30
                    });
                }
            }

            updateParticles() {
                for (let i = this.particles.length - 1; i >= 0; i--) {
                    const p = this.particles[i];
                    p.x += p.speedX;
                    p.y += p.speedY;
                    p.life--;
                    
                    if (p.life <= 0) {
                        this.particles.splice(i, 1);
                    }
                }
            }

            renderParticles() {
                for (const p of this.particles) {
                    this.ctx.fillStyle = p.color;
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }

            selectTower() {
                this.selectedTowerType = null;
                document.querySelectorAll('.tower-item').forEach(i => i.classList.remove('selected'));
                document.body.classList.remove('tower-cursor');
                
                let closestTower = null;
                let minDist = 30;
                
                for (const tower of this.towers) {
                    const dist = Math.sqrt((this.mouse.x - tower.x) ** 2 + (this.mouse.y - tower.y) ** 2);
                    if (dist < minDist) {
                        minDist = dist;
                        closestTower = tower;
                    }
                }
                
                if (closestTower) {
                    this.selectedTower = closestTower;
                    this.showTowerInfo(closestTower);
                } else {
                    this.selectedTower = null;
                    document.getElementById('towerInfo').style.display = 'none';
                }
            }

            showTowerInfo(tower) {
                document.getElementById('towerInfo').style.display = 'block';
                document.getElementById('towerName').textContent = tower.type.charAt(0).toUpperCase() + tower.type.slice(1) + ' Tower';
                document.getElementById('towerLevel').textContent = tower.level;
                document.getElementById('towerDamage').textContent = tower.damage;
                document.getElementById('towerRange').textContent = tower.range;
                document.getElementById('upgradeCost').textContent = Math.floor(tower.cost * 0.6);
                
                if (this.gold < Math.floor(tower.cost * 0.6)) {
                    document.getElementById('upgradeTower').style.opacity = '0.5';
                    document.getElementById('upgradeTower').disabled = true;
                } else {
                    document.getElementById('upgradeTower').style.opacity = '1';
                    document.getElementById('upgradeTower').disabled = false;
                }
            }

            upgradeTower() {
                if (!this.selectedTower) return;
                
                const upgradeCost = Math.floor(this.selectedTower.cost * 0.6);
                
                if (this.gold >= upgradeCost) {
                    this.gold -= upgradeCost;
                    this.selectedTower.level++;
                    this.selectedTower.damage = Math.floor(this.selectedTower.damage * 1.5);
                    this.selectedTower.range = Math.floor(this.selectedTower.range * 1.1);
                    this.selectedTower.fireRate = Math.floor(this.selectedTower.fireRate * 0.9);
                    this.selectedTower.cost += upgradeCost;
                    
                    this.sounds.upgrade();
                    this.showTowerInfo(this.selectedTower);
                    this.updateUI();
                    this.showNotification('Tower upgraded to level ' + this.selectedTower.level);
                } else {
                    this.sounds.error();
                    this.showNotification('Not enough gold for upgrade');
                }
            }

            sellTower() {
                if (!this.selectedTower) return;
                
                const refund = Math.floor(this.selectedTower.cost * 0.5);
                this.gold += refund;
                
                for (const spot of this.towerSpots) {
                    if (spot.tower === this.selectedTower) {
                        spot.occupied = false;
                        spot.tower = null;
                        break;
                    }
                }
                
                const index = this.towers.indexOf(this.selectedTower);
                if (index > -1) {
                    this.towers.splice(index, 1);
                }
                
                this.selectedTower = null;
                document.getElementById('towerInfo').style.display = 'none';
                this.updateUI();
                this.showNotification('Tower sold for ' + refund + ' gold');
            }

            showNotification(message) {
                const notification = document.getElementById('notification');
                notification.textContent = message;
                notification.style.display = 'block';
                
                setTimeout(() => {
                    notification.style.display = 'none';
                }, 2000);
            }

            showAchievement(title, description) {
                const achievement = document.getElementById('achievement');
                document.getElementById('achievementTitle').textContent = title;
                document.getElementById('achievementDesc').textContent = description;
                achievement.style.display = 'block';
                
                setTimeout(() => {
                    achievement.style.display = 'none';
                }, 3000);
            }

            placeTower() {
                if (!this.selectedTowerType) return;
                
                const cost = parseInt(document.querySelector('.tower-item.selected').dataset.cost);
                if (this.gold < cost) {
                    this.sounds.error();
                    this.showNotification('Not enough gold');
                    return;
                }
                
                let nearestSpot = null;
                let minDist = Infinity;
                
                for (const spot of this.towerSpots) {
                    if (!spot.occupied) {
                        const dist = Math.sqrt((this.mouse.x - spot.x) ** 2 + (this.mouse.y - spot.y) ** 2);
                        if (dist < minDist && dist < 30) {
                            minDist = dist;
                            nearestSpot = spot;
                        }
                    }
                }
                
                if (nearestSpot) {
                    const tower = {
                        type: this.selectedTowerType,
                        x: nearestSpot.x,
                        y: nearestSpot.y,
                        range: 0,
                        damage: 0,
                        fireRate: 0,
                        lastFire: 0,
                        level: 1,
                        color: '#74b9ff',
                        size: 25,
                        cost: cost
                    };

                    switch (this.selectedTowerType) {
                        case 'archer':
                            tower.range = 150;
                            tower.damage = 20 + this.currentWave * 2;
                            tower.fireRate = 1000;
                            tower.color = '#74b9ff';
                            break;
                        case 'cannon':
                            tower.range = 120;
                            tower.damage = 40 + this.currentWave * 3;
                            tower.fireRate = 2000;
                            tower.color = '#ff9f1a';
                            break;
                        case 'magic':
                            tower.range = 180;
                            tower.damage = 30 + this.currentWave * 4;
                            tower.fireRate = 1500;
                            tower.color = '#a55eea';
                            break;
                        case 'sniper':
                            tower.range = 250;
                            tower.damage = 60 + this.currentWave * 5;
                            tower.fireRate = 3000;
                            tower.color = '#eb3b5a';
                            break;
                    }

                    this.towers.push(tower);
                    nearestSpot.occupied = true;
                    nearestSpot.tower = tower;
                    this.gold -= cost;
                    this.sounds.towerPlace();
                    
                    this.selectedTowerType = null;
                    document.querySelectorAll('.tower-item').forEach(i => i.classList.remove('selected'));
                    document.body.classList.remove('tower-cursor');
                    
                    this.updateUI();
                    this.showNotification('Tower placed');
                } else {
                    this.sounds.error();
                    this.showNotification('No available spot nearby');
                }
            }

            update(deltaTime) {
                if (this.gameState !== 'playing' || this.paused) return;

                deltaTime *= this.gameSpeed;

                if (this.nukeCooldown > 0) {
                    this.nukeCooldown -= deltaTime;
                    document.getElementById('nukeCooldownTimer').textContent = Math.ceil(this.nukeCooldown / 1000);
                    if (this.nukeCooldown <= 0) {
                        document.getElementById('nukeBtn').classList.remove('active');
                    }
                }

                this.updateParticles();

                if (!this.waveActive && this.waveTimer > 0) {
                    this.waveTimer -= deltaTime;
                    const progress = 100 - (this.waveTimer / this.waveCooldown * 100);
                    document.getElementById('waveProgress').style.width = progress + '%';
                    document.getElementById('waveTimer').textContent = Math.ceil(this.waveTimer / 1000);
                    
                    if (this.waveTimer <= 0) {
                        document.getElementById('startWave').disabled = false;
                        document.getElementById('waveTimer').textContent = '0';
                    }
                }

                if (this.waveActive && this.enemiesToSpawn > 0) {
                    this.lastSpawnTime += deltaTime;
                    if (this.lastSpawnTime >= this.spawnInterval) {
                        this.lastSpawnTime = 0;
                        
                        let type = 'minion';
                        const enemyTypes = ['minion', 'minion', 'minion', 'tank', 'swarm'];
                        const rand = Math.random();
                        
                        if (this.currentWave % 5 === 0 && !this.bossSpawned && this.enemiesToSpawn === 1) {
                            type = 'boss';
                        } else {
                            if (rand < 0.6) type = enemyTypes[0];
                            else if (rand < 0.8) type = enemyTypes[1];
                            else type = enemyTypes[3];
                        }
                        
                        this.spawnEnemy(type);
                        this.enemiesToSpawn--;
                    }
                }

                if (this.waveActive && this.enemiesToSpawn === 0 && this.enemies.length === 0) {
                    this.completeWave();
                }

                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    const enemy = this.enemies[i];
                    
                    if (enemy.pathIndex < this.path.length - 1) {
                        const target = this.path[enemy.pathIndex + 1];
                        const dx = target.x - enemy.x;
                        const dy = target.y - enemy.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist < enemy.speed) {
                            enemy.pathIndex++;
                        } else {
                            enemy.x += (dx / dist) * enemy.speed * this.gameSpeed;
                            enemy.y += (dy / dist) * enemy.speed * this.gameSpeed;
                        }
                    } else {
                        this.lives -= enemy.damage;
                        this.enemies.splice(i, 1);
                        this.updateUI();
                        
                        if (this.lives <= 0) {
                            this.gameOver();
                        }
                        continue;
                    }
                    
                    if (enemy.health <= 0) {
                        this.gold += enemy.reward;
                        this.score += enemy.reward * 10;
                        this.killCount++;
                        this.totalDamage += enemy.maxHealth;
                        this.createExplosion(enemy.x, enemy.y);
                        this.enemies.splice(i, 1);
                        this.sounds.enemyHit();
                        this.updateUI();
                    }
                }

                const now = Date.now();
                for (const tower of this.towers) {
                    if (now - tower.lastFire > tower.fireRate) {
                        let closestEnemy = null;
                        let minDist = tower.range;
                        
                        for (const enemy of this.enemies) {
                            const dist = Math.sqrt((tower.x - enemy.x) ** 2 + (tower.y - enemy.y) ** 2);
                            if (dist < minDist) {
                                minDist = dist;
                                closestEnemy = enemy;
                            }
                        }
                        
                        if (closestEnemy) {
                            this.fireProjectile(tower, closestEnemy);
                            tower.lastFire = now;
                        }
                    }
                }

                for (let i = this.projectiles.length - 1; i >= 0; i--) {
                    const projectile = this.projectiles[i];
                    
                    const dx = projectile.target.x - projectile.x;
                    const dy = projectile.target.y - projectile.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < projectile.speed) {
                        let damage = projectile.damage;
                        if (projectile.target.armor) {
                            damage = Math.max(1, damage - projectile.target.armor);
                        }
                        projectile.target.health -= damage;
                        this.totalDamage += damage;
                        this.createExplosion(projectile.target.x, projectile.target.y);
                        this.sounds.explosion();
                        this.projectiles.splice(i, 1);
                    } else {
                        projectile.x += (dx / dist) * projectile.speed * this.gameSpeed;
                        projectile.y += (dy / dist) * projectile.speed * this.gameSpeed;
                    }
                }
            }

            fireProjectile(tower, enemy) {
                const projectile = {
                    x: tower.x,
                    y: tower.y,
                    target: enemy,
                    damage: tower.damage,
                    speed: 5,
                    color: tower.color,
                    size: 5
                };
                
                this.projectiles.push(projectile);
                this.sounds.shoot();
            }

            render() {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                this.ctx.fillStyle = '#162447';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                this.ctx.strokeStyle = '#4a5568';
                this.ctx.lineWidth = 40;
                this.ctx.beginPath();
                this.ctx.moveTo(this.path[0].x, this.path[0].y);
                for (let i = 1; i < this.path.length; i++) {
                    this.ctx.lineTo(this.path[i].x, this.path[i].y);
                }
                this.ctx.stroke();
                
                this.ctx.fillStyle = 'rgba(116, 185, 255, 0.2)';
                for (const spot of this.towerSpots) {
                    if (!spot.occupied) {
                        this.ctx.beginPath();
                        this.ctx.arc(spot.x, spot.y, 20, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }
                
                this.ctx.fillStyle = '#ff4757';
                this.ctx.beginPath();
                this.ctx.arc(this.basePosition.x, this.basePosition.y, 30, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = 'white';
                this.ctx.font = '14px Arial';
                this.ctx.fillText('🏰', this.basePosition.x - 8, this.basePosition.y + 5);
                
                for (const enemy of this.enemies) {
                    this.ctx.fillStyle = '#2d3436';
                    this.ctx.fillRect(enemy.x - 15, enemy.y - 25, 30, 4);
                    
                    const healthPercent = enemy.health / enemy.maxHealth;
                    this.ctx.fillStyle = healthPercent > 0.5 ? '#2ed573' : healthPercent > 0.25 ? '#ffa502' : '#ff4757';
                    this.ctx.fillRect(enemy.x - 15, enemy.y - 25, 30 * healthPercent, 4);
                    
                    if (enemy.isBoss) {
                        this.ctx.fillStyle = '#2d3436';
                        this.ctx.fillRect(enemy.x - 20, enemy.y - 35, 40, 6);
                        
                        this.ctx.fillStyle = '#ff6b6b';
                        this.ctx.fillRect(enemy.x - 20, enemy.y - 35, 40 * healthPercent, 6);
                    }
                    
                    this.ctx.fillStyle = enemy.color;
                    this.ctx.beginPath();
                    this.ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = '16px Arial';
                    let symbol = '';
                    switch (enemy.type) {
                        case 'minion': symbol = '👾'; break;
                        case 'tank': symbol = '🛡️'; break;
                        case 'swarm': symbol = '🐝'; break;
                        case 'boss': symbol = '👑'; break;
                    }
                    this.ctx.fillText(symbol, enemy.x - 8, enemy.y + 6);
                }
                
                for (const tower of this.towers) {
                    if (this.selectedTower === tower || Math.sqrt((this.mouse.x - tower.x) ** 2 + (this.mouse.y - tower.y) ** 2) < 30) {
                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                        this.ctx.beginPath();
                        this.ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
                        this.ctx.stroke();
                    }
                    
                    if (this.selectedTower === tower) {
                        this.ctx.fillStyle = '#ffffff';
                        this.ctx.beginPath();
                        this.ctx.arc(tower.x, tower.y, tower.size + 3, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    
                    this.ctx.fillStyle = tower.color;
                    this.ctx.beginPath();
                    this.ctx.arc(tower.x, tower.y, tower.size, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = '20px Arial';
                    let symbol = '';
                    switch (tower.type) {
                        case 'archer': symbol = '🏹'; break;
                        case 'cannon': symbol = '💣'; break;
                        case 'magic': symbol = '🔮'; break;
                        case 'sniper': symbol = '🎯'; break;
                    }
                    this.ctx.fillText(symbol, tower.x - 10, tower.y + 8);
                    
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = '12px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('Lv.' + tower.level, tower.x, tower.y - 15);
                    this.ctx.textAlign = 'left';
                }
                
                for (const projectile of this.projectiles) {
                    this.ctx.fillStyle = projectile.color;
                    this.ctx.beginPath();
                    this.ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                
                this.renderParticles();
                
                if (this.selectedTowerType && this.gameState === 'playing') {
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.beginPath();
                    
                    let range = 150;
                    switch (this.selectedTowerType) {
                        case 'archer': range = 150; break;
                        case 'cannon': range = 120; break;
                        case 'magic': range = 180; break;
                        case 'sniper': range = 250; break;
                    }
                    
                    this.ctx.arc(this.mouse.x, this.mouse.y, range, 0, Math.PI * 2);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                    
                    this.ctx.fillStyle = 'rgba(116, 185, 255, 0.5)';
                    this.ctx.beginPath();
                    this.ctx.arc(this.mouse.x, this.mouse.y, 25, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                
                if (this.paused) {
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                    
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = '48px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
                    this.ctx.textAlign = 'left';
                }
            }

            updateUI() {
                document.getElementById('gold').textContent = this.gold;
                document.getElementById('wave').textContent = this.currentWave;
                document.getElementById('lives').textContent = this.lives;
                document.getElementById('score').textContent = this.score;
                document.getElementById('towerCount').textContent = this.towers.length;
                document.getElementById('enemyCount').textContent = this.enemies.length;
                document.getElementById('killCount').textContent = this.killCount;
                document.getElementById('damageCount').textContent = this.totalDamage;
                
                document.querySelectorAll('.tower-item').forEach(item => {
                    const cost = parseInt(item.dataset.cost);
                    if (this.gold < cost) {
                        item.style.opacity = '0.5';
                    } else {
                        item.style.opacity = '1';
                    }
                });
                
                document.getElementById('startWave').disabled = this.waveActive || this.waveTimer > 0;
            }

            gameOver() {
                this.gameState = 'gameover';
                this.sounds.gameOver();
                
                if (this.currentWave > this.longestWave) {
                    this.longestWave = this.currentWave;
                    localStorage.setItem('td_longestWave', this.longestWave.toString());
                }
                
                document.getElementById('finalScore').textContent = this.score;
                document.getElementById('finalHighScore').textContent = this.highScore;
                document.getElementById('finalWaves').textContent = this.currentWave - 1;
                
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    this.saveHighScore();
                    document.getElementById('finalHighScore').textContent = this.highScore + ' 🏆 NEW!';
                }
                
                document.getElementById('gameOverScreen').style.display = 'block';
            }

            loadHighScore() {
                this.highScore = parseInt(localStorage.getItem('td_highScore') || '0');
                this.longestWave = parseInt(localStorage.getItem('td_longestWave') || '0');
                document.getElementById('highScore').textContent = this.highScore;
                document.getElementById('finalHighScore').textContent = this.highScore;
                document.getElementById('longestWave').textContent = this.longestWave;
            }

            saveHighScore() {
                localStorage.setItem('td_highScore', this.highScore.toString());
                localStorage.setItem('td_longestWave', this.longestWave.toString());
            }

            gameLoop(timestamp) {
                const deltaTime = timestamp - this.lastTime || 0;
                this.lastTime = timestamp;

                if (!this.paused && this.gameState === 'playing') {
                    this.update(deltaTime);
                }
                
                this.render();
                
                requestAnimationFrame((ts) => this.gameLoop(ts));
            }
        }

        window.addEventListener('DOMContentLoaded', () => {
            try {
                const game = new Game();
                console.log('Epic Tower Defense game initialized successfully');
            } catch (error) {
                console.error('Game initialization failed:', error);
            }
        });