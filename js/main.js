import * as THREE from "./three.module.min.js";
import { PLYLoader } from "./PLYLoader.js";

// カメラ映像を取得
const video = document.getElementById("camera");
navigator.mediaDevices
  .getUserMedia({ video: { facingMode: { exact: "environment" } } })
  .then((stream) => {
    video.srcObject = stream;
  })
  .catch((err) => {
    console.error("Error accessing the camera: ", err);
  });

// Three.jsのセットアップ
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// PLYモデルの読み込み
const loader = new PLYLoader();
loader.load("models/model.ply", function (geometry) {
  const material = new THREE.PointsMaterial({ size: 0.01, color: 0x00ff00 });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
});

camera.position.z = 5;

// レンダリングループ
const animate = function () {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
};

animate();
