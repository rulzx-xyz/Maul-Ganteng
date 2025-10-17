import React from 'react';

interface OverlayUIProps {
    // These props are kept for potential future re-integration, but are unused in the "most severe" version.
    kernel: string;
    setKernel: (kernel: string) => void;
    initialKernel: string;
}

const OverlayUI: React.FC<OverlayUIProps> = () => {
    return (
        <>
            <button
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-red-600 text-white font-mono font-bold py-4 px-8 border-4 border-red-900 rounded-none shadow-[8px_8px_0px_0px_#8b0000] hover:bg-red-700 hover:shadow-[4px_4px_0px_0px_#8b0000] transition-all duration-150 animate-pulse text-2xl"
            >
                MAUL VIRUSE !!
            </button>
        </>
    );
};

export default OverlayUI;
