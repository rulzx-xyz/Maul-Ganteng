import React, { useState, useEffect, useRef, useCallback } from 'react';
import VirusCanvas from './components/VirusCanvas';
import OverlayUI from './components/OverlayUI';

const GLITCH_TEXTS = [
  "SYSTEM_FAILURE", "KERNEL_PANIC", "MEMORY_LEAK", "ACCESS_DENIED", 
  "CORRUPTION_DETECTED", "UNAUTHORIZED_ACCESS", "FATAL_ERROR", 
  "STACK_OVERFLOW", "MALICIOUS_CODE_EXECUTED", "DATA_BREACH", "0xDEADBEEF",
  "█▓▒░", "R̸E̴S̷I̴S̵T̴A̵N̵C̸E̵ ̴I̵S̵ ̴F̸U̴T̵I̴L̴E̵", "null_ptr_exception"
];

const ERROR_TITLES = [
    "CRITICAL_ERROR", "SYSTEM_HALTED", "ACCESS_VIOLATION", "PRIVILEGE_ESCALATION", "SEGFAULT",
    "!!_FATAL_!!", "MEMORY_DUMP", "CORE_MELTDOWN"
];

const INITIAL_KERNEL = `float kernal(vec3 ver){
   vec3 a;
   float b,c,d,e;
   a=ver;
   for(int i=0;i<5;i++){
       b=length(a);
       c=atan(a.y,a.x)*8.0;
       e=1.0/b;
       d=acos(a.z/b)*8.0;
       b=pow(b,8.0);
       a=vec3(b*sin(d)*cos(c),b*sin(d)*sin(c),b*cos(d))+ver;
       if(b>6.0){
           break;
       }
   }
   return 4.0-a.x*a.x-a.y*a.y-a.z*a.z;
}`;

interface AudioNodes {
    context: AudioContext;
    noise: ScriptProcessorNode;
    osc: OscillatorNode;
    lfo: OscillatorNode;
    lfo2: OscillatorNode;
    distort: WaveShaperNode;
}

const App: React.FC = () => {
    const [kernel, setKernel] = useState<string>(INITIAL_KERNEL);
    const [glitchItems, setGlitchItems] = useState<{ id: number; text: string; style: React.CSSProperties }[]>([]);
    const [isCrashing, setIsCrashing] = useState(false);
    const audioNodesRef = useRef<AudioNodes | null>(null);
    
    useEffect(() => {
        history.pushState(null, '', location.href);
        const handlePopState = () => { history.go(1); };
        window.addEventListener('popstate', handlePopState);

        const preventDefault = (e: Event) => e.preventDefault();
        window.addEventListener('contextmenu', preventDefault);

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Backspace' && (e.target as HTMLElement).tagName !== 'TEXTAREA') || (e.altKey && e.key === 'ArrowLeft')) {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('contextmenu', preventDefault);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const startAudio = useCallback(() => {
        if (isCrashing && !audioNodesRef.current) {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            const bufferSize = 2048;
            const noise = context.createScriptProcessor(bufferSize, 1, 1);
            noise.onaudioprocess = (e) => {
                const output = e.outputBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 0.3 - 0.15; 
                    if(Math.random() > 0.995) { // Random sharp clicks
                        output[i] = Math.random() > 0.5 ? 1.0 : -1.0;
                    }
                }
            };
            
            const osc = context.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1500, context.currentTime);

            const lfo = context.createOscillator();
            lfo.type = 'sawtooth';
            lfo.frequency.setValueAtTime(30, context.currentTime); // Faster warble

            const lfo2 = context.createOscillator();
            lfo2.type = 'sine';
            lfo2.frequency.setValueAtTime(0.2, context.currentTime); // very slow, deep change

            const lfoGain = context.createGain();
            lfoGain.gain.setValueAtTime(1200, context.currentTime); // Extreme warble

            const lfo2Gain = context.createGain();
            lfo2Gain.gain.setValueAtTime(800, context.currentTime);
            
            lfo.connect(lfoGain);
            lfo2.connect(lfo2Gain);
            lfoGain.connect(osc.frequency);
            lfo2Gain.connect(osc.frequency);
            
            const oscGain = context.createGain();
            oscGain.gain.setValueAtTime(0.05, context.currentTime);
            
            // Heavy distortion
            const distort = context.createWaveShaper();
            const amount = 400;
            const samples = 44100;
            const curve = new Float32Array(samples);
            const deg = Math.PI / 180;
            for (let i = 0; i < samples; ++i) {
              const x = i * 2 / samples - 1;
              curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
            }
            distort.curve = curve;
            distort.oversample = '4x';

            osc.connect(oscGain);
            oscGain.connect(distort);
            distort.connect(context.destination);
            noise.connect(context.destination);
            
            osc.start();
            lfo.start();
            lfo2.start();
            
            audioNodesRef.current = { context, noise, osc, lfo, lfo2, distort };
        }
    }, [isCrashing]);

    const handleInteraction = () => {
        if (!isCrashing) {
            setIsCrashing(true);
            alert("FATAL EXCEPTION: 0xDEADBEEF\nSystem integrity compromised. Unrecoverable error.");
            document.documentElement.requestFullscreen().catch(console.error);
        }
    };
    
    useEffect(() => {
        startAudio();
        return () => {
            const audio = audioNodesRef.current;
            if (audio) {
                audio.noise.disconnect();
                audio.osc.stop();
                audio.lfo.stop();
                audio.lfo2.stop();
                if (audio.context.state !== 'closed') {
                    audio.context.close();
                }
                audioNodesRef.current = null;
            }
        };
    }, [startAudio]);
    
    useEffect(() => {
        if (!isCrashing) return;

        const glitchInterval = setInterval(() => {
            const newItem = {
                id: Date.now() + Math.random(),
                text: GLITCH_TEXTS[Math.floor(Math.random() * GLITCH_TEXTS.length)],
                style: {
                    top: `${Math.random() * 100}vh`,
                    left: `${Math.random() * 100}vw`,
                    fontSize: `${2 + Math.random() * 4}rem`,
                    transform: `rotate(${Math.random() * 90 - 45}deg) skew(${Math.random() * 60 - 30}deg)`,
                    color: ['#ff0000', '#00ff00', '#ffffff', '#ff00ff'][Math.floor(Math.random() * 4)],
                    textShadow: '0 0 8px #fff, 0 0 15px #ff00de, 0 0 20px #ff00de'
                },
            };
            setGlitchItems(current => [...current.slice(-20), newItem]);
        }, 50);

        const errorInterval = setInterval(() => {
            console.error(`!!_UNRECOVERABLE_ERROR_: 0x${Math.random().toString(16).slice(2, 10).toUpperCase()} - Halting process. Memory dump failed.`);
        }, 100);

        const titleInterval = setInterval(() => {
            document.title = ERROR_TITLES[Math.floor(Math.random() * ERROR_TITLES.length)];
        }, 80);

        return () => {
            clearInterval(glitchInterval);
            clearInterval(errorInterval);
            clearInterval(titleInterval);
            document.title = 'MAUL VIRUSE';
        };
    }, [isCrashing]);

    return (
        <div 
          className={`relative w-full h-full bg-black overflow-hidden animate-shake animate-flicker ${isCrashing ? 'cursor-none' : 'cursor-pointer'}`} 
          onClick={handleInteraction}
        >
            <VirusCanvas kernelCode={kernel} />
            {!isCrashing && <OverlayUI kernel={kernel} setKernel={setKernel} initialKernel={INITIAL_KERNEL} />}
            
            {glitchItems.map(item => (
                <div key={item.id} className="absolute p-1 font-mono text-shadow-lg animate-pulse z-30 pointer-events-none animate-flicker" style={item.style}>
                    {item.text}
                </div>
            ))}

            <div className="absolute inset-0 z-0 pointer-events-none animate-strobe"></div>
        </div>
    );
};

export default App;