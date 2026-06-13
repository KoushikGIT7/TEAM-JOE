/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';

interface QRScannerProps {
  scannerState: 'IDLE' | 'SUCCESS' | 'ERROR';
  onScan: (payload: string) => void;
  isDebouncing: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  scannerState,
  onScan,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processMockQRFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processMockQRFile(e.target.files[0]);
    }
  };

  const processMockQRFile = (file: File) => {
    const nameLower = file.name.toLowerCase();
    if (nameLower.includes('expired') || nameLower.includes('old')) {
      onScan('EXPIRED_QR_CODE');
    } else if (nameLower.includes('corrupt') || nameLower.includes('invalid') || nameLower.includes('bad')) {
      onScan('INVALID_QR_CODE');
    } else if (nameLower.includes('unverified') || nameLower.includes('cash_pending')) {
      onScan('unverified_cash');
    } else if (nameLower.includes('ord_')) {
      const match = file.name.match(/ord_[a-zA-Z0-9]+/);
      if (match) {
        onScan(match[0]);
      } else {
        onScan('VALID_MOCK_ORDER');
      }
    } else {
      onScan('VALID_MOCK_ORDER');
    }
  };

  return (
    <div 
      id="qr-scanner-viewport"
      className="relative w-full h-full bg-zinc-950 overflow-hidden flex flex-col justify-center items-center cursor-pointer select-none"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      {/* Subtle Scanline CRT Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%),linear-gradient(90deg,rgba(168,85,247,0.02),rgba(0,0,0,0.05),rgba(168,85,247,0.02))] bg-[size:100%_4px,6px_100%] z-10" />

      {/* Futuristic scanning beam */}
      <div className="absolute inset-x-0 top-1/2 h-0.5 bg-brand-purple/20 shadow-[0_0_15px_#a855f7] animate-[bounce_4s_infinite_ease-in-out] pointer-events-none z-10" />

      {/* Minimal corner sights/crosshairs */}
      <div className="absolute top-6 left-6 w-5 h-5 border-t-2 border-l-2 border-brand-purple/40 pointer-events-none z-10" />
      <div className="absolute top-6 right-6 w-5 h-5 border-t-2 border-r-2 border-brand-purple/40 pointer-events-none z-10" />
      <div className="absolute bottom-6 left-6 w-5 h-5 border-b-2 border-l-2 border-brand-purple/40 pointer-events-none z-10" />
      <div className="absolute bottom-6 right-6 w-5 h-5 border-b-2 border-r-2 border-brand-purple/40 pointer-events-none z-10" />

      {/* Drag Over Active Mask */}
      {dragActive && (
        <div className="absolute inset-0 bg-brand-purple/10 backdrop-blur-md border-2 border-dashed border-brand-purple/50 flex flex-col items-center justify-center z-30 animate-fade-in text-white font-mono p-4">
          <span className="font-extrabold text-xs uppercase tracking-wider text-brand-purple-light shadow-sm">
            DROP IMAGE TO EMULATE SCAN
          </span>
        </div>
      )}

      {/* Starfield atmospheric depth simulation */}
      <div className="absolute inset-0 bg-radial-at-c from-zinc-900/40 via-zinc-950/80 to-black z-0 pointer-events-none">
        <div className="w-full h-full opacity-5 bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:16px_16px]" />
      </div>

      {/* Invisible file input trigger */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Central Viewport Core Ring */}
      <div className="flex items-center justify-center z-10 pointer-events-none">
        {scannerState === 'IDLE' && (
          <div className="relative flex items-center justify-center">
            {/* Outer expanding ring pulse */}
            <div className="absolute w-44 h-44 rounded-full border-2 border-brand-purple/15 animate-[ping_3s_infinite_ease-out-out]" />
            {/* Inner neon glow ring */}
            <div className="w-32 h-32 rounded-full border-[3px] border-brand-purple shadow-[0_0_20px_#a855f7] flex items-center justify-center animate-[pulse_2.5s_infinite_ease-in-out]">
              <span className="w-3.5 h-3.5 bg-brand-purple rounded-full shadow-[0_0_10px_#a855f7]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
