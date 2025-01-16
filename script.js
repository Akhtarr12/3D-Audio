const audioInput = document.getElementById("audio");
let noise = new SimplexNoise();
const area = document.getElementById("visualiser");
const label = document.getElementById("label");
const filenameDiv = document.getElementById("filename");

audioInput.addEventListener("change", setAudio, false);
let audio = new Audio("Still.mp3");

function setAudio() {
  audio.pause();
  const audioFile = this.files[0];
  if (audioFile.name.includes(".mp3")) {
    const audioURL = URL.createObjectURL(audioFile);
    audio = new Audio(audioURL);
    clearScene();
    startVis();
    filenameDiv.textContent = `Now Playing :${audioFile.name}`;
  } else {
    alert("Invalid File Type!");
  }
}

area.addEventListener("click", () => {
  if (audio.paused) {
    audio.play();
    label.style.display = "none";
  } else {
    audio.pause();
    label.style.display = "flex";
  }
});

startVis();

function clearScene() {
  const canvas = area.firstElementChild;
  if (canvas) area.removeChild(canvas);
}

function startVis() {
  const context = new AudioContext();
  const src = context.createMediaElementSource(audio);
  const analyser = context.createAnalyser();
  src.connect(analyser);
  analyser.connect(context.destination);
  analyser.fftSize = 512;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    1200
  );
  camera.position.z = 100;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor("#000000"); 
  area.appendChild(renderer.domElement);

  
  const geometry = new THREE.IcosahedronGeometry(20, 3);
  const material = new THREE.MeshLambertMaterial({
    color: "#696969",
    wireframe: true,
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  
  const lights = [];
  for (let i = 0; i < 6; i++) {
    const color = new THREE.Color(
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random(),

    ); 
    const light = new THREE.PointLight(color, 1, 200);
    light.position.set(
      Math.random() * 200 - 100,
      Math.random() * 200 - 100,
      Math.random() * 200 - 100,
      Math.random() * 200 - 100,
      Math.random() * 200 - 100,
      Math.random() * 200 - 100,

    );
    scene.add(light);
    lights.push(light);
  }

  const ambientLight = new THREE.AmbientLight(0x404040, 0.5); 
  scene.add(ambientLight);

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  function render() {
    analyser.getByteFrequencyData(dataArray);

    const lowerHalf = dataArray.slice(0, dataArray.length / 2 - 1);
    const upperHalf = dataArray.slice(
      dataArray.length / 2 - 1,
      dataArray.length - 1
    );

    const lowerMax = max(lowerHalf);
    const upperAvg = avg(upperHalf);

    const lowerMaxFr = lowerMax / lowerHalf.length;
    const upperAvgFr = upperAvg / upperHalf.length;

    sphere.rotation.x += 0.001;
    sphere.rotation.y += 0.003;
    sphere.rotation.z += 0.005;

    WarpSphere(
      sphere,
      modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8),
      modulate(upperAvgFr, 0, 1, 0, 4)
    );

    
    lights.forEach((light, index) => {
      light.position.x = Math.sin(Date.now() * 0.001 + index) * 50;
      light.position.y = Math.cos(Date.now() * 0.001 + index) * 50;
      light.intensity = modulate(lowerMaxFr, 0, 1, 0.5, 2);
      light.color.setHSL(
        modulate(upperAvgFr, 0, 1, 0, 1),
        1,
        0.5
      ); 
    });

    requestAnimationFrame(render);
    renderer.render(scene, camera);
  }

  function WarpSphere(mesh, bassFr, treFr) {
    mesh.geometry.vertices.forEach((vertex, i) => {
      const offset = mesh.geometry.parameters.radius;
      const amp = 5;
      const time = window.performance.now();
      vertex.normalize();
      const rf = 0.00001;
      const distance =
        offset +
        bassFr +
        noise.noise3D(
          vertex.x + time * rf * 4,
          vertex.y + time * rf * 6,
          vertex.z + time * rf * 7
        ) *
          amp *
          treFr *
          2;
      vertex.multiplyScalar(distance);
    });
    mesh.geometry.verticesNeedUpdate = true;
    mesh.geometry.normalsNeedUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeFaceNormals();
  }

  render();
}

function fractionate(val, minVal, maxVal) {
  return (val - minVal) / (maxVal - minVal);
}

function modulate(val, minVal, maxVal, outMin, outMax) {
  const fr = fractionate(val, minVal, maxVal);
  const delta = outMax - outMin;
  return outMin + fr * delta;
}

function avg(arr) {
  const total = arr.reduce((sum, b) => sum + b);
  return total / arr.length;
}

function max(arr) {
  return arr.reduce((a, b) => Math.max(a, b));
}
