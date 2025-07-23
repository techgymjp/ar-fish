document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    const arStartButton = document.getElementById('ar-start-button');
    const arButtonContainer = document.getElementById('ar-button-container');

    arStartButton.addEventListener('click', () => {
        arButtonContainer.style.display = 'none';
        scene.addEventListener('enter-vr', () => {
            if (scene.is('ar-mode')) {
                console.log('ARモードに入りました！');
                placeFishInAR();
            }
        });
    });

    function placeFishInAR() {
        const numberOfFish = 5; // 魚の数

        for (let i = 0; i < numberOfFish; i++) {
            const fish = document.createElement('a-entity');
            
            // ★ここを変更★
            // gltf-model の代わりに image コンポーネントを使用し、画像のIDを指定
            fish.setAttribute('image', '#fish-image'); 
            
            // 魚の初期位置をランダムに設定（AR空間の原点付近に配置）
            const x = (Math.random() * 4 - 2);
            const y = (Math.random() * 0.5 + 0.5); // 地面より少し上
            const z = (Math.random() * 4 - 2);
            fish.setAttribute('position', `${x} ${y} ${z}`);

            // 魚のサイズを調整 (画像の縦横比を考慮して調整してください)
            // imageコンポーネントはデフォルトで平面なので、Z軸のスケールは通常1でOK
            const scaleFactor = 0.5; // 例: 0.5倍
            fish.setAttribute('scale', `${scaleFactor} ${scaleFactor} 1`); 

            // 魚のアニメーション (2D画像なので、主に位置移動やY軸回転で表現)
            const animationDuration = 5000 + Math.random() * 3000;
            
            // 例: Y軸を中心に回転させ、常にカメラの方を向いているように見せる
            fish.setAttribute('animation', {
                property: 'rotation',
                to: '0 360 0', // Y軸を中心に回転
                loop: true,
                dur: animationDuration,
                easing: 'linear'
            });

            // 例: 左右にゆっくり動くアニメーションを追加
            fish.setAttribute('animation__moveX', { // 別のアニメーションとして追加
                property: 'position.x',
                from: x - 0.5,
                to: x + 0.5,
                dir: 'alternate', // 行ったり来たり
                loop: true,
                dur: animationDuration * 1.5 // 少しゆっくり動く
            });

            scene.appendChild(fish);
        }
    }
});