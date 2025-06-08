// ============================================================================
// マリオカート風レーシングゲーム - 統合版
// ============================================================================

// ============================================================================
// ゲーム設定
// ============================================================================
const GameConfig = {
    // カート設定
    KART_SPEED: 0.5,
    TURN_SPEED: 0.03,
    DRIFT_FACTOR: 1.5,
    
    // コース設定
    TRACK_WIDTH: 8,
    TRACK_SEGMENTS: 64,
    
    // 色設定
    KART_COLORS: [0xff0000, 0x0000ff, 0x00ff00, 0xffff00],
    
    // アイテム設定
    ITEM_TYPES: ['🍄', '🔥', '⭐'],
    ITEM_RESPAWN_TIME: 10000, // 10秒
    
    // ゲーム設定
    TOTAL_LAPS: 3,
    MAX_KARTS: 4,
    
    // 物理設定
    GRAVITY: -0.01,
    FRICTION: 0.95,
    
    // カメラ設定
    CAMERA_OFFSET: new THREE.Vector3(0, 8, 10),
    CAMERA_LERP_SPEED: 0.05
};

// グローバル変数
let scene, camera, renderer;
let playerKart;
let karts = [];
let itemBoxes = [];
let checkpoints = [];
let currentItem = null;
let gameTime = 0;
let lapCount = 1;
let lastCheckpoint = 0;
let gameEngine, inputHandler, aiController, itemSystem;

// ============================================================================
// 入力管理クラス
// ============================================================================
class InputHandler {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            drift: false,
            item: false
        };
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        switch(event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = true;
                event.preventDefault();
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = true;
                event.preventDefault();
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = true;
                event.preventDefault();
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = true;
                event.preventDefault();
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.drift = true;
                event.preventDefault();
                break;
            case 'Space':
                this.keys.item = true;
                event.preventDefault();
                break;
        }
    }
    
    handleKeyUp(event) {
        switch(event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = false;
                event.preventDefault();
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = false;
                event.preventDefault();
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = false;
                event.preventDefault();
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = false;
                event.preventDefault();
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.drift = false;
                event.preventDefault();
                break;
            case 'Space':
                this.keys.item = false;
                event.preventDefault();
                break;
        }
    }
    
    isPressed(key) {
        return this.keys[key];
    }
}

// ============================================================================
// トラック作成クラス
// ============================================================================
class TrackBuilder {
    constructor(scene) {
        this.scene = scene;
    }
    
    createTrack() {
        this.createGround();
        this.createRaceTrack();
        this.createWalls();
        this.createCheckpoints();
    }
    
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }
    
    createRaceTrack() {
        const trackWidth = GameConfig.TRACK_WIDTH;
        const trackPoints = this.generateTrackPoints();
        
        // トラック外側と内側の点を計算
        const outerPoints = trackPoints.map(p => new THREE.Vector3(
            p.x + Math.sin(Math.atan2(p.z, p.x)) * trackWidth,
            p.y,
            p.z - Math.cos(Math.atan2(p.z, p.x)) * trackWidth
        ));
        
        const innerPoints = trackPoints.map(p => new THREE.Vector3(
            p.x - Math.sin(Math.atan2(p.z, p.x)) * trackWidth,
            p.y,
            p.z + Math.cos(Math.atan2(p.z, p.x)) * trackWidth
        ));
        
        // トラック面を作成
        const trackGeometry = this.createTrackGeometry(innerPoints, outerPoints);
        const trackMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const track = new THREE.Mesh(trackGeometry, trackMaterial);
        track.receiveShadow = true;
        this.scene.add(track);
        
        // トラックポイントを保存（チェックポイント用）
        this.trackPoints = trackPoints;
    }
    
    generateTrackPoints() {
        const trackPoints = [];
        const segments = GameConfig.TRACK_SEGMENTS;
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * 30 + Math.sin(angle * 2) * 10;
            const z = Math.sin(angle) * 40 + Math.cos(angle * 3) * 5;
            trackPoints.push(new THREE.Vector3(x, 0.1, z));
        }
        
        return trackPoints;
    }
    
    createTrackGeometry(innerPoints, outerPoints) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        
        for (let i = 0; i < innerPoints.length - 1; i++) {
            vertices.push(
                innerPoints[i].x, innerPoints[i].y, innerPoints[i].z,
                outerPoints[i].x, outerPoints[i].y, outerPoints[i].z,
                innerPoints[i + 1].x, innerPoints[i + 1].y, innerPoints[i + 1].z,
                outerPoints[i + 1].x, outerPoints[i + 1].y, outerPoints[i + 1].z
            );
            
            const base = i * 4;
            indices.push(
                base, base + 1, base + 2,
                base + 1, base + 3, base + 2
            );
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        return geometry;
    }
    
    createWalls() {
        if (!this.trackPoints) return;
        
        const wallGeometry = new THREE.BoxGeometry(2, 3, 2);
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        for (let i = 0; i < this.trackPoints.length - 1; i += 3) {
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.copy(this.trackPoints[i]);
            wall.position.y = 1.5;
            wall.castShadow = true;
            this.scene.add(wall);
        }
    }
    
    createCheckpoints() {
        const checkpointPositions = [
            new THREE.Vector3(30, 1, 0),   // スタート
            new THREE.Vector3(0, 1, 40),   // 上
            new THREE.Vector3(-30, 1, 0),  // 左
            new THREE.Vector3(0, 1, -40)   // 下
        ];
        
        checkpointPositions.forEach((pos, index) => {
            checkpoints.push({
                position: pos,
                index: index
            });
        });
    }
}

// ============================================================================
// カート管理クラス
// ============================================================================
class KartManager {
    constructor(scene) {
        this.scene = scene;
        this.karts = [];
    }
    
    createKarts() {
        const startPositions = [
            new THREE.Vector3(30, 1, 0),
            new THREE.Vector3(32, 1, 2),
            new THREE.Vector3(32, 1, -2),
            new THREE.Vector3(34, 1, 0)
        ];
        
        for (let i = 0; i < GameConfig.MAX_KARTS; i++) {
            const kart = this.createKart(i, startPositions[i]);
            this.karts.push(kart);
            this.scene.add(kart);
            
            if (i === 0) {
                playerKart = kart;
            }
        }
        
        // グローバル配列に設定
        karts = this.karts;
    }
    
    createKart(index, position) {
        const kartGroup = new THREE.Group();
        
        // カート本体
        const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 3);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: GameConfig.KART_COLORS[index] 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.4;
        body.castShadow = true;
        kartGroup.add(body);
        
        // ホイール作成
        const wheels = this.createWheels();
        wheels.forEach(wheel => kartGroup.add(wheel));
        
        // カートデータ設定
        kartGroup.position.copy(position);
        kartGroup.userData = {
            speed: 0,
            maxSpeed: GameConfig.KART_SPEED,
            turnSpeed: 0,
            isPlayer: index === 0,
            wheels: wheels,
            aiTarget: 0,
            driftTime: 0,
            index: index
        };
        
        return kartGroup;
    }
    
    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        
        const wheels = [];
        const wheelPositions = [
            new THREE.Vector3(-0.8, 0.4, 1.2),
            new THREE.Vector3(0.8, 0.4, 1.2),
            new THREE.Vector3(-0.8, 0.4, -1.2),
            new THREE.Vector3(0.8, 0.4, -1.2)
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.copy(pos);
            wheel.castShadow = true;
            wheels.push(wheel);
        });
        
        return wheels;
    }
    
    updateKart(kart, deltaTime) {
        const userData = kart.userData;
        
        if (userData.isPlayer) {
            this.updatePlayerKart(kart, deltaTime);
        } else {
            aiController.updateAI(kart);
        }
        
        this.applyPhysics(kart);
        this.updateWheels(kart);
        this.applyDriftEffects(kart);
    }
    
    updatePlayerKart(kart, deltaTime) {
        const userData = kart.userData;
        
        // 前進・後退
        if (inputHandler.isPressed('forward')) {
            userData.speed = Math.min(userData.speed + 0.02, userData.maxSpeed);
        } else if (inputHandler.isPressed('backward')) {
            userData.speed = Math.max(userData.speed - 0.02, -userData.maxSpeed * 0.5);
        } else {
            userData.speed *= GameConfig.FRICTION;
        }
        
        // ステアリング
        if (inputHandler.isPressed('left')) {
            userData.turnSpeed = inputHandler.isPressed('drift') ? 
                GameConfig.TURN_SPEED * GameConfig.DRIFT_FACTOR : GameConfig.TURN_SPEED;
            if (inputHandler.isPressed('drift') && userData.speed > 0.1) {
                userData.driftTime += deltaTime;
            }
        } else if (inputHandler.isPressed('right')) {
            userData.turnSpeed = inputHandler.isPressed('drift') ? 
                -GameConfig.TURN_SPEED * GameConfig.DRIFT_FACTOR : -GameConfig.TURN_SPEED;
            if (inputHandler.isPressed('drift') && userData.speed > 0.1) {
                userData.driftTime += deltaTime;
            }
        } else {
            userData.turnSpeed = 0;
            if (!inputHandler.isPressed('drift')) {
                userData.driftTime = 0;
            }
        }
        
        // アイテム使用
        if (inputHandler.isPressed('item') && currentItem) {
            itemSystem.useItem(currentItem, kart);
            currentItem = null;
            itemSystem.updateItemDisplay();
        }
    }
    
    applyPhysics(kart) {
        const userData = kart.userData;
        
        if (Math.abs(userData.speed) > 0.01) {
            // ステアリング効果を速度に比例
            const steerEffect = Math.min(Math.abs(userData.speed) / userData.maxSpeed, 1);
            kart.rotation.y += userData.turnSpeed * steerEffect;
            
            // 前方向ベクトルを計算
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(kart.quaternion);
            
            // 位置更新
            kart.position.add(forward.multiplyScalar(userData.speed));
        }
    }
    
    updateWheels(kart) {
        const userData = kart.userData;
        userData.wheels.forEach(wheel => {
            wheel.rotation.x += userData.speed * 2;
        });
    }
    
    applyDriftEffects(kart) {
        const userData = kart.userData;
        
        if (userData.driftTime > 1 && userData.isPlayer) {
            userData.maxSpeed = GameConfig.KART_SPEED * 1.2; // スピードブースト
        } else {
            userData.maxSpeed = GameConfig.KART_SPEED;
        }
    }
}

// ============================================================================
// アイテムシステムクラス
// ============================================================================
class ItemSystem {
    constructor(scene) {
        this.scene = scene;
        this.itemBoxes = [];
        this.activeEffects = [];
    }
    
    createItemBoxes() {
        const itemPositions = [
            new THREE.Vector3(20, 2, 30),
            new THREE.Vector3(-20, 2, 20),
            new THREE.Vector3(35, 2, -15),
            new THREE.Vector3(-30, 2, -25),
            new THREE.Vector3(0, 2, 45),
            new THREE.Vector3(15, 2, -35)
        ];
        
        itemPositions.forEach(pos => {
            const itemBox = this.createItemBox(pos);
            this.itemBoxes.push(itemBox);
            this.scene.add(itemBox);
        });
        
        // グローバル配列に設定
        itemBoxes = this.itemBoxes;
    }
    
    createItemBox(position) {
        const boxGroup = new THREE.Group();
        
        // アイテムボックス本体
        const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
        const boxMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFD700,
            transparent: true,
            opacity: 0.8
        });
        const itemBox = new THREE.Mesh(boxGeometry, boxMaterial);
        itemBox.castShadow = true;
        boxGroup.add(itemBox);
        
        // ?マーク（簡易版）
        const textGeometry = new THREE.PlaneGeometry(1, 1);
        const textMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            transparent: true
        });
        const questionMark = new THREE.Mesh(textGeometry, textMaterial);
        questionMark.position.set(0, 0, 1.01);
        boxGroup.add(questionMark);
        
        boxGroup.position.copy(position);
        boxGroup.userData = { collected: false };
        
        return boxGroup;
    }
    
    updateItemBoxes() {
        this.itemBoxes.forEach(itemBox => {
            if (!itemBox.userData.collected) {
                itemBox.rotation.y += 0.02;
                itemBox.rotation.x = Math.sin(gameTime * 2) * 0.1;
            }
        });
    }
    
    checkItemCollisions(playerKart) {
        this.itemBoxes.forEach(itemBox => {
            if (!itemBox.userData.collected && 
                playerKart.position.distanceTo(itemBox.position) < 3) {
                
                this.collectItem(itemBox);
            }
        });
    }
    
    collectItem(itemBox) {
        itemBox.userData.collected = true;
        itemBox.visible = false;
        
        // ランダムアイテム取得
        const randomItem = GameConfig.ITEM_TYPES[
            Math.floor(Math.random() * GameConfig.ITEM_TYPES.length)
        ];
        currentItem = randomItem;
        this.updateItemDisplay();
        
        // アイテムボックス復活
        setTimeout(() => {
            itemBox.userData.collected = false;
            itemBox.visible = true;
        }, GameConfig.ITEM_RESPAWN_TIME);
    }
    
    useItem(item, kart) {
        switch(item) {
            case '🍄': // キノコ - スピードアップ
                this.applySpeedBoost(kart, 1.5, 2000);
                break;
                
            case '🔥': // ファイア - 前方攻撃
                this.createFireEffect(kart);
                break;
                
            case '⭐': // スター - 無敵
                this.applyInvincibility(kart, 2.0, 3000);
                break;
        }
    }
    
    applySpeedBoost(kart, multiplier, duration) {
        kart.userData.maxSpeed = GameConfig.KART_SPEED * multiplier;
        
        const effect = {
            kart: kart,
            type: 'speedBoost',
            endTime: Date.now() + duration,
            originalMaxSpeed: GameConfig.KART_SPEED
        };
        this.activeEffects.push(effect);
    }
    
    applyInvincibility(kart, multiplier, duration) {
        kart.userData.maxSpeed = GameConfig.KART_SPEED * multiplier;
        kart.userData.invincible = true;
        
        const effect = {
            kart: kart,
            type: 'invincibility',
            endTime: Date.now() + duration,
            originalMaxSpeed: GameConfig.KART_SPEED
        };
        this.activeEffects.push(effect);
    }
    
    createFireEffect(kart) {
        const fireGeometry = new THREE.SphereGeometry(1);
        const fireMaterial = new THREE.MeshBasicMaterial({ color: 0xff4500 });
        const fireEffect = new THREE.Mesh(fireGeometry, fireMaterial);
        
        fireEffect.position.copy(kart.position);
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(kart.quaternion);
        fireEffect.position.add(forward.multiplyScalar(3));
        
        this.scene.add(fireEffect);
        
        setTimeout(() => {
            this.scene.remove(fireEffect);
        }, 1000);
    }
    
    updateActiveEffects() {
        const currentTime = Date.now();
        
        this.activeEffects = this.activeEffects.filter(effect => {
            if (currentTime >= effect.endTime) {
                // エフェクト終了
                effect.kart.userData.maxSpeed = effect.originalMaxSpeed;
                if (effect.type === 'invincibility') {
                    effect.kart.userData.invincible = false;
                }
                return false;
            }
            return true;
        });
    }
    
    updateItemDisplay() {
        const itemDisplay = document.getElementById('itemDisplay');
        if (currentItem) {
            itemDisplay.textContent = currentItem;
            itemDisplay.style.display = 'flex';
        } else {
            itemDisplay.style.display = 'none';
        }
    }
}

// ============================================================================
// AI制御クラス
// ============================================================================
class AIController {
    constructor() {
        this.difficultySettings = {
            easy: { maxSpeed: 0.6, turnAccuracy: 0.8 },
            medium: { maxSpeed: 0.8, turnAccuracy: 0.9 },
            hard: { maxSpeed: 1.0, turnAccuracy: 0.95 }
        };
        this.currentDifficulty = 'medium';
    }
    
    updateAI(kart) {
        const userData = kart.userData;
        const settings = this.difficultySettings[this.currentDifficulty];
        
        // 目標チェックポイントを取得
        const target = this.getTargetCheckpoint(kart);
        
        // 目標への方向を計算
        const direction = this.calculateDirection(kart, target);
        
        // ステアリング制御
        this.controlSteering(kart, direction, settings);
        
        // スピード制御
        this.controlSpeed(kart, direction, settings);
        
        // チェックポイント更新
        this.updateCheckpoint(kart, target);
        
        // 障害物回避
        this.avoidObstacles(kart);
    }
    
    getTargetCheckpoint(kart) {
        const userData = kart.userData;
        return checkpoints[userData.aiTarget % checkpoints.length];
    }
    
    calculateDirection(kart, target) {
        return new THREE.Vector3()
            .subVectors(target.position, kart.position)
            .normalize();
    }
    
    controlSteering(kart, direction, settings) {
        const userData = kart.userData;
        
        // カートの現在の向きを取得
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(kart.quaternion);
        
        // 角度差を計算
        const cross = new THREE.Vector3().crossVectors(forward, direction);
        const dot = forward.dot(direction);
        
        // ステアリング決定
        const steerThreshold = 0.1 * settings.turnAccuracy;
        
        if (cross.y > steerThreshold) {
            userData.turnSpeed = GameConfig.TURN_SPEED;
        } else if (cross.y < -steerThreshold) {
            userData.turnSpeed = -GameConfig.TURN_SPEED;
        } else {
            userData.turnSpeed = 0;
        }
        
        // コーナリング時のドリフト判定
        if (Math.abs(cross.y) > 0.3 && userData.speed > 0.3) {
            userData.turnSpeed *= GameConfig.DRIFT_FACTOR * 0.8;
            userData.driftTime += 0.016;
        } else {
            userData.driftTime = 0;
        }
    }
    
    controlSpeed(kart, direction, settings) {
        const userData = kart.userData;
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(kart.quaternion);
        
        const dot = forward.dot(direction);
        const maxAISpeed = GameConfig.KART_SPEED * settings.maxSpeed;
        
        // 前方を向いている場合は加速
        if (dot > 0.8) {
            userData.speed = Math.min(
                userData.speed + 0.01, 
                maxAISpeed
            );
        } else if (dot > 0.5) {
            // 少し斜めの場合は中速
            userData.speed = Math.min(
                userData.speed + 0.005, 
                maxAISpeed * 0.7
            );
        } else {
            // 大きく向きが違う場合は減速
            userData.speed = Math.max(
                userData.speed - 0.01, 
                maxAISpeed * 0.3
            );
        }
        
        // 最低速度を保証
        if (userData.speed < 0.1) {
            userData.speed = 0.1;
        }
    }
    
    updateCheckpoint(kart, target) {
        const userData = kart.userData;
        
        // チェックポイントに近づいたら次へ
        if (kart.position.distanceTo(target.position) < 15) {
            userData.aiTarget++;
        }
    }
    
    avoidObstacles(kart) {
        const userData = kart.userData;
        
        // 他のカートとの衝突回避
        karts.forEach(otherKart => {
            if (otherKart === kart) return;
            
            const distance = kart.position.distanceTo(otherKart.position);
            if (distance < 5) {
                // 回避行動
                const avoidDirection = new THREE.Vector3()
                    .subVectors(kart.position, otherKart.position)
                    .normalize();
                
                // 横方向に少し移動
                const sideStep = new THREE.Vector3(-avoidDirection.z, 0, avoidDirection.x);
                kart.position.add(sideStep.multiplyScalar(0.1));
                
                // 少し減速
                userData.speed *= 0.95;
            }
        });
        
        // コースの境界チェック
        const distanceFromCenter = kart.position.length();
        if (distanceFromCenter > 50) {
            // コース中央に向かう力を加える
            const centerDirection = new THREE.Vector3()
                .copy(kart.position)
                .negate()
                .normalize();
            
            kart.position.add(centerDirection.multiplyScalar(0.2));
        }
    }
    
    setDifficulty(difficulty) {
        if (this.difficultySettings[difficulty]) {
            this.currentDifficulty = difficulty;
        }
    }
    
    // ラバーバンドAI - プレイヤーとの距離に応じて難易度調整
    updateRubberBandAI() {
        if (!playerKart) return;
        
        karts.forEach(kart => {
            if (kart.userData.isPlayer) return;
            
            const distanceToPlayer = kart.position.distanceTo(playerKart.position);
            
            // プレイヤーから離れすぎている場合はスピードアップ
            if (distanceToPlayer > 30) {
                kart.userData.maxSpeed = GameConfig.KART_SPEED * 1.2;
            }
            // プレイヤーに近すぎる場合は少し減速
            else if (distanceToPlayer < 10) {
                kart.userData.maxSpeed = GameConfig.KART_SPEED * 0.9;
            } else {
                kart.userData.maxSpeed = GameConfig.KART_SPEED;
            }
        });
    }
}

// ============================================================================
// ゲームエンジンクラス
// ============================================================================
class GameEngine {
    constructor() {
        this.trackBuilder = null;
        this.kartManager = null;
        this.itemSystem = null;
        this.aiController = null;
        this.camera = null;
        this.renderer = null;
        this.scene = null;
    }
    
    init() {
        this.createScene();
        this.setupLighting();
        this.setupRenderer();
        this.setupCamera();
        
        // ゲームコンポーネント初期化
        this.trackBuilder = new TrackBuilder(this.scene);
        this.kartManager = new KartManager(this.scene);
        this.itemSystem = new ItemSystem(this.scene);
        this.aiController = new AIController();
        
        // グローバル変数に設定
        scene = this.scene;
        camera = this.camera;
        renderer = this.renderer;
        aiController = this.aiController;
        itemSystem = this.itemSystem;
        
        // ゲーム要素作成
        this.trackBuilder.createTrack();
        this.kartManager.createKarts();
        this.itemSystem.createItemBoxes();
        
        // 入力ハンドラー初期化
        inputHandler = new InputHandler();
        
        // イベントリスナー設定
        this.setupEventListeners();
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
    }
    
    setupLighting() {
        // 環境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // 指向性ライト
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        
        // シャドウ設定
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        
        this.scene.add(directionalLight);
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x87CEEB);
        
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    update(deltaTime) {
        // カート更新
        karts.forEach(kart => {
            this.kartManager.updateKart(kart, deltaTime);
        });
        
        // AI更新
        this.aiController.updateRubberBandAI();
        
        // アイテムシステム更新
        this.itemSystem.updateItemBoxes();
        this.itemSystem.checkItemCollisions(playerKart);
        this.itemSystem.updateActiveEffects();
        
        // 衝突検出
        this.checkCollisions();
        
        // カメラ更新
        this.updateCamera();
        
        // UI更新
        this.updateUI();
        
        // ゲーム時間更新
        gameTime += deltaTime;
    }
    
    checkCollisions() {
        // チェックポイント通過チェック
        if (checkpoints.length > 0) {
            const currentCheckpoint = checkpoints[lastCheckpoint % checkpoints.length];
            if (playerKart.position.distanceTo(currentCheckpoint.position) < 15) {
                lastCheckpoint++;
                if (lastCheckpoint % checkpoints.length === 0 && lastCheckpoint > 0) {
                    lapCount++;
                    if (lapCount > GameConfig.TOTAL_LAPS) {
                        this.handleRaceFinish();
                    }
                }
            }
        }
    }
    
    updateCamera() {
        if (!playerKart) return;
        
        // カメラの理想位置を計算
        const idealPosition = GameConfig.CAMERA_OFFSET.clone();
        idealPosition.applyQuaternion(playerKart.quaternion);
        idealPosition.add(playerKart.position);
        
        // スムーズにカメラを移動
        this.camera.position.lerp(idealPosition, GameConfig.CAMERA_LERP_SPEED);
        this.camera.lookAt(playerKart.position);
    }
    
    updateUI() {
        const minutes = Math.floor(gameTime / 60);
        const seconds = Math.floor(gameTime % 60);
        
        // UI要素更新
        document.getElementById('lap').textContent = lapCount;
        document.getElementById('time').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // スピードメーター更新
        const speed = Math.abs(playerKart.userData.speed) * 100;
        document.getElementById('speedometer').textContent = 
            `${Math.round(speed)} km/h`;
        
        // 順位計算（簡易版）
        const playerPosition = this.calculatePosition();
        document.getElementById('position').textContent = playerPosition;
    }
    
    calculatePosition() {
        // 簡易的な順位計算
        let position = 1;
        
        karts.forEach(kart => {
            if (kart === playerKart) return;
            
            // ラップ数で比較
            const kartLap = Math.floor(kart.userData.aiTarget / checkpoints.length) + 1;
            if (kartLap > lapCount) {
                position++;
            } else if (kartLap === lapCount) {
                // 同じラップなら次のチェックポイントまでの距離で比較
                const playerDistToNext = playerKart.position.distanceTo(
                    checkpoints[lastCheckpoint % checkpoints.length].position
                );
                const kartDistToNext = kart.position.distanceTo(
                    checkpoints[kart.userData.aiTarget % checkpoints.length].position
                );
                
                if (kartDistToNext < playerDistToNext) {
                    position++;
                }
            }
        });
        
        return position;
    }
    
    handleRaceFinish() {
        alert('ゴール！おめでとうございます！');
        this.resetRace();
    }
    
    resetRace() {
        lapCount = 1;
        lastCheckpoint = 0;
        gameTime = 0;
        currentItem = null;
        
        // カートの位置をリセット
        const startPositions = [
            new THREE.Vector3(30, 1, 0),
            new THREE.Vector3(32, 1, 2),
            new THREE.Vector3(32, 1, -2),
            new THREE.Vector3(34, 1, 0)
        ];
        
        karts.forEach((kart, index) => {
            kart.position.copy(startPositions[index]);
            kart.rotation.set(0, 0, 0);
            kart.userData.speed = 0;
            kart.userData.turnSpeed = 0;
            kart.userData.aiTarget = 0;
            kart.userData.driftTime = 0;
        });
        
        this.itemSystem.updateItemDisplay();
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

// ============================================================================
// メインゲーム実行部分
// ============================================================================
let lastTime = 0;

// ゲーム初期化
function init() {
    console.log('🏁 マリオカート風ゲーム開始！');
    
    // ゲームエンジン初期化
    gameEngine = new GameEngine();
    gameEngine.init();
    
    console.log('✅ ゲーム初期化完了');
    
    // アニメーションループ開始
    animate(0);
}

// メインアニメーションループ
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    // デルタタイム計算
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // フレームレート制限（60FPS）
    if (deltaTime < 1/60) {
        // ゲーム更新
        gameEngine.update(Math.min(deltaTime, 0.016));
        
        // レンダリング
        gameEngine.render();
    }
}

// ページロード時にゲーム開始
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 ページロード完了、ゲーム初期化中...');
    init();
});

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('❌ ゲームエラー:', event.error);
});

// ============================================================================
// デバッグ機能
// ============================================================================
window.debugGame = {
    resetRace: () => {
        if (gameEngine) {
            gameEngine.resetRace();
            console.log('🔄 レースリセット');
        }
    },
    
    setAIDifficulty: (difficulty) => {
        if (aiController) {
            aiController.setDifficulty(difficulty);
            console.log(`🤖 AI難易度変更: ${difficulty}`);
        }
    },
    
    giveItem: (itemType) => {
        if (GameConfig.ITEM_TYPES.includes(itemType)) {
            currentItem = itemType;
            itemSystem.updateItemDisplay();
            console.log(`🎁 アイテム取得: ${itemType}`);
        }
    },
    
    getGameState: () => {
        return {
            lapCount,
            gameTime,
            playerPosition: playerKart ? playerKart.position : null,
            currentItem,
            kartsCount: karts.length
        };
    }
};

console.log('🎮 デバッグコマンド利用可能:');
console.log('- debugGame.resetRace() - レースリセット');
console.log('- debugGame.setAIDifficulty("easy"|"medium"|"hard") - AI難易度変更');
console.log('- debugGame.giveItem("🍄"|"🔥"|"⭐") - アイテム取得');
console.log('- debugGame.getGameState() - ゲーム状態確認');