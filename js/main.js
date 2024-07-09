const video = document.getElementById('camera');

// カメラ映像を取得
navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "environment" } } })
    .then(stream => {
        video.srcObject = stream;
    });

// Three.jsのセットアップ
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// AR.jsのセットアップ
const arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam'
});

arToolkitSource.init(() => {
    setTimeout(() => {
        onResize()
    }, 2000);
});

const arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: 'data/camera_para.dat',
    detectionMode: 'mono'
});

arToolkitContext.init(() => {
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
});

const onResize = () => {
    arToolkitSource.onResizeElement();
    arToolkitSource.copyElementSizeTo(renderer.domElement);
    if (arToolkitContext.arController !== null) {
        arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
    }
};

window.addEventListener('resize', () => {
    onResize();
});

// PLYモデルの読み込み
const loader = new THREE.PLYLoader();
loader.load('models/model.ply', function (geometry) {
    const material = new THREE.PointsMaterial({ size: 0.01, color: 0x00ff00 });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
});

camera.position.z = 5;

// レンダリングループ
const animate = function () {
    requestAnimationFrame(animate);

    if (arToolkitSource.ready === false) return;

    arToolkitContext.update(arToolkitSource.domElement);

    renderer.render(scene, camera);
};

animate();
