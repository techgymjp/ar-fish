// グローバル変数としてThree.jsの主要な要素を宣言
let scene, camera, renderer;
let arSession = null; // ARセッションの状態を保持
let xrRefSpace = null; // AR空間の基準座標系
let hitTestSource = null; // 平面検出のためのヒットテストソース
let fishTexture = null; // GIFアニメーションのテクスチャ
let fishPlanes = []; // 配置された魚の平面オブジェクトを保持する配列
const fishCount = 5; // 配置する魚の数

// DOM要素の取得
const arCanvas = document.getElementById('ar-canvas');
const arStartButton = document.getElementById('ar-start-button');
const messageText = document.getElementById('message-text');

// Three.js シーンの初期化関数
function initThree() {
    // シーンの作成
    scene = new THREE.Scene();

    // レンダラーの作成と設定
    renderer = new THREE.WebGLRenderer({
        antialias: true, // アンチエイリアス（ギザギザを滑らかにする）を有効に
        alpha: true, // 透明度を有効にする (カメラ映像を背景にするため)
        canvas: arCanvas // 描画対象のキャンバスを指定
    });
    renderer.setPixelRatio(window.devicePixelRatio); // デバイスのピクセル比に合わせる
    renderer.setSize(window.innerWidth, window.innerHeight); // キャンバスサイズを設定
    renderer.xr.enabled = true; // XR（AR/VR）機能を有効に
    renderer.outputEncoding = THREE.sRGBEncoding; // 出力の色空間を設定

    // カメラの作成
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // 環境光の追加 (シーン全体を均等に照らす)
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // ウィンドウサイズ変更時のイベントリスナー
    window.addEventListener('resize', onWindowResize, false);
}

// ウィンドウサイズ変更時の処理
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight; // アスペクト比を更新
    camera.updateProjectionMatrix(); // プロジェクション行列を更新
    renderer.setSize(window.innerWidth, window.innerHeight); // レンダラーサイズを更新
}

// ARセッション開始ボタンのクリックイベントリスナー
arStartButton.addEventListener('click', async () => {
    // 既にARセッションが開始されている場合は何もしない
    if (arSession) {
        console.log('ARセッションは既に開始されています。');
        return;
    }

    try {
        // ARセッションをリクエスト
        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test', 'dom-overlay'], // ARに必要な機能（平面検出、DOM要素の重ね合わせ）
            optionalFeatures: ['light-probe'], // オプション機能（環境光の推定など）
            domOverlay: { root: document.body } // DOM要素をAR空間に重ねて表示できるようにする
        });

        // セッションが成功したら、グローバル変数に格納
        arSession = session;
        renderer.xr.setSession(session); // Three.jsレンダラーにセッションを紐付け
        messageText.style.display = 'block'; // メッセージを表示

        // セッション終了時のイベントリスナーを設定
        session.addEventListener('end', onSessionEnd);

        // 参照空間（AR空間の原点と向き）をリクエスト
        session.requestReferenceSpace('viewer').then((refSpace) => { // 'viewer'スペースを使って、常にデバイスの位置・向きを基準にする
            xrRefSpace = refSpace;
        });

        // ヒットテストソース（現実の平面を検出するためのもの）をリクエスト
        session.requestHitTestSource({ space: xrRefSpace }).then((source) => {
            hitTestSource = source;
        });

        // TextureLoaderを使ってGIF画像をロード
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('./assets/fish.gif', (texture) => {
            fishTexture = texture; // ロードしたテクスチャを格納
            
            // GIFは動画ではないので、アニメーション再生を有効にする
            // この設定により、Three.jsがGIFアニメーションを自動的に再生します
            texture.generateMipmaps = false; // ミップマップ生成を無効化（テクスチャがぼやけるのを防ぐ）
            texture.minFilter = THREE.LinearFilter; // 縮小時のフィルタリング
            texture.magFilter = THREE.LinearFilter; // 拡大時のフィルタリング
            texture.flipY = false; // Y軸を反転しない（GIFが上下反転する場合にtrueにする）

            // ARセッションが開始したらアニメーションループを開始
            renderer.setAnimationLoop(animate);
            arStartButton.style.display = 'none'; // ボタンを非表示
            messageText.textContent = 'スマートフォンをゆっくり動かして平面を探してください。';

        }, undefined, (error) => {
            console.error('GIF画像のロードエラー:', error);
            messageText.textContent = '魚の画像のロードに失敗しました。ファイル名やパスを確認してください。';
        });

    } catch (error) {
        // ARセッションの開始に失敗した場合のエラーハンドリング
        console.error('ARセッションの開始に失敗しました:', error);
        messageText.textContent = 'ARモードを開始できませんでした。デバイスが対応しているか、最新のブラウザか確認してください。';
        arStartButton.style.display = 'none'; // ボタンを非表示にする
    }
});

// ARセッション終了時の処理
function onSessionEnd() {
    console.log('ARセッションが終了しました。');
    arSession = null;
    hitTestSource = null;
    renderer.setAnimationLoop(null); // アニメーションループを停止
    arStartButton.style.display = 'block'; // ボタンを再表示
    messageText.style.display = 'none'; // メッセージを非表示
    
    // 配置した魚をシーンから削除し、配列をクリア
    fishPlanes.forEach(fish => scene.remove(fish));
    fishPlanes.length = 0;
}

// アニメーションループ (WebXRのフレームごとに呼び出される)
function animate(time, frame) {
    // ヒットテスト（平面検出）
    if (frame && hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length > 0) {
            const hitPose = hitTestResults[0].getPose(xrRefSpace); // 検出された平面の姿勢（位置と向き）

            if (hitPose && fishPlanes.length === 0) { // まだ魚が配置されていない場合
                messageText.textContent = 'タップして魚を配置'; // メッセージ更新
                
                // 平面検出されたら、自動で魚を配置（ここではタップなしで自動配置）
                placeFish(hitPose.transform.position, hitPose.transform.orientation);
                
                messageText.style.display = 'none'; // メッセージを非表示
                hitTestSource.cancel(); // 最初の平面検出でヒットテストを停止
                hitTestSource = null; // nullにすることで、二度と実行されないようにする
            }
        }
    }
    
    // 各魚の自律的な動きを更新
    fishPlanes.forEach(fish => {
        // 簡単な移動アニメーション
        fish.position.x += fish.userData.speedX * 0.01; // 0.01は速度調整
        fish.position.y += fish.userData.speedY * 0.01;
        fish.position.z += fish.userData.speedZ * 0.01;

        // シーンの境界を超えないようにする (例: -3から3の範囲)
        // 画面外に出そうになったら向きを変える
        if (fish.position.x > 3 || fish.position.x < -3) fish.userData.speedX *= -1;
        if (fish.position.y > 1.5 || fish.position.y < 0.1) fish.userData.speedY *= -1; // 地面より上 (0.1mから1.5mの間)
        if (fish.position.z > 3 || fish.position.z < -3) fish.userData.speedZ *= -1;

        // 進行方向に向かって向きを変える (Y軸回転)
        // atan2を使って、xとzの動きから角度を計算
        const angle = Math.atan2(fish.userData.speedX, fish.userData.speedZ);
        fish.rotation.y = angle; // Y軸回転を直接設定
    });

    // Three.jsのシーンをレンダリング
    renderer.render(scene, camera);
}

// 魚をAR空間に配置する関数
function placeFish(initialPosition, initialOrientation) {
    for (let i = 0; i < fishCount; i++) {
        // GIF画像を貼り付けるための平面ジオメトリを作成
        // GIFの縦横比に合わせて調整（例: fish.gifが200x100pxならaspectRatioは2）
        const aspectRatio = fishTexture.image.width / fishTexture.image.height;
        const planeGeometry = new THREE.PlaneGeometry(0.5 * aspectRatio, 0.5); // 幅0.5m基準

        // マテリアルの作成 (テクスチャと透明度を設定)
        const material = new THREE.MeshBasicMaterial({
            map: fishTexture,
            transparent: true, // 透明部分を透過させる
            side: THREE.DoubleSide // 両面表示 (魚が裏返っても見えるように)
        });

        // 魚のメッシュ（平面）を作成
        const fishInstance = new THREE.Mesh(planeGeometry, material);

        // 初期位置をランダムにずらす
        fishInstance.position.set(
            initialPosition.x + (Math.random() - 0.5) * 1.5, // -0.75m から 0.75m くらいの範囲でランダムにずらす
            initialPosition.y + (Math.random() * 0.5), // 地面から少し浮かせた位置 (0m から 0.5m の間)
            initialPosition.z + (Math.random() - 0.5) * 1.5
        );

        // 各魚の速度をランダムに設定
        fishInstance.userData.speedX = (Math.random() - 0.5) * 0.5; // -0.25から0.25
        fishInstance.userData.speedY = (Math.random() - 0.5) * 0.2; // -0.1から0.1
        fishInstance.userData.speedZ = (Math.random() - 0.5) * 0.5;

        // シーンに魚を追加
        scene.add(fishInstance);
        fishPlanes.push(fishInstance); // 配列に格納
    }
}

// アプリケーションの開始時にThree.jsを初期化
initThree();

// WebXR (AR) がサポートされているかチェックし、ボタンの表示を制御
if ('xr' in navigator) {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (supported) {
            arStartButton.style.display = 'block'; // サポートされていればボタンを表示
            messageText.style.display = 'none'; // メッセージは非表示
        } else {
            arStartButton.style.display = 'none'; // サポートされていなければボタンを非表示
            messageText.style.display = 'block'; // メッセージを表示
            messageText.textContent = 'お使いのデバイスはARモードに対応していません。';
        }
    });
} else {
    // WebXR自体がサポートされていない場合
    arStartButton.style.display = 'none';
    messageText.style.display = 'block';
    messageText.textContent = 'WebXR (AR) がサポートされていません。最新のChrome/Safariなどを使用してください。';
}

// Canvasのクリックイベント（今回は未使用だが、今後の拡張のために残しておく）
arCanvas.addEventListener('click', () => {
    console.log('Canvas clicked.');
    // 必要であれば、ここにタップで魚を追加するなどのロジックを実装
});