// Definindo a cena do jogo e usando a biblioteca Phaser
class Cyberbird extends Phaser.Scene {
  constructor() {
    super({ key: 'Cyberbird' });
  }


  // Função de pré-carregamento de recursos
  preload() {
    // Backgrounds
    this.load.image('bgLayer1', 'assets/backgrounds/1.png');
    this.load.image('bgLayer2', 'assets/backgrounds/2.png');
    this.load.image('bgLayer3', 'assets/backgrounds/3.png');
    this.load.image('bgLayer4', 'assets/backgrounds/4.png');
    this.load.image('bgLayer5', 'assets/backgrounds/5.png');

  // Pássaro e drone
  this.load.spritesheet('bird', 'assets/bird/fly.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('drone', 'assets/drone/fly.png', {
      frameWidth: 48,
      frameHeight: 48
    });

    // Tubos 
    this.load.image('tubeEnd', 'assets/objects/tubeEnd.png'); 
    this.load.image('tubeMiddle', 'assets/objects/tubeMiddle.png');

    // Restart button
    this.load.image('restartBtn', 'assets/buttons/restart.png');
  }


  // Função chamada quando a cena é criada
  create() {
    const w = this.sys.game.config.width;
    const h = this.sys.game.config.height;


    // ------------------------------------------------------------------
    // A) BACKGROUND (usando TileSprites)
    // ------------------------------------------------------------------
    // Cria camadas de fundo do cenário com efeito de paralaxe
    const createSingleTileLayer = (key, tileSpeedFactor) => {
      const originalWidth = this.textures.get(key).getSourceImage().width;
      const scaleFactor = w / originalWidth;
      let layer = this.add.tileSprite(0, 0, w, h, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setTileScale(scaleFactor)
        .setData('tileSpeedFactor', tileSpeedFactor);
      return layer;
    };
    // Parallax
    this.bg1 = createSingleTileLayer('bgLayer1', 0.02);
    this.bg2 = createSingleTileLayer('bgLayer2', 0.06);
    this.bg3 = createSingleTileLayer('bgLayer3', 0.12);
    this.bg4 = createSingleTileLayer('bgLayer4', 0.25);
    this.bg5 = createSingleTileLayer('bgLayer5', 0.4);


    // ------------------------------------------------------------------
    // B) WORLD & CAMERA
    // ------------------------------------------------------------------
    this.physics.world.setBounds(0, 0, 999999, h);
    
    // Define os limites da câmera para um mundo horizontalmente infinito
    this.cameras.main.setBounds(0, 0, 999999, h);
    this.cameraSpeed = 2;


    // ------------------------------------------------------------------
    // C) BIRD
    // ------------------------------------------------------------------
    // Cria animação do pássaro
    this.anims.create({
      key: 'birdFly',
      frames: this.anims.generateFrameNumbers('bird', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
    this.bird = this.physics.add.sprite(100, 200, 'bird', 0);
    this.bird.setScale(3);
    this.bird.play('birdFly');
    this.bird.setCollideWorldBounds(true);
    this.bird.body.setSize(this.bird.width * 0.5, this.bird.height * 0.4);


    // ------------------------------------------------------------------
    // D) GAME OVER Flag & Score
    // ------------------------------------------------------------------
    // Flag de fim de jogo
    this.isGameOver = false;

    // Score e high Score
    this.score = 0;
    this.highScore = 0; 
    this.scoreText = this.add.text(w - 20, 20, 'Score: 0  High: 0', {
      fontSize: '24px',
      fill: '#ffffff'
    })
      .setOrigin(1, 0)
      .setScrollFactor(0);


    // ------------------------------------------------------------------
    // E) TUBES (Score pairs)
    // ------------------------------------------------------------------
    // Cria grupo de tubos
    this.tubes = this.physics.add.group();
    this.tubeGap = 180;
    this.tubeDelay = 9000;
    this.tubePairs = []; 
    
    // Cria um evento para gerar tubos em intervalos regulares
    this.time.addEvent({
      delay: this.tubeDelay,
      callback: () => this.spawnTubes(),
      loop: true
    });
    this.physics.add.overlap(this.bird, this.tubes, this.onTubeCollision, null, this);


    // ------------------------------------------------------------------
    // F) DRONES
    // ------------------------------------------------------------------
    // Cria grupo de drones
    this.drones = this.physics.add.group();
    this.lastDroneY = 0;
    this.maxDrones = 10;
    this.droneSpawnChance = 2;

    this.anims.create({
      key: 'droneIdle',
      frames: this.anims.generateFrameNumbers('drone', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    // Cria um evento para spawnar drones periodicamente durante o jogo
    this.time.addEvent({
      delay: 15000,
      callback: () => {
        if (this.droneSpawnChance > 1) {
          this.droneSpawnChance--;
        }
      },
      loop: true
    });

    // Drone spawn loop
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (!this.isGameOver) {
          if (this.drones.countActive(true) < this.maxDrones) {
            if (Phaser.Math.Between(1, this.droneSpawnChance) === 1) {
              this.spawnDrone();
            }
          }
        }
      },
      loop: true
    });

    // Verifica colisões entre o pássaro e os drones
    this.physics.add.overlap(this.bird, this.drones, this.onDroneCollision, null, this);


    // ------------------------------------------------------------------
    // G) INPUT
    // ------------------------------------------------------------------
    this.cursors = this.input.keyboard.createCursorKeys();


    // ------------------------------------------------------------------
    // H) GAME OVER UI (Center of Window)
    // ------------------------------------------------------------------
    this.gameOverText = this.add.text(w / 2, h / 2 - 80, 'GAME OVER', {
      fontSize: '72px',
      fill: '#8c4acf',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setScrollFactor(0) // stays fixed
      .setVisible(false);

    this.restartBtn = this.add.image(w / 2, h / 2, 'restartBtn')
      .setOrigin(0.5)
      .setScrollFactor(0) // stays fixed
      .setScale(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.restartBtn.on('pointerdown', () => {
      this.scene.restart();
    });
  }


  // Função chamada a cada frame
  update() {
    if (this.isGameOver) return;

    // Faz o movimento do background
    const layers = [this.bg1, this.bg2, this.bg3, this.bg4, this.bg5];
    for (let layer of layers) {
      const factor = layer.getData('tileSpeedFactor');
      layer.tilePositionX += factor * this.cameraSpeed;
    }
    // Mexe a câmera
    this.cameras.main.scrollX += this.cameraSpeed;

    // Movimenta o pássaro
    if (this.cursors.left.isDown) {
      this.bird.setVelocityX(-150);
      this.bird.flipX = true;
    } else if (this.cursors.right.isDown) {
      this.bird.setVelocityX(200);
      this.bird.flipX = false;
    } else {
      this.bird.setVelocityX(0);
    }

    let speedY = 200;
    if (this.cursors.up.isDown) {
      this.bird.setVelocityY(-speedY);
    } else if (this.cursors.down.isDown) {
      this.bird.setVelocityY(speedY);
    } else {
      this.bird.setVelocityY(0);
    }

    // Evita que o pássaro saia da tela
    const leftLimit = this.cameras.main.scrollX + 50;
    if (this.bird.x < leftLimit) {
      this.bird.x = leftLimit;
    }

    // Checa placar: if bird.x > tube spawnX => +1
    for (let pair of this.tubePairs) {
      if (!pair.scored && this.bird.x > pair.x) {
        pair.scored = true;
        this.score++;
        this.updateScoreText();
      }
    }
  }


  // ============================================================
  // TUBES
  // ============================================================
  // Função para spawnar tubos
  spawnTubes() {
    if (this.isGameOver) return;
    const centerY = Phaser.Math.Between(100, 350);
    const topTubeBottom = centerY - this.tubeGap / 2;
    const bottomTubeTop = centerY + this.tubeGap / 2;
    const spawnX = this.cameras.main.scrollX + this.cameras.main.width + 100;

    this.createTube(true, topTubeBottom, spawnX);
    this.createTube(false, bottomTubeTop, spawnX);

    // track for scoring
    this.tubePairs.push({ x: spawnX, scored: false });
  }

  // Cria um tubo individual, podendo ser superior ou inferior, e ajusta sua posição
  createTube(isTop, endY, spawnX) {
    const step = 32;
    const scale = 3;
    if (isTop) {
      let segmentY = 0;
      while (segmentY < endY - (step * scale) + 2) {
        let seg = this.tubes.create(spawnX, segmentY, 'tubeMiddle');
        seg.setOrigin(0, 0).setImmovable(true).body.allowGravity = false;
        seg.setScale(scale);
        segmentY += step * scale;
      }
      let tubeEndSprite = this.tubes.create(spawnX, endY - (step * scale), 'tubeEnd');
      tubeEndSprite.setOrigin(0, 0).setImmovable(true).body.allowGravity = false;
      tubeEndSprite.setFlipY(true);
      tubeEndSprite.setScale(scale);
    } else {
      let segmentY = endY + (step * scale);
      while (segmentY < this.sys.game.config.height) {
        let seg = this.tubes.create(spawnX, segmentY, 'tubeMiddle');
        seg.setOrigin(0, 0).setImmovable(true).body.allowGravity = false;
        seg.setScale(scale);
        segmentY += step * scale;
      }
      let tubeEndSprite = this.tubes.create(spawnX, endY, 'tubeEnd');
      tubeEndSprite.setOrigin(0, 0).setImmovable(true).body.allowGravity = false;
      tubeEndSprite.setScale(scale);
    }
  }

  onTubeCollision() {
    this.gameOver();
  }


  // ============================================================
  // DRONES
  // ============================================================
  spawnDrone() {
    const spawnX = this.cameras.main.scrollX + this.cameras.main.width + 50;
    let newY;
    let tries = 0;
    do {
      newY = Phaser.Math.Between(50, 400);
      tries++;
    } while (Math.abs(newY - this.lastDroneY) < 100 && tries < 10);

    this.lastDroneY = newY;
    const dr = this.drones.create(spawnX, newY, 'drone', 0);
    dr.play('droneIdle');
    dr.setScale(3);
    dr.flipX = true;
    dr.setVelocityX(-100);
    dr.body.setSize(dr.width * 0.4, dr.height * 0.5);

    this.time.addEvent({
      delay: 10000,
      callback: () => {
        if (dr.active) {
          dr.destroy();
        }
      }
    });
  }

  onDroneCollision() {
    this.gameOver();
  }


  // ============================================================
  // SCORE
  // ============================================================
  updateScoreText() {
    this.scoreText.setText(`Score: ${this.score}    High: ${this.highScore}`);
  }


  // ============================================================
  // GAME OVER
  // ============================================================
  gameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.physics.pause();
    this.bird.setTint(0xff1919);

    // highScore update
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.updateScoreText();

    // Mostra game over text e botão de restart
    this.gameOverText.setVisible(true);
    this.restartBtn.setVisible(true);
  }
}


// Full-screen config
const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT
  },
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: Cyberbird
};


const game = new Phaser.Game(config);
