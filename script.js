const audioInput = document.getElementById("audio");
const area = document.getElementById("visualiser");
const label = document.getElementById("label");
const filenameDiv = document.getElementById("filename");
const visSelector = document.getElementById("visSelector");
let audio = new Audio("Still.mp3");

let noise = new SimplexNoise(); // For sphere warp effect
let currentVisualization = "mosaic"; // Default visualization

// Splash Screen Functionality
function showSplashScreen() {
  // Create splash screen container
  const splashScreen = document.createElement("div");
  splashScreen.id = "splash-screen";
  splashScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e3c72, #2a5298);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    font-family: Arial, sans-serif;
    z-index: 10000;
  `;

  //  title
  const title = document.createElement("h1");
  title.textContent = "AUDIO VISUALIZER ♫ ";
  title.style.cssText = `
    font-size: 3rem;
    margin: 0;
    animation: fadeIn 2s ease-in-out;
  `;
  splashScreen.appendChild(title);

  //  subtitle
  const subtitle = document.createElement("p");
  subtitle.textContent =
    " Music more fun with real-time audio visualizations . This is currently at the MVP stage.";
  subtitle.style.cssText = `
    font-size: 1.5rem;
    margin-top: 10px;
    animation: fadeIn 3s ease-in-out;
  `;
  splashScreen.appendChild(subtitle);

  // start button
  const startButton = document.createElement("button");
  startButton.textContent = "Start Visualizer";
  startButton.style.cssText = `
    margin-top: 20px;
    padding: 10px 20px;
    font-size: 1rem;
    border: none;
    background: #ff6600;
    color: white;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.3s ease;
  `;
  startButton.addEventListener("mouseover", () => {
    startButton.style.background = "#ff4500";
  });
  startButton.addEventListener("mouseout", () => {
    startButton.style.background = "#ff6600";
  });

  // Start button click listener
  startButton.addEventListener("click", () => {
    document.body.removeChild(splashScreen);
    startVisualizer();
  });

  splashScreen.appendChild(startButton);
  document.body.appendChild(splashScreen);

  // Keyframe animations
  const style = document.createElement("style");
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// Start Visualizer
function startVisualizer() {
  // Event listeners for file input, visualization selector, and area interaction
  audioInput.addEventListener("change", setAudio, false);
  visSelector.addEventListener("change", handleVisualizationChange);
  area.addEventListener("click", toggleAudio);

  startVis(); // Start visualization
}

function setAudio() {
  audio.pause();
  const audioFile = this.files[0];
  if (audioFile.name.includes(".mp3")) {
    const audioURL = URL.createObjectURL(audioFile);
    audio = new Audio(audioURL);
    clearScene();
    startVis();
    filenameDiv.textContent = `Now Playing: ${audioFile.name}`;
  } else {
    alert("Invalid File Type!");
  }
}

function toggleAudio() {
  if (audio.paused) {
    audio.play();
    label.style.display = "none";
  } else {
    audio.pause();
    label.style.display = "flex";
  }
}

function handleVisualizationChange() {
  currentVisualization = visSelector.value;
  clearScene();
  startVis();
}

function clearScene() {
  while (area.firstChild) {
    area.removeChild(area.firstChild);
  }
}

function startVis() {
  const context = new AudioContext();
  const src = context.createMediaElementSource(audio);
  const analyser = context.createAnalyser();
  src.connect(analyser);
  analyser.connect(context.destination);
  analyser.fftSize = 512;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, currentVisualization === "mosaic" ? 300 : 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor("#000000");
  area.appendChild(renderer.domElement);

  // Visualization: Shader
  if (currentVisualization === "shader") {
    const shaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1) },
            audioData: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 0.01);
            }
        `,
        fragmentShader: `
            uniform float iTime;
            uniform vec3 iResolution;
            uniform float audioData;
            varying vec2 vUv;

            vec3 palette(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.3, 0.4, 0.7);
                return a + b * cos(6.28318 * (c * t + d));
            }

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= iResolution.x / iResolution.y;
                float dist = length(uv);

                // Move the circle in and out based on audioData
                float circleRadius = 0.2 + audioData * 0.5; // Circle size varies with audioData
                float circleMask = smoothstep(circleRadius, circleRadius + 0.02, dist);

                float wave = sin(10.0 * (dist - iTime * 0.2)) * 0.5 + 0.5;
                float squarePattern = abs(sin(uv.x * 5.0 + iTime)) * abs(cos(uv.y * 5.0 + iTime));
                float triangleWave = abs(mod(uv.x * 10.0 - iTime, 2.0) - 1.0) * abs(mod(uv.y * 10.0 - iTime, 2.0) - 1.0);
                float ripple = 0.1 / abs(0.05 - mod(dist + iTime * 0.15, 0.2));

                float combinedPatterns = mix(wave, squarePattern, 0.5) + triangleWave * (audioData * 0.8) + ripple * 0.3;

                vec3 baseColor = palette(dist + iTime * 0.2);
                vec3 glowColor = vec3(1.0, 0.6, 0.3) * ripple * audioData;

                float lightIntensity = audioData * 2.0;
                vec3 light = vec3(lightIntensity) * vec3(0.8, 0.9, 1.0);

                vec3 color = mix(baseColor, glowColor, 0.6) * combinedPatterns + light * 0.3;

                // Apply circle mask to create the moving circle effect
                color *= 1.0 - circleMask;

                // Fade animation when audio frequency is low
                float fade = smoothstep(0.02, 0.1, audioData);
                color *= fade;

                gl_FragColor = vec4(color, 1.0);
            }
        `
    });

    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    const planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
    scene.add(planeMesh);

    function animateShader() {
        analyser.getByteFrequencyData(dataArray);
        const avgFrequency = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedAudio = avgFrequency / 256.0;

        if (normalizedAudio > 0.01) {
            shaderMaterial.uniforms.audioData.value = normalizedAudio;
            shaderMaterial.uniforms.iTime.value += 0.02;
        } else {
            shaderMaterial.uniforms.audioData.value *= 0.9; // Gradually fade
        }

        renderer.render(scene, camera);
        requestAnimationFrame(animateShader);
    }

    animateShader();
}

    // Visualization: Mosaic
  else if (currentVisualization === "mosaic") {
    const gridWidth = 30;
    const gridHeight = 30;
    const tileSpacing = 15;
    const tiles = [];
    const planeGeometry = new THREE.PlaneGeometry(5, 5);

    for (let i = 0; i < gridWidth; i++) {
      for (let j = 0; j < gridHeight; j++) {
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color(`hsl(${Math.random() * 360}, 50%, 50%)`),
          side: THREE.DoubleSide,
        });
        const tile = new THREE.Mesh(planeGeometry, material);
        tile.position.set(
          i * tileSpacing - (gridWidth * tileSpacing) / 2,
          j * tileSpacing - (gridHeight * tileSpacing) / 2,
          0
        );
        tiles.push(tile);
        scene.add(tile);
      }
    }

    function renderMosaic() {
      analyser.getByteFrequencyData(dataArray);

      tiles.forEach((tile, index) => {
        const freq = dataArray[index % dataArray.length] / 255;
        tile.scale.set(1 + freq, 1 + freq, 1);
        tile.material.color.setHSL(freq, 0.8, 0.5);
      });

      renderer.render(scene, camera);
      requestAnimationFrame(renderMosaic);
    }

    renderMosaic();

  } else if (currentVisualization === "sphere") {
    const sphereGeometry = new THREE.IcosahedronGeometry(20, 3);
    const sphereMaterial = new THREE.MeshLambertMaterial({
      color: "#ADD8E6",
      wireframe: true,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const lights = [];
    for (let i = 0; i < 6; i++) {
      const light = new THREE.PointLight(Math.random() * 0xffffff, 1, 100);
      light.position.set(
        Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        Math.random() * 200 - 100
      );
      scene.add(light);
      lights.push(light);
    }

    function addSpotLight() {
      const spotLight = new THREE.SpotLight(0xff0000, 2, 200, Math.PI / 4, 0.5, 1);
      spotLight.position.set(
        Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        Math.random() * 200 - 100
      );
      scene.add(spotLight);
    }

    for (let i = 0; i < 2; i++) {
      addSpotLight(); // Add a couple of spotlight lights for variation
    }

    function renderSphere() {
      analyser.getByteFrequencyData(dataArray);

      const lowerHalf = dataArray.slice(0, dataArray.length / 2 - 1);
      const upperHalf = dataArray.slice(dataArray.length / 2 - 1, dataArray.length - 1);

      const lowerMax = max(lowerHalf);
      const upperAvg = avg(upperHalf);

      const lowerMaxFr = lowerMax / lowerHalf.length;
      const upperAvgFr = upperAvg / upperHalf.length;

      sphere.rotation.x += 0.001;
      sphere.rotation.y += 0.003;
      sphere.rotation.z += 0.005;

      warpSphere(
        sphere,
        modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8),
        modulate(upperAvgFr, 0, 1, 0, 4)
      );

      lights.forEach((light, index) => {
        light.position.x = Math.sin(Date.now() * 0.001 + index) * 50;
        light.position.y = Math.cos(Date.now() * 0.001 + index) * 50;
        light.intensity = modulate(lowerMaxFr, 0, 1, 0.5, 2);
        light.color.setHSL(modulate(upperAvgFr, 0, 1, 0, 1), 1, 0.5);
      });
      scene.children.forEach((light) => {
        if (light instanceof THREE.SpotLight) {
          light.intensity = modulate(upperAvgFr, 0, 1, 0.1, 5);
          light.position.x = Math.sin(Date.now() * 0.01) * 100;
          light.position.y = Math.cos(Date.now() * 0.01) * 100;
        }
      });
      renderer.render(scene, camera);
      requestAnimationFrame(renderSphere);
    }

    renderSphere();
  }

  else if (currentVisualization === "psychedelicTunnel") {
    console.log("Setting up psychedelic tunnel");
    
    try {
        // Set up camera position
        camera.position.z = 100;
        
        // Create a simple plane background
        const backgroundGeometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
        const backgroundMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000066, // Dark blue background
            side: THREE.DoubleSide
        });
        const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        background.position.z = -100;
        scene.add(background);
        console.log("Added background");
        
        // Create rings for the tunnel using ShapeGeometry
        const rings = [];
        const ringCount = 15;
        const outerRadius = 30;
        const innerRadius = 20;
        
        for (let i = 0; i < ringCount; i++) {
            // Define the ring shape with an outer circle and inner hole
            const shape = new THREE.Shape();
            shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false); // Outer circle
            const hole = new THREE.Path();
            hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);   // Inner hole
            shape.holes.push(hole);
            
            // Create geometry from the shape
            const ringGeometry = new THREE.ShapeGeometry(shape);
            
            // Create material with dynamic color and wireframe
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color(`hsl(${(i * 15) % 360}, 70%, 50%)`),
                side: THREE.DoubleSide,
                wireframe: true
            });
            
            // Create mesh, position it, and store initial data
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.z = -i * 20 - 50; // Spread rings along z-axis
            ring.userData = { initialZ: ring.position.z };
            rings.push(ring);
            scene.add(ring);
            console.log(`Added ring ${i}`);
        }
        
        // Add a simple particle system
        try {
            const particleCount = 500;
            const particles = new THREE.Group();
            
            for (let i = 0; i < particleCount; i++) {
                const geometry = new THREE.BoxGeometry(1, 1, 1); // Small cube particles
                const material = new THREE.MeshBasicMaterial({ 
                    color: 0xffffff, // White particles
                    transparent: true,
                    opacity: 0.8
                });
                
                const particle = new THREE.Mesh(geometry, material);
                
                // Position particles in a tunnel-like distribution
                const angle = Math.random() * Math.PI * 2;
                const radius = 20 + Math.random() * 20; // Between 20 and 40
                particle.position.x = Math.cos(angle) * radius;
                particle.position.y = Math.sin(angle) * radius;
                particle.position.z = -Math.random() * 300; // From z=0 to z=-300
                
                // Store original data for animation
                particle.userData = { 
                    originalZ: particle.position.z,
                    speed: 0.5 + Math.random() * 1.5
                };
                
                particles.add(particle);
            }
            
            scene.add(particles);
            console.log(`Added ${particleCount} particles`);
            
            // Add basic lights (though not needed for MeshBasicMaterial)
            const ambientLight = new THREE.AmbientLight(0x222222);
            scene.add(ambientLight);
            
            const pointLight = new THREE.PointLight(0xffffff, 1);
            pointLight.position.set(0, 0, 50);
            scene.add(pointLight);
            console.log("Added lights");
            
            // Animation function
            function renderPsychedelicTunnel() {
                try {
                    analyser.getByteFrequencyData(dataArray);
                    
                    // Extract audio data for reactivity
                    const bassSum = dataArray.slice(0, 5).reduce((sum, val) => sum + val, 0);
                    const bassIntensity = bassSum / (5 * 255);
                    
                    const midSum = dataArray.slice(5, 20).reduce((sum, val) => sum + val, 0);
                    const midIntensity = midSum / (15 * 255);
                    
                    // Update rings
                    rings.forEach((ring, index) => {
                        // Move rings toward the camera
                        ring.position.z += 1 + bassIntensity * 2;
                        
                        // Reset position when past the camera
                        if (ring.position.z > 50) {
                            ring.position.z = -250; // Move to back of tunnel
                            
                            // Update ring color dynamically
                            if (ring.material) {
                                const hue = (Date.now() * 0.0002 + index * 0.1) % 1;
                                ring.material.color.setHSL(hue, 0.7, 0.5);
                            }
                        }
                        
                        // Rotate rings based on audio
                        ring.rotation.z += 0.01 + bassIntensity * 0.02;
                    });
                    
                    // Update particles
                    particles.children.forEach(particle => {
                        particle.position.z += particle.userData.speed + bassIntensity * 3;
                        
                        // Reset particles when past the camera
                        if (particle.position.z > 50) {
                            const angle = Math.random() * Math.PI * 2;
                            const radius = 20 + Math.random() * 20;
                            particle.position.x = Math.cos(angle) * radius;
                            particle.position.y = Math.sin(angle) * radius;
                            particle.position.z = -300;
                            
                            // Update particle color
                            if (particle.material) {
                                const hue = (Date.now() * 0.001) % 1;
                                particle.material.color.setHSL(hue, 0.8, 0.5);
                            }
                        }
                        
                        // Rotate particles for visual effect
                        particle.rotation.x += 0.01;
                        particle.rotation.y += 0.01;
                    });
                    
                    // Update background color based on audio
                    if (background && background.material) {
                        const bgHue = (Date.now() * 0.0001) % 1;
                        background.material.color.setHSL(bgHue, 0.7, 0.1 + bassIntensity * 0.2);
                    }
                    
                    // Update light properties
                    if (pointLight) {
                        const lightHue = (Date.now() * 0.0002 + 0.5) % 1;
                        pointLight.color.setHSL(lightHue, 0.7, 0.5);
                        pointLight.intensity = 1 + bassIntensity * 2;
                    }
                    
                    // Render the scene
                    renderer.render(scene, camera);
                } catch (renderError) {
                    console.error("Error in render loop:", renderError);
                }
                
                requestAnimationFrame(renderPsychedelicTunnel);
            }
            
            renderPsychedelicTunnel();
            console.log("Started animation loop");
            
        } catch (particleError) {
            console.error("Error creating particles:", particleError);
        }
    } catch (setupError) {
        console.error("Error setting up psychedelic tunnel:", setupError);
    }
}
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
}

function warpSphere(mesh, bassFr, treFr) {
  mesh.geometry.vertices.forEach((vertex) => {
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

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

showSplashScreen();