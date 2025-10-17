import React, { useRef, useEffect } from 'react';

interface VirusCanvasProps {
    kernelCode: string;
}

const VSHADER_SOURCE = `
    #version 100
    precision highp float;
    attribute vec4 position;
    varying vec3 dir, localdir;
    uniform vec3 right, forward, up, origin;
    uniform float x, y;
    void main() {
       gl_Position = position; 
       dir = forward + right * position.x*x + up * position.y*y;
       localdir.x = position.x*x;
       localdir.y = position.y*y;
       localdir.z = -1.0;
    }`;

const FSHADER_SOURCE = `
    #version 100
    #define PI 3.14159265358979324
    #define M_L 0.3819660113
    #define M_R 0.6180339887
    #define MAXR 8
    #define SOLVER 8
    precision highp float;
    
    uniform vec3 right, forward, up, origin;
    uniform float u_time;
    varying vec3 dir, localdir;
    uniform float len;
    
    // Function provided by the user
    float kernal(vec3 ver);

    // Random function for glitches
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    vec3 get_color_at(vec3 custom_dir) {
        vec3 color = vec3(0.0);
        int sign = 0;
        float v, v1, v2;
        float r1, r2, r3, r4, m1, m2, m3, m4;
        vec3 ver;
        
        v1 = kernal(origin + custom_dir * (step*len));
        v2 = kernal(origin);
        for (int k = 2; k < 1002; k++) {
          ver = origin + custom_dir * (step*len*float(k));
          v = kernal(ver);
          if (v > 0.0 && v1 < 0.0) {
             r1 = step * len*float(k - 1);
             r2 = step * len*float(k);
             for (int l = 0; l < SOLVER; l++) {
                r3 = r1 * 0.5 + r2 * 0.5;
                if (kernal(origin + custom_dir * r3) > 0.0) { r2 = r3; } else { r1 = r3; }
             }
             if (r3 < 2.0 * len) { sign=1; break; }
          }
          if (v < v1&&v1>v2&&v1 < 0.0 && (v1*2.0 > v || v1 * 2.0 > v2)) {
             r1 = step * len*float(k - 2);
             r2 = step * len*(float(k) - 2.0 + 2.0*M_L);
             r3 = step * len*(float(k) - 2.0 + 2.0*M_R);
             m2 = kernal(origin + custom_dir * r2);
             m3 = kernal(origin + custom_dir * r3);
             for (int l = 0; l < MAXR; l++) {
                if (m2 > m3) {
                   r4=r3; r3=r2; r2 = r4 * M_L + r1 * M_R; m3=m2; m2 = kernal(origin + custom_dir * r2);
                } else {
                   r1=r2; r2=r3; r3 = r4 * M_R + r1 * M_L; m2=m3; m3 = kernal(origin + custom_dir * r3);
                }
             }
             if (m2 > 0.0 || m3 > 0.0) {
                r2 = (m2 > 0.0) ? r2 : r3;
                r1 = step * len*float(k - 2);
                for (int l = 0; l < SOLVER; l++) {
                   r3 = r1 * 0.5 + r2 * 0.5;
                   if (kernal(origin + custom_dir * r3) > 0.0) { r2 = r3; } else { r1 = r3; }
                }
                if (r3 < 2.0 * len && r3 > step * len) { sign=1; break; }
             }
          }
          v2 = v1;
          v1 = v;
        }

        if (sign==1) {
            ver = origin + custom_dir*r3;
            r1 = length(ver);
            vec3 px = vec3(r3*0.00025, 0.0, 0.0);
            vec3 n;
            n.x = kernal(ver - right * px.x) - kernal(ver + right * px.x);
            n.y = kernal(ver - up * px.x) - kernal(ver + up * px.x);
            n.z = kernal(ver + forward * px.x) - kernal(ver - forward * px.x);
            n = normalize(n);
            ver = normalize(localdir);
            vec3 reflect = n * (-2.0*dot(ver, n)) + ver;
            r3 = dot(reflect, normalize(vec3(0.276, 0.920, 0.276)));
            r4 = dot(n, normalize(vec3(0.276, 0.920, 0.276)));
            r3 = max(0.0, r3);
            r3 = pow(r3, 4.0);
            r3 = r3 * 0.45 + r4 * 0.25 + 0.3;
            vec3 band_color;
            band_color.x = sin(r1*10.0)*0.5+0.5;
            band_color.y = sin(r1*10.0+2.05)*0.5+0.5;
            band_color.z = sin(r1*10.0-2.05)*0.5+0.5;
            color = band_color*r3;
        }
        return color;
    }

    void main() {
       vec2 uv = gl_FragCoord.xy / 1024.0;
       
       // Tearing/desync effect
       float tear = sin(gl_FragCoord.y * 0.5 + u_time * 55.0) * 0.015 * step(0.95, fract(u_time * 3.0));
       float tear_v = cos(gl_FragCoord.x * 0.4 + u_time * 45.0) * 0.015 * step(0.95, fract(u_time * 2.5));
       vec3 current_dir = dir + vec3(tear, tear_v, 0.0);

       // Chromatic Aberration
       float ca_amount = 0.008 + sin(u_time * 10.0) * 0.004;
       vec3 col;
       col.r = get_color_at(current_dir + vec3(ca_amount, 0.0, 0.0)).r;
       col.g = get_color_at(current_dir).g;
       col.b = get_color_at(current_dir - vec3(ca_amount, 0.0, 0.0)).b;
       
       // Data corruption blocks
       float block_size = 32.0;
       vec2 block_uv = floor(gl_FragCoord.xy / block_size);
       float block_glitch = rand(block_uv + floor(u_time * 15.0));
       if (block_glitch > 0.95) {
           col = vec3(rand(block_uv), rand(block_uv.yx), rand(uv));
       }
       
       // High-frequency digital noise/glitch
       if (rand(uv + u_time) > 0.9) {
           col = mix(col, vec3(1.0, 0.0, 1.0), 0.8);
       }
       
       // Color palette corruption
       if (mod(u_time, 2.0) > 1.9) {
           col = floor(col * 4.0) / 4.0;
       }

       // Severe Vignette
       float vignette = 1.0 - dot(uv * 2.0 - 1.0, uv * 2.0 - 1.0) * 0.6;
       col *= vignette;
       
       gl_FragColor = vec4(col, 1.0);
    }`;

const VirusCanvas: React.FC<VirusCanvasProps> = ({ kernelCode }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const shaderProgramRef = useRef<WebGLProgram | null>(null);
    const animationFrameIdRef = useRef<number>(0);

    const ang1 = useRef(2.8);
    const ang2 = useRef(0.4);
    const len = useRef(1.6);
    const cenx = useRef(0.0);
    const ceny = useRef(0.0);
    const cenz = useRef(0.0);
    const mx = useRef(0);
    const my = useRef(0);
    const mx1 = useRef(0);
    const my1 = useRef(0);
    const ml = useRef(0);
    const mr = useRef(0);
    const mm = useRef(0);
    const lasttimen = useRef(0);
    const cx = useRef(1024);
    const cy = useRef(1024);
    const startTime = useRef(Date.now());

    const uniformLocations = useRef<{[key: string]: WebGLUniformLocation | null}>({});

    const initShaderProgram = (gl: WebGLRenderingContext, vsSource: string, fsSource: string) => {
        const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
        if (!vertexShader || !fragmentShader) return null;

        const shaderProgram = gl.createProgram();
        if (!shaderProgram) return null;
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(shaderProgram);
            const fragInfo = gl.getShaderInfoLog(fragmentShader);
            // Hide alert in final version to not break immersion
            console.error('Shader program error: ' + fragInfo + info);
            gl.deleteProgram(shaderProgram);
            return null;
        }
        return shaderProgram;
    };

    const loadShader = (gl: WebGLRenderingContext, type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            console.error('Shader compile error: ' + info);
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl', { antialias: false });
        if (!gl) {
            alert("WebGL not supported!");
            return;
        }
        glRef.current = gl;

        const setupGl = (kernel: string) => {
            const finalFragmentShader = FSHADER_SOURCE.replace('float kernal(vec3 ver);', kernel);
            const shaderProgram = initShaderProgram(gl, VSHADER_SOURCE, finalFragmentShader);
            if (!shaderProgram) return;
            shaderProgramRef.current = shaderProgram;
            gl.useProgram(shaderProgram);

            uniformLocations.current = {
                position: gl.getAttribLocation(shaderProgram, 'position'),
                right: gl.getUniformLocation(shaderProgram, 'right'),
                forward: gl.getUniformLocation(shaderProgram, 'forward'),
                up: gl.getUniformLocation(shaderProgram, 'up'),
                origin: gl.getUniformLocation(shaderProgram, 'origin'),
                x: gl.getUniformLocation(shaderProgram, 'x'),
                y: gl.getUniformLocation(shaderProgram, 'y'),
                len: gl.getUniformLocation(shaderProgram, 'len'),
                u_time: gl.getUniformLocation(shaderProgram, 'u_time'),
            };

            const positions = [-1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0];
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
            gl.vertexAttribPointer(uniformLocations.current.position as number, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(uniformLocations.current.position as number);
            gl.viewport(0, 0, canvas.width, canvas.height);
        };
        
        setupGl(kernelCode);

        // Resize handler
        const handleResize = () => {
            const container = canvas.parentElement;
            if (container) {
                let size = Math.min(container.clientWidth, container.clientHeight);
                cx.current = size;
                cy.current = size;
                canvas.style.width = `${size}px`;
                canvas.style.height = `${size}px`;
            }
        };

        const draw = () => {
            if (!glRef.current || !shaderProgramRef.current) return;
            const gl = glRef.current;
            const u = uniformLocations.current;

            const elapsed = (Date.now() - startTime.current) / 1000.0;
            gl.uniform1f(u.u_time, elapsed);
            
            gl.uniform1f(u.x, cx.current / Math.min(cx.current, cy.current));
            gl.uniform1f(u.y, cy.current / Math.min(cx.current, cy.current));
            gl.uniform1f(u.len, len.current);

            gl.uniform3f(u.origin, len.current * Math.cos(ang1.current) * Math.cos(ang2.current) + cenx.current, len.current * Math.sin(ang2.current) + ceny.current, len.current * Math.sin(ang1.current) * Math.cos(ang2.current) + cenz.current);
            gl.uniform3f(u.right, Math.sin(ang1.current), 0, -Math.cos(ang1.current));
            gl.uniform3f(u.up, -Math.sin(ang2.current) * Math.cos(ang1.current), Math.cos(ang2.current), -Math.sin(ang2.current) * Math.sin(ang1.current));
            gl.uniform3f(u.forward, -Math.cos(ang1.current) * Math.cos(ang2.current), -Math.sin(ang2.current), -Math.sin(ang1.current) * Math.cos(ang2.current));

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.finish();
        };

        const renderLoop = () => {
            ang1.current += 0.005;
            draw();
            animationFrameIdRef.current = requestAnimationFrame(renderLoop);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        renderLoop();
        
        const preventDefault = (e: Event) => e.preventDefault();
        
        const handleMouseDown = (ev: MouseEvent) => {
            if (ev.button === 0) { ml.current = 1; mm.current = 0; }
            if (ev.button === 2) { mr.current = 1; mm.current = 0; }
            mx.current = ev.clientX;
            my.current = ev.clientY;
        };
        const handleMouseUp = (ev: MouseEvent) => {
            if (ev.button === 0) ml.current = 0;
            if (ev.button === 2) mr.current = 0;
        };
        const handleMouseMove = (ev: MouseEvent) => {
            if (ml.current === 1) {
                ang1.current += (ev.clientX - mx.current) * 0.002;
                ang2.current += (ev.clientY - my.current) * 0.002;
                if (ev.clientX !== mx.current || ev.clientY !== my.current) mm.current = 1;
            }
            if (mr.current === 1) {
                const l = len.current * 4.0 / (cx.current + cy.current);
                cenx.current += l * (-(ev.clientX - mx.current) * Math.sin(ang1.current) - (ev.clientY - my.current) * Math.sin(ang2.current) * Math.cos(ang1.current));
                ceny.current += l * ((ev.clientY - my.current) * Math.cos(ang2.current));
                cenz.current += l * ((ev.clientX - mx.current) * Math.cos(ang1.current) - (ev.clientY - my.current) * Math.sin(ang2.current) * Math.sin(ang1.current));
                if (ev.clientX !== mx.current || ev.clientY !== my.current) mm.current = 1;
            }
            mx.current = ev.clientX;
            my.current = ev.clientY;
        };
        const handleWheel = (ev: WheelEvent) => {
            ev.preventDefault();
            len.current *= Math.exp(-0.001 * ev.deltaY);
        };

        // Touch events
        const handleTouchStart = (ev: TouchEvent) => {
            const n = ev.touches.length;
            if (n === 1) {
                mx.current = ev.touches[0].clientX;
                my.current = ev.touches[0].clientY;
            } else if (n === 2) {
                mx.current = ev.touches[0].clientX;
                my.current = ev.touches[0].clientY;
                mx1.current = ev.touches[1].clientX;
                my1.current = ev.touches[1].clientY;
            }
            lasttimen.current = n;
        };
        const handleTouchMove = (ev: TouchEvent) => {
            preventDefault(ev);
            const n = ev.touches.length;
            if (n === 1 && lasttimen.current === 1) {
                const touch = ev.touches[0];
                ang1.current += (touch.clientX - mx.current) * 0.002;
                ang2.current += (touch.clientY - my.current) * 0.002;
                mx.current = touch.clientX;
                my.current = touch.clientY;
            } else if (n === 2) {
                const t0 = ev.touches[0];
                const t1 = ev.touches[1];
                const l = len.current * 2.0 / (cx.current + cy.current);
                cenx.current += l * (-(t0.clientX + t1.clientX - mx.current - mx1.current) * Math.sin(ang1.current) - (t0.clientY + t1.clientY - my.current - my1.current) * Math.sin(ang2.current) * Math.cos(ang1.current));
                ceny.current += l * ((t0.clientY + t1.clientY - my.current - my1.current) * Math.cos(ang2.current));
                cenz.current += l * ((t0.clientX + t1.clientX - mx.current - mx1.current) * Math.cos(ang1.current) - (t0.clientY + t1.clientY - my.current - my1.current) * Math.sin(ang2.current) * Math.sin(ang1.current));
                const oldDist = Math.sqrt((mx.current - mx1.current) ** 2 + (my.current - my1.current) ** 2) + 1.0;
                mx.current = t0.clientX; my.current = t0.clientY;
                mx1.current = t1.clientX; my1.current = t1.clientY;
                const newDist = Math.sqrt((mx.current - mx1.current) ** 2 + (my.current - my1.current) ** 2) + 1.0;
                len.current *= oldDist / newDist;
            }
            lasttimen.current = n;
        };

        const parentEl = canvas.parentElement;
        parentEl?.addEventListener('mousedown', handleMouseDown);
        parentEl?.addEventListener('mouseup', handleMouseUp);
        parentEl?.addEventListener('mousemove', handleMouseMove);
        parentEl?.addEventListener('wheel', handleWheel, { passive: false });
        parentEl?.addEventListener('touchstart', handleTouchStart, { passive: false });
        parentEl?.addEventListener('touchend', handleTouchStart, { passive: false });
        parentEl?.addEventListener('touchmove', handleTouchMove, { passive: false });


        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameIdRef.current);
            parentEl?.removeEventListener('mousedown', handleMouseDown);
            parentEl?.removeEventListener('mouseup', handleMouseUp);
            parentEl?.removeEventListener('mousemove', handleMouseMove);
            parentEl?.removeEventListener('wheel', handleWheel);
            parentEl?.removeEventListener('touchstart', handleTouchStart);
            parentEl?.removeEventListener('touchend', handleTouchStart);
            parentEl?.removeEventListener('touchmove', handleTouchMove);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

     useEffect(() => {
        if (glRef.current) {
            const gl = glRef.current;
            const finalFragmentShader = FSHADER_SOURCE.replace('float kernal(vec3 ver);', kernelCode);
            const shaderProgram = initShaderProgram(gl, VSHADER_SOURCE, finalFragmentShader);
             if (shaderProgram) {
                shaderProgramRef.current = shaderProgram;
                gl.useProgram(shaderProgram);
                 uniformLocations.current = {
                    position: gl.getAttribLocation(shaderProgram, 'position'),
                    right: gl.getUniformLocation(shaderProgram, 'right'),
                    forward: gl.getUniformLocation(shaderProgram, 'forward'),
                    up: gl.getUniformLocation(shaderProgram, 'up'),
                    origin: gl.getUniformLocation(shaderProgram, 'origin'),
                    x: gl.getUniformLocation(shaderProgram, 'x'),
                    y: gl.getUniformLocation(shaderProgram, 'y'),
                    len: gl.getUniformLocation(shaderProgram, 'len'),
                    u_time: gl.getUniformLocation(shaderProgram, 'u_time'),
                };
                 gl.enableVertexAttribArray(uniformLocations.current.position as number);
                 gl.vertexAttribPointer(uniformLocations.current.position as number, 3, gl.FLOAT, false, 0, 0);

            }
        }
    }, [kernelCode]);

    return (
        <div className="absolute inset-0 flex items-center justify-center">
             <canvas ref={canvasRef} width={1024} height={1024} className="bg-transparent" />
        </div>
    );
};

export default VirusCanvas;